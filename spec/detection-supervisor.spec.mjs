import { DETECTION_CONFIG } from '../assets/detection-config.js';
import { LOOP_STATE } from '../assets/detection-loop.js';
import { createDetectionSupervisor, SUPERVISOR_MESSAGE } from '../assets/detection-supervisor.js';

// No jsdom and no fake timers. Every tunable that becomes a ticket delay is
// distinct, so a test can fire exactly the tickets it means to: frames (0, 600),
// failure backoff (1000), watchdog checks (5000), rebuild retry (15000), and
// the send timeout (60000), which tests with hanging sends never fire.

const TEST_CONFIG = Object.freeze({
  ...DETECTION_CONFIG,
  intervalMs: 600,
  idleIntervalMs: 1500,
  sendTimeoutMs: 60000,
  retryBackoffMs: 1000,
  maxRetryBackoffMs: 15000,
  maxConsecutiveFailures: 2,
  watchdogIntervalMs: 5000,
  staleThresholdMs: 20000,
  suspendGapMs: 60000,
  maxRebuildAttempts: 2,
  rebuildWindowMs: 300000,
});

const WATCHDOG_DELAY = TEST_CONFIG.watchdogIntervalMs;

function createSchedulerHarness() {
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
    fire(shouldFire) {
      // Snapshot first; skip tickets an earlier callback in this batch cancelled.
      [...tickets.entries()]
        .filter(([, ticket]) => shouldFire(ticket.delayMs))
        .forEach(([ticketId, ticket]) => {
          if (!tickets.has(ticketId)) {
            return;
          }

          tickets.delete(ticketId);
          ticket.callback();
        });
    },
  };
}

function flushMicrotasks() {
  return new Promise(resolve => setImmediate(resolve));
}

const onlyDelay = delayMs => ticketDelay => ticketDelay === delayMs;
const allButWatchdog = ticketDelay => ticketDelay !== WATCHDOG_DELAY;

