import { JSDOM } from 'jsdom';
import {
  createHolistic,
  createHolisticLoader,
  destroyHolistic,
  DESTROY_OUTCOME,
  HOLISTIC_CDN_BASE,
  HOLISTIC_OPTIONS,
} from '../assets/holistic-factory.js';

// Everything is injected — document, host, timers — and no globals are
// assigned. spec/functions.spec.mjs owns global.window/document, and clobbering
// them under random ordering would leak across specs. jsdom does not fetch
// external scripts by default, so onload/onerror are fired by hand.

function createTimerHarness() {
  const tickets = new Map();
  let nextTicketId = 1;

  return {
    schedule(delayMs, callback) {
      const ticketId = nextTicketId;
      nextTicketId += 1;
      tickets.set(ticketId, { delayMs, callback });
      return ticketId;
    },
    cancel(ticketId) {
      tickets.delete(ticketId);
    },
    pendingCount: () => tickets.size,
    fireAll() {
      [...tickets.entries()].forEach(([ticketId, ticket]) => {
        tickets.delete(ticketId);
        ticket.callback();
      });
    },
  };
}

function createFakeHolisticClass() {
  return class FakeHolistic {
    constructor(config) {
      this.config = config;
      this.options = null;
      this.resultsListener = null;
    }

    setOptions(options) {
      this.options = options;
    }

    onResults(listener) {
      this.resultsListener = listener;
    }
  };
}

function flushMicrotasks() {
  return new Promise(resolve => setImmediate(resolve));
}

// spyOn is unusable in this suite: sound-names.spec.mjs replaces global.console
// at import time with objects that are already spies. Swap and restore instead.
async function withSilencedWarnings(run) {
  const originalWarn = console.warn;
  const reported = [];
  console.warn = (...args) => reported.push(args);

  try {
    return await run(reported);
  } finally {
    console.warn = originalWarn;
  }
}

