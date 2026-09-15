import { createScheduler, SCHEDULER_KIND } from '../assets/scheduler.js';

// No jsdom: it provides neither Worker nor URL.createObjectURL, so it cannot
// exercise the worker path at all. An injected fake host covers both paths and
// lets every tick and failure be driven by hand.

function createFakeHost({ withWorker = true, withObjectUrl = true, workerThrows = false } = {}) {
  const posted = [];
  const revokedUrls = [];
  const timeouts = new Map();
  let workerInstance = null;
  let nextTimerId = 1;

  const host = {
    setTimeout(callback, delayMs) {
      const timerId = nextTimerId;
      nextTimerId += 1;
      timeouts.set(timerId, { callback, delayMs });
      return timerId;
    },
    clearTimeout(timerId) {
      timeouts.delete(timerId);
    },
    Blob: class FakeBlob {
      constructor(parts, options) {
        this.parts = parts;
        this.options = options;
      }
    },
    URL: {
      revokeObjectURL(url) {
        revokedUrls.push(url);
      },
    },
  };

  if (withObjectUrl) {
    host.URL.createObjectURL = () => 'blob:detection-clock';
  }

  if (withWorker) {
    host.Worker = class FakeWorker {
      constructor(url) {
        if (workerThrows) {
          throw new Error('worker creation blocked');
        }

        this.url = url;
        this.onmessage = null;
        this.onerror = null;
        this.isTerminated = false;
        workerInstance = this;
      }

      postMessage(message) {
        posted.push(message);
      }

      terminate() {
        this.isTerminated = true;
      }
    };
  }

  return {
    host,
    posted,
    revokedUrls: () => revokedUrls,
    worker: () => workerInstance,
    deliverTick(ticketId) {
      workerInstance.onmessage({ data: { type: 'tick', ticketId } });
    },
    deliverMessage(data) {
      workerInstance.onmessage({ data });
    },
    failWorker(error) {
      workerInstance.onerror(error);
    },
    pendingTimeoutCount: () => timeouts.size,
    pendingDelays: () => [...timeouts.values()].map(timer => timer.delayMs),
    fireAllTimeouts() {
      // Snapshot first — callbacks may arm new timers as they run.
      [...timeouts.entries()].forEach(([timerId, timer]) => {
        timeouts.delete(timerId);
        timer.callback();
      });
    },
  };
}

// spyOn is unusable in this suite: sound-names.spec.mjs replaces global.console
// at import time with objects that are already spies. Swap and restore instead.
function withSilencedConsole(run) {
  const originalError = console.error;
  const reported = [];
  console.error = (...args) => reported.push(args);

  try {
    return run(reported);
  } finally {
    console.error = originalError;
  }
}