describe('Detection supervisor', () => {
  let harness;
  let clock;
  let paused;
  let created;
  let log;
  let sent;
  let sendBehavior;
  let statuses;
  let originalWarn;
  let originalError;

  beforeEach(() => {
    harness = createSchedulerHarness();
    clock = 1000000;
    paused = false;
    created = [];
    log = [];
    sent = [];
    sendBehavior = () => Promise.resolve();
    statuses = [];

    // spyOn is unusable in this suite: sound-names.spec.mjs replaces
    // global.console at import time with objects that are already spies.
    originalWarn = console.warn;
    originalError = console.error;
    console.warn = () => {};
    console.error = () => {};
  });

  afterEach(() => {
    console.warn = originalWarn;
    console.error = originalError;
  });

  function createInstance() {
    const instance = { id: created.length + 1 };
    created.push(instance);
    log.push(`create:${instance.id}`);
    return Promise.resolve(instance);
  }

  function destroyInstance(instance) {
    log.push(`destroy:${instance ? instance.id : 'none'}`);
    return Promise.resolve();
  }

  function build(overrides = {}) {
    return createDetectionSupervisor({
      schedule: harness.schedule,
      cancel: harness.cancel,
      createInstance: overrides.createInstance || createInstance,
      destroyInstance: overrides.destroyInstance || destroyInstance,
      sendFrame: instance => {
        sent.push(instance.id);
        return sendBehavior(instance);
      },
      canSendFrame: overrides.canSendFrame,
      isPaused: () => paused,
      onLoading: message => statuses.push(['loading', message]),
      onReady: () => statuses.push(['ready']),
      onHalted: message => statuses.push(['halted', message]),
      now: () => clock,
      config: { ...TEST_CONFIG, ...overrides.config },
    });
  }

  async function fire(shouldFire) {
    harness.fire(shouldFire);
    await flushMicrotasks();
  }

  async function startRunning(supervisor) {
    supervisor.attachInstance(await createInstance());
    supervisor.markCameraReady();
  }

  function lastStatus() {
    return statuses[statuses.length - 1];
  }

  function failOnlyFirstInstance(instance) {
    return instance.id === 1 ? Promise.reject(new Error('webgl context lost')) : Promise.resolve();
  }

  describe('startup', () => {
    it('waits for both the camera and a model instance before sending', async () => {
      const supervisor = build();

      supervisor.attachInstance(await createInstance());
      await fire(() => true);
      expect(sent).toEqual([]);

      supervisor.markCameraReady();
      await fire(onlyDelay(0));

      expect(sent).toEqual([1]);
    });

    it('starts when the camera is ready before the model', async () => {
      const supervisor = build();

      supervisor.markCameraReady();
      expect(lastStatus()).toEqual(['loading', SUPERVISOR_MESSAGE.LOADING_MODELS]);

      supervisor.attachInstance(await createInstance());
      await fire(onlyDelay(0));

      expect(sent).toEqual([1]);
    });

    it('announces ready once, on the first successful frame', async () => {
      const supervisor = build();
      await startRunning(supervisor);

      await fire(onlyDelay(0));
      await fire(onlyDelay(600));

      expect(sent.length).toBe(2);
      expect(statuses.filter(([kind]) => kind === 'ready').length).toBe(1);
    });

    it('keeps its status when the camera reports ready again while running', async () => {
      const supervisor = build();
      await startRunning(supervisor);
      await fire(onlyDelay(0));

      const statusCount = statuses.length;
      supervisor.markCameraReady();

      expect(statuses.length).toBe(statusCount);
    });
  });

  describe('pausing', () => {
    it('stops sending while paused and resumes on unpause', async () => {
      const supervisor = build();
      await startRunning(supervisor);
      await fire(onlyDelay(0));

      paused = true;
      supervisor.setPaused(true);
      await fire(allButWatchdog);
      expect(sent.length).toBe(1);

      paused = false;
      supervisor.setPaused(false);
      await fire(onlyDelay(0));

      expect(sent.length).toBe(2);
    });
  });

  describe('recovery', () => {
    it('rebuilds after repeated frame failures, destroying the old instance before creating the new one', async () => {
      sendBehavior = failOnlyFirstInstance;
      const supervisor = build();
      await startRunning(supervisor);

      await fire(onlyDelay(0));
      await fire(onlyDelay(1000));

      expect(log).toEqual(['create:1', 'destroy:1', 'create:2']);
      expect(statuses).toContain(['loading', SUPERVISOR_MESSAGE.RECOVERING]);

      await fire(onlyDelay(0));

      expect(sent[sent.length - 1]).toBe(2);
      expect(lastStatus()).toEqual(['ready']);
    });

    it('rebuilds when the watchdog sees no results for too long', async () => {
      // A send that never settles, with its timeout never fired: only the
      // watchdog can notice.
      sendBehavior = () => new Promise(() => {});
      const supervisor = build();
      await startRunning(supervisor);
      await fire(onlyDelay(0));

      for (let check = 0; check < 5; check += 1) {
        clock += WATCHDOG_DELAY;
        await fire(onlyDelay(WATCHDOG_DELAY));
      }

      expect(log).toContain('create:2');
    });

    it('does not rebuild after a suspension-sized gap', async () => {
      // The wake-from-sleep case: stale for a legitimate reason.
      const supervisor = build();
      await startRunning(supervisor);
      await fire(onlyDelay(0));

      clock += WATCHDOG_DELAY;
      await fire(onlyDelay(WATCHDOG_DELAY));

      clock += 2 * TEST_CONFIG.suspendGapMs;
      await fire(onlyDelay(WATCHDOG_DELAY));

      expect(created.length).toBe(1);
    });

    it('treats a camera without frames as alive, not stale', async () => {
      const supervisor = build({ canSendFrame: () => false });
      await startRunning(supervisor);

      for (let check = 0; check < 6; check += 1) {
        clock += WATCHDOG_DELAY;
        await fire(() => true);
      }

      expect(sent).toEqual([]);
      expect(created.length).toBe(1);
    });

    it('sends nothing while a rebuild is still destroying the old instance', async () => {
      let finishDestroying;
      sendBehavior = failOnlyFirstInstance;
      const supervisor = build({
        destroyInstance: () =>
          new Promise(resolve => {
            finishDestroying = resolve;
          }),
      });
      await startRunning(supervisor);

      await fire(onlyDelay(0));
      await fire(onlyDelay(1000));
      const sentDuringRebuild = sent.length;

      supervisor.setPaused(false);
      supervisor.markCameraReady();
      await fire(allButWatchdog);

      expect(sent.length).toBe(sentDuringRebuild);
      expect(created.length).toBe(1);

      finishDestroying();
      await flushMicrotasks();

      expect(created.length).toBe(2);
    });

    it('retries a rebuild whose new instance failed to build', async () => {
      let shouldFailNextCreate = false;
      sendBehavior = failOnlyFirstInstance;
      const supervisor = build({
        createInstance: () => {
          if (shouldFailNextCreate) {
            shouldFailNextCreate = false;
            return Promise.reject(new Error('offline'));
          }

          return createInstance();
        },
      });
      await startRunning(supervisor);

      shouldFailNextCreate = true;
      await fire(onlyDelay(0));
      await fire(onlyDelay(1000));
      expect(created.length).toBe(1);

      await fire(onlyDelay(TEST_CONFIG.maxRetryBackoffMs));
      expect(created.length).toBe(2);

      await fire(onlyDelay(0));
      expect(sent[sent.length - 1]).toBe(2);
    });

    it('reports the paused status when a rebuild finishes while paused', async () => {
      sendBehavior = failOnlyFirstInstance;
      const supervisor = build();
      await startRunning(supervisor);
      await fire(onlyDelay(0));

      paused = true;
      await fire(onlyDelay(1000));

      expect(created.length).toBe(2);
      expect(lastStatus()).toEqual(['ready']);

      await fire(allButWatchdog);
      expect(sent.every(id => id === 1)).toBe(true);
    });
  });

  describe('rebuild budget', () => {
    it('halts once the rebuild budget is spent', async () => {
      sendBehavior = () => Promise.reject(new Error('gpu gone'));
      const supervisor = build({ config: { maxConsecutiveFailures: 1 } });
      await startRunning(supervisor);

      for (let attempt = 0; attempt < 6; attempt += 1) {
        await fire(allButWatchdog);
      }

      // The original instance plus maxRebuildAttempts (2).
      expect(created.length).toBe(3);
      expect(lastStatus()).toEqual(['halted', SUPERVISOR_MESSAGE.HALTED]);
      expect(supervisor.getStatus().loop.state).toBe(LOOP_STATE.IDLE);
    });

    it('allows rebuilds again once earlier ones leave the window', async () => {
      sendBehavior = () => Promise.reject(new Error('gpu gone'));
      const supervisor = build({ config: { maxConsecutiveFailures: 1 } });
      await startRunning(supervisor);

      await fire(allButWatchdog);
      await fire(allButWatchdog);

      clock += TEST_CONFIG.rebuildWindowMs;
      await fire(allButWatchdog);

      expect(created.length).toBe(4);
      expect(supervisor.getStatus().isHalted).toBe(false);
    });
  });

  describe('halting', () => {
    it('stops detection and re-announces itself when unpaused', async () => {
      const supervisor = build();
      await startRunning(supervisor);
      await fire(onlyDelay(0));

      supervisor.halt('the clock worker failed', 'Detection clock failed.');
      const sentAtHalt = sent.length;

      await fire(allButWatchdog);
      expect(sent.length).toBe(sentAtHalt);

      supervisor.setPaused(false);
      expect(lastStatus()).toEqual(['halted', 'Detection clock failed.']);
    });

    it('never starts once halted, even when an instance arrives later', async () => {
      const supervisor = build();
      supervisor.halt('the model failed to load', 'Failed to load.');

      supervisor.markCameraReady();
      supervisor.attachInstance(await createInstance());
      await fire(() => true);

      expect(sent).toEqual([]);
    });
  });
});