describe('Holistic factory', () => {
  let doc;
  let host;
  let timers;

  function scripts() {
    return [...doc.querySelectorAll('script')];
  }

  function buildLoader(overrides = {}) {
    return createHolisticLoader({ doc, host, timers, timeoutMs: 20000, ...overrides });
  }

  beforeEach(() => {
    doc = new JSDOM('<!doctype html><html><body></body></html>').window.document;
    host = {};
    timers = createTimerHarness();
  });

  describe('script loader', () => {
    it('injects one script pointing at the pinned CDN build', () => {
      buildLoader().load();

      expect(scripts().length).toBe(1);
      expect(scripts()[0].getAttribute('src')).toBe(`${HOLISTIC_CDN_BASE}/holistic.js`);
    });

    it('resolves with the constructor once the script defines it', async () => {
      const FakeHolistic = createFakeHolisticClass();
      const loading = buildLoader().load();

      host.Holistic = FakeHolistic;
      scripts()[0].onload();

      await expectAsync(loading).toBeResolvedTo(FakeHolistic);
    });

    it('cancels the load timeout once the script loads', async () => {
      const loading = buildLoader().load();

      host.Holistic = createFakeHolisticClass();
      scripts()[0].onload();
      await loading;

      expect(timers.pendingCount()).toBe(0);
    });

    it('shares one in-flight load between concurrent callers', () => {
      const loader = buildLoader();

      const first = loader.load();
      const second = loader.load();

      expect(second).toBe(first);
      expect(scripts().length).toBe(1);
    });

    it('skips injection when Holistic is already present', async () => {
      // The rebuild path: the script ran once, so a new instance must not refetch it.
      const FakeHolistic = createFakeHolisticClass();
      host.Holistic = FakeHolistic;

      await expectAsync(buildLoader().load()).toBeResolvedTo(FakeHolistic);
      expect(scripts().length).toBe(0);
    });

    it('rejects when the script fails to load, then retries on the next call', async () => {
      const loader = buildLoader();
      const firstAttempt = loader.load();
      const firstScript = scripts()[0];

      firstScript.onerror();
      await expectAsync(firstAttempt).toBeRejectedWithError(/Failed to load/);

      loader.load();

      expect(scripts().length).toBe(1);
      expect(scripts()[0]).not.toBe(firstScript);
    });

    it('rejects on timeout instead of hanging forever', async () => {
      const loading = buildLoader({ timeoutMs: 20000 }).load();

      timers.fireAll();

      await expectAsync(loading).toBeRejectedWithError(/Timed out after 20000ms/);
      expect(scripts().length).toBe(0);
    });

    it('rejects when the script loads without defining Holistic', async () => {
      const loading = buildLoader().load();

      scripts()[0].onload();

      await expectAsync(loading).toBeRejectedWithError(/did not define window.Holistic/);
    });

    it('recovers when a timed-out script eventually defines Holistic', async () => {
      const loader = buildLoader();
      const loading = loader.load();

      timers.fireAll();
      await expectAsync(loading).toBeRejected();

      const FakeHolistic = createFakeHolisticClass();
      host.Holistic = FakeHolistic;

      await expectAsync(loader.load()).toBeResolvedTo(FakeHolistic);
      expect(scripts().length).toBe(0);
    });
  });

  describe('createHolistic', () => {
    it('builds an instance with CDN asset paths, the default options, and the results listener', async () => {
      const FakeHolistic = createFakeHolisticClass();
      const onResults = () => {};

      const instance = await createHolistic({
        onResults,
        loader: { load: () => Promise.resolve(FakeHolistic) },
      });

      expect(instance).toEqual(jasmine.any(FakeHolistic));
      expect(instance.config.locateFile('holistic.binarypb')).toBe(`${HOLISTIC_CDN_BASE}/holistic.binarypb`);
      expect(instance.options).toEqual({ ...HOLISTIC_OPTIONS });
      expect(instance.resultsListener).toBe(onResults);
    });

    it('builds a distinct instance on every call', async () => {
      const loader = { load: () => Promise.resolve(createFakeHolisticClass()) };

      const first = await createHolistic({ onResults: () => {}, loader });
      const second = await createHolistic({ onResults: () => {}, loader });

      expect(second).not.toBe(first);
    });

    it('rejects without a results callback', async () => {
      await expectAsync(
        createHolistic({ loader: { load: () => Promise.resolve(createFakeHolisticClass()) } })
      ).toBeRejectedWithError(TypeError);
    });

    it('propagates a script load failure', async () => {
      const failure = new Error('offline');

      await expectAsync(
        createHolistic({ onResults: () => {}, loader: { load: () => Promise.reject(failure) } })
      ).toBeRejectedWith(failure);
    });

    it('waits for the model to initialize before resolving', async () => {
      let finishInitializing;
      const FakeHolistic = class extends createFakeHolisticClass() {
        initialize() {
          return new Promise(resolve => {
            finishInitializing = resolve;
          });
        }
      };

      let isResolved = false;
      const creating = createHolistic({
        onResults: () => {},
        loader: { load: () => Promise.resolve(FakeHolistic) },
        timers,
      }).then(instance => {
        isResolved = true;
        return instance;
      });

      await flushMicrotasks();
      expect(isResolved).toBe(false);

      finishInitializing();
      await creating;

      expect(isResolved).toBe(true);
      expect(timers.pendingCount()).toBe(0);
    });

    it('rejects and closes the instance when initialize never settles', async () => {
      await withSilencedWarnings(async () => {
        let closeCount = 0;
        const FakeHolistic = class extends createFakeHolisticClass() {
          initialize() {
            return new Promise(() => {});
          }

          close() {
            closeCount += 1;
            return Promise.resolve();
          }
        };

        const creating = createHolistic({
          onResults: () => {},
          loader: { load: () => Promise.resolve(FakeHolistic) },
          timers,
          initializeTimeoutMs: 60000,
        });

        await flushMicrotasks();
        timers.fireAll();

        await expectAsync(creating).toBeRejectedWithError(/did not initialize within 60000ms/);
        await flushMicrotasks();

        expect(closeCount).toBe(1);
      });
    });

    it('propagates an initialize failure', async () => {
      const failure = new Error('webgl unavailable');
      const FakeHolistic = class extends createFakeHolisticClass() {
        initialize() {
          return Promise.reject(failure);
        }

        close() {
          return Promise.resolve();
        }
      };

      await expectAsync(
        createHolistic({
          onResults: () => {},
          loader: { load: () => Promise.resolve(FakeHolistic) },
          timers,
        })
      ).toBeRejectedWith(failure);
    });
  });

  describe('destroyHolistic', () => {
    it('reports closed when close resolves', async () => {
      const instance = { close: () => Promise.resolve() };

      await expectAsync(destroyHolistic(instance, { timers })).toBeResolvedTo(DESTROY_OUTCOME.CLOSED);
    });

    it('cancels the close timeout once close resolves', async () => {
      await destroyHolistic({ close: () => Promise.resolve() }, { timers });

      expect(timers.pendingCount()).toBe(0);
    });

    it('reports failed, without rejecting, when close rejects', async () => {
      await withSilencedWarnings(async reported => {
        const instance = { close: () => Promise.reject(new Error('context lost')) };

        await expectAsync(destroyHolistic(instance, { timers })).toBeResolvedTo(DESTROY_OUTCOME.FAILED);
        expect(reported.length).toBe(1);
      });
    });

    it('reports failed when close throws synchronously', async () => {
      await withSilencedWarnings(async () => {
        const instance = {
          close: () => {
            throw new Error('boom');
          },
        };

        await expectAsync(destroyHolistic(instance, { timers })).toBeResolvedTo(DESTROY_OUTCOME.FAILED);
      });
    });

    it('resolves as a timeout when close never settles', async () => {
      // The wedged-instance case: recovery must not wait on it forever.
      await withSilencedWarnings(async () => {
        const instance = { close: () => new Promise(() => {}) };
        const destroying = destroyHolistic(instance, { timers, timeoutMs: 3000 });

        await flushMicrotasks();
        timers.fireAll();

        await expectAsync(destroying).toBeResolvedTo(DESTROY_OUTCOME.TIMEOUT);
      });
    });

    it('skips an absent instance or one without close', async () => {
      await expectAsync(destroyHolistic(null, { timers })).toBeResolvedTo(DESTROY_OUTCOME.SKIPPED);
      await expectAsync(destroyHolistic({}, { timers })).toBeResolvedTo(DESTROY_OUTCOME.SKIPPED);
      expect(timers.pendingCount()).toBe(0);
    });
  });
});