describe('Detection clock scheduler', () => {
  let fake;
  let scheduler;

  beforeEach(() => {
    fake = null;
    scheduler = null;
  });

  afterEach(() => {
    if (scheduler) {
      scheduler.dispose();
      scheduler = null;
    }
  });

  describe('worker path', () => {
    beforeEach(() => {
      fake = createFakeHost();
      scheduler = createScheduler({ host: fake.host });
    });

    it('uses a worker when the host supports one', () => {
      expect(scheduler.kind).toBe(SCHEDULER_KIND.WORKER);
    });

    it('posts a schedule message carrying the ticket and delay', () => {
      const ticketId = scheduler.schedule(600, () => {});

      expect(fake.posted).toEqual([{ type: 'schedule', ticketId, delayMs: 600 }]);
    });

    it('runs the callback when its tick arrives', () => {
      let ran = 0;
      const ticketId = scheduler.schedule(600, () => {
        ran += 1;
      });

      fake.deliverTick(ticketId);

      expect(ran).toBe(1);
    });

    it('ignores a tick for a ticket cancelled while the message was in flight', () => {
      // A message already posted cannot be recalled, so cancellation has to be
      // enforced on arrival. Skipping this reintroduces the zombie-loop bug.
      let ran = 0;
      const ticketId = scheduler.schedule(600, () => {
        ran += 1;
      });

      scheduler.cancel(ticketId);
      fake.deliverTick(ticketId);

      expect(ran).toBe(0);
    });

    it('posts a cancel message for a cancelled ticket', () => {
      const ticketId = scheduler.schedule(600, () => {});
      scheduler.cancel(ticketId);

      expect(fake.posted).toContain({ type: 'cancel', ticketId });
    });

    it('ignores a tick for a ticket it never issued', () => {
      expect(() => fake.deliverTick(9999)).not.toThrow();
    });

    it('ignores worker messages that are not ticks', () => {
      let ran = 0;
      scheduler.schedule(600, () => {
        ran += 1;
      });

      fake.deliverMessage({ type: 'something-else', ticketId: 1 });

      expect(ran).toBe(0);
    });

    it('delivers a ticket only once', () => {
      let ran = 0;
      const ticketId = scheduler.schedule(600, () => {
        ran += 1;
      });

      fake.deliverTick(ticketId);
      fake.deliverTick(ticketId);

      expect(ran).toBe(1);
    });

    it('issues distinct tickets for concurrent schedules', () => {
      const first = scheduler.schedule(100, () => {});
      const second = scheduler.schedule(200, () => {});

      expect(first).not.toBe(second);
    });

    it('terminates the worker and revokes its object URL on dispose', () => {
      const worker = fake.worker();
      scheduler.dispose();

      expect(worker.isTerminated).toBe(true);
      expect(fake.revokedUrls()).toEqual(['blob:detection-clock']);
    });

    it('reports a worker failure to the caller and to the console', () => {
      const seen = [];
      scheduler.dispose();

      const errorFake = createFakeHost();
      scheduler = createScheduler({
        host: errorFake.host,
        onWorkerError: error => seen.push(error),
      });

      const failure = new Error('worker died');

      withSilencedConsole(reported => {
        errorFake.failWorker(failure);

        expect(reported.length).toBe(1);
      });

      expect(seen).toEqual([failure]);
    });

    it('survives a worker failure with no error handler registered', () => {
      scheduler.dispose();

      const errorFake = createFakeHost();
      scheduler = createScheduler({ host: errorFake.host });

      withSilencedConsole(() => {
        expect(() => errorFake.failWorker(new Error('worker died'))).not.toThrow();
      });
    });
  });

  describe('fallback path', () => {
    it('falls back to host timers when the host has no Worker', () => {
      fake = createFakeHost({ withWorker: false });
      scheduler = createScheduler({ host: fake.host });

      expect(scheduler.kind).toBe(SCHEDULER_KIND.TIMEOUT);
    });

    it('falls back when object URLs are unavailable', () => {
      // The jsdom and bare-node case: Blob exists, createObjectURL does not.
      fake = createFakeHost({ withObjectUrl: false });
      scheduler = createScheduler({ host: fake.host });

      expect(scheduler.kind).toBe(SCHEDULER_KIND.TIMEOUT);
    });

    it('falls back when the Worker constructor throws', () => {
      fake = createFakeHost({ workerThrows: true });
      scheduler = createScheduler({ host: fake.host });

      expect(scheduler.kind).toBe(SCHEDULER_KIND.TIMEOUT);
    });

    it('revokes the object URL when worker construction fails', () => {
      fake = createFakeHost({ workerThrows: true });
      scheduler = createScheduler({ host: fake.host });

      expect(fake.revokedUrls()).toEqual(['blob:detection-clock']);
    });

    it('falls back in an environment without a global Worker', () => {
      scheduler = createScheduler();

      expect(scheduler.kind).toBe(SCHEDULER_KIND.TIMEOUT);
    });

    it('runs the callback through a host timer at the requested delay', () => {
      fake = createFakeHost({ withWorker: false });
      scheduler = createScheduler({ host: fake.host });

      let ran = 0;
      scheduler.schedule(600, () => {
        ran += 1;
      });

      expect(fake.pendingDelays()).toEqual([600]);

      fake.fireAllTimeouts();

      expect(ran).toBe(1);
    });

    it('clears the host timer when a ticket is cancelled', () => {
      fake = createFakeHost({ withWorker: false });
      scheduler = createScheduler({ host: fake.host });

      let ran = 0;
      const ticketId = scheduler.schedule(600, () => {
        ran += 1;
      });

      scheduler.cancel(ticketId);
      fake.fireAllTimeouts();

      expect(ran).toBe(0);
      expect(fake.pendingTimeoutCount()).toBe(0);
    });

    it('clears pending host timers on dispose', () => {
      fake = createFakeHost({ withWorker: false });
      scheduler = createScheduler({ host: fake.host });

      scheduler.schedule(600, () => {});
      scheduler.schedule(900, () => {});
      scheduler.dispose();

      expect(fake.pendingTimeoutCount()).toBe(0);
    });
  });

  describe('lifecycle', () => {
    beforeEach(() => {
      fake = createFakeHost();
      scheduler = createScheduler({ host: fake.host });
    });

    it('is safe to dispose twice', () => {
      scheduler.dispose();

      expect(() => scheduler.dispose()).not.toThrow();
    });

    it('revokes the object URL only once across repeated disposals', () => {
      scheduler.dispose();
      scheduler.dispose();

      expect(fake.revokedUrls()).toEqual(['blob:detection-clock']);
    });

    it('refuses to schedule after disposal', () => {
      scheduler.dispose();

      expect(scheduler.schedule(600, () => {})).toBeNull();
    });

    it('treats cancelling an unknown ticket as a no-op', () => {
      expect(() => scheduler.cancel(4242)).not.toThrow();
      expect(() => scheduler.cancel(null)).not.toThrow();
    });
  });
});
