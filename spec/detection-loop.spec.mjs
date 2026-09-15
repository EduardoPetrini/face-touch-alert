import { DETECTION_CONFIG } from '../assets/detection-config.js';
import { createDetectionLoop, LOOP_EVENT, LOOP_STATE, SKIP_REASON } from '../assets/detection-loop.js';

// No jsdom and no fake timers: the loop owns no timers, so a plain ticket map
// is a complete stand-in for the scheduler and lets each tick be driven by hand.

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
    pendingCount() {
      return tickets.size;
    },
    pendingDelays() {
      return [...tickets.values()].map(ticket => ticket.delayMs);
    },
    fireAll() {
      // Snapshot first — callbacks schedule new tickets as they run.
      [...tickets.entries()].forEach(([ticketId, ticket]) => {
        tickets.delete(ticketId);
        ticket.callback();
      });
    },
  };
}

function createDeferredSender() {
  let pending = [];

  return {
    sendFrame: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
    inFlightCount: () => pending.length,
    settleAll() {
      const settling = pending;
      pending = [];
      settling.forEach(deferred => deferred.resolve());
    },
  };
}

function flushMicrotasks() {
  return new Promise(resolve => setImmediate(resolve));
}

describe('Detection loop', () => {
  let harness;
  let events;
  let sendCount;

  beforeEach(() => {
    harness = createSchedulerHarness();
    events = [];
    sendCount = 0;
  });

  function build({ sendFrame, canSendFrame, getIntervalMs, onEvent, config } = {}) {
    return createDetectionLoop({
      schedule: harness.schedule,
      cancel: harness.cancel,
      sendFrame:
        sendFrame ||
        (() => {
          sendCount += 1;
          return Promise.resolve();
        }),
      canSendFrame,
      getIntervalMs,
      onEvent: onEvent || (event => events.push(event)),
      config: { ...DETECTION_CONFIG, ...config },
    });
  }

  async function tick() {
    harness.fireAll();
    await flushMicrotasks();
  }

  function eventTypes() {
    return events.map(event => event.type);
  }

  it('schedules and runs a first frame on start', async () => {
    const loop = build();

    expect(loop.start()).toBe(true);
    expect(loop.getState()).toBe(LOOP_STATE.RUNNING);
    expect(harness.pendingCount()).toBe(1);

    await tick();

    expect(sendCount).toBe(1);
    expect(eventTypes()).toContain(LOOP_EVENT.FRAME_OK);
  });

  it('resolves a hung send as a timeout and still schedules the next frame', async () => {
    // The regression test for the deadlock: a send that never settles used to
    // leave isInferenceInFlight stuck true and no timer scheduled, forever.
    const deferred = createDeferredSender();
    const loop = build({ sendFrame: deferred.sendFrame });

    loop.start();
    await tick();

    expect(deferred.inFlightCount()).toBe(1);
    expect(loop.getStats().isInFlight).toBe(true);

    // Fire the timeout ticket without ever settling the send.
    await tick();

    expect(eventTypes()).toContain(LOOP_EVENT.FRAME_TIMEOUT);
    expect(loop.getStats().isInFlight).toBe(false);
    expect(harness.pendingCount()).toBe(1);
  });

  it('sends again after a timeout because the in-flight slot was released', async () => {
    const deferred = createDeferredSender();
    const loop = build({ sendFrame: deferred.sendFrame });

    loop.start();
    await tick();
    await tick();

    expect(deferred.inFlightCount()).toBe(1);

    await tick();

    expect(deferred.inFlightCount()).toBe(2);
  });

  it('holds only the send timeout while an inference is in flight', async () => {
    // Back-pressure: no frame is queued behind a running inference.
    const deferred = createDeferredSender();
    const loop = build({ sendFrame: deferred.sendFrame, config: { sendTimeoutMs: 5000 } });

    loop.start();
    await tick();

    expect(harness.pendingDelays()).toEqual([5000]);
  });

  it('leaves exactly one chain when stopped mid-inference and restarted', async () => {
    const deferred = createDeferredSender();
    const loop = build({ sendFrame: deferred.sendFrame });

    loop.start();
    await tick();
    expect(deferred.inFlightCount()).toBe(1);

    loop.stop();
    loop.start();

    // Settle the orphaned send from the stopped generation.
    deferred.settleAll();
    await flushMicrotasks();

    // One pending ticket means one chain. Two would mean the zombie-loop bug.
    expect(harness.pendingCount()).toBe(1);

    await tick();
    expect(deferred.inFlightCount()).toBe(1);

    deferred.settleAll();
    await flushMicrotasks();

    expect(harness.pendingCount()).toBe(1);
  });

  it('restarts cleanly after a stop', async () => {
    const loop = build();

    loop.start();
    await tick();
    expect(sendCount).toBe(1);

    expect(loop.stop()).toBe(true);
    expect(loop.getState()).toBe(LOOP_STATE.IDLE);
    expect(harness.pendingCount()).toBe(0);

    expect(loop.start()).toBe(true);
    await tick();

    expect(sendCount).toBe(2);
  });

  it('ignores a second start while already running', () => {
    const loop = build();

    expect(loop.start()).toBe(true);
    expect(loop.start()).toBe(false);
    expect(harness.pendingCount()).toBe(1);
  });

  it('treats a repeated stop as a no-op', () => {
    const loop = build();

    loop.start();

    expect(loop.stop()).toBe(true);
    expect(loop.stop()).toBe(false);
    expect(harness.pendingCount()).toBe(0);
  });

  it('backs off exponentially and escalates to stalled only at the threshold', async () => {
    const loop = build({
      sendFrame: () => Promise.reject(new Error('webgl context lost')),
      config: { retryBackoffMs: 1000, maxRetryBackoffMs: 15000, maxConsecutiveFailures: 3 },
    });

    loop.start();

    await tick();
    expect(harness.pendingDelays()).toEqual([1000]);
    expect(eventTypes().filter(type => type === LOOP_EVENT.STALLED).length).toBe(0);

    await tick();
    expect(harness.pendingDelays()).toEqual([2000]);
    expect(eventTypes().filter(type => type === LOOP_EVENT.STALLED).length).toBe(0);

    await tick();
    expect(harness.pendingDelays()).toEqual([4000]);
    expect(eventTypes().filter(type => type === LOOP_EVENT.STALLED).length).toBe(1);
    expect(loop.getStats().framesError).toBe(3);
  });

  it('caps the backoff at the configured ceiling', async () => {
    const loop = build({
      sendFrame: () => Promise.reject(new Error('nope')),
      config: { retryBackoffMs: 1000, maxRetryBackoffMs: 2500, maxConsecutiveFailures: 99 },
    });

    loop.start();

    await tick();
    await tick();
    await tick();

    expect(harness.pendingDelays()).toEqual([2500]);
  });

  it('recovers its failure count after a successful frame', async () => {
    let shouldFail = true;
    const loop = build({
      sendFrame: () => (shouldFail ? Promise.reject(new Error('transient')) : Promise.resolve()),
    });

    loop.start();
    await tick();
    expect(loop.getStats().consecutiveFailures).toBe(1);

    shouldFail = false;
    await tick();

    expect(loop.getStats().consecutiveFailures).toBe(0);
    expect(loop.getStats().framesOk).toBe(1);
  });

  it('skips the inference and waits the idle interval when the camera has no frame', async () => {
    const loop = build({
      sendFrame: () => {
        sendCount += 1;
        return Promise.resolve();
      },
      canSendFrame: () => false,
      config: { idleIntervalMs: 1500 },
    });

    loop.start();
    await tick();

    expect(sendCount).toBe(0);
    expect(harness.pendingDelays()).toEqual([1500]);
    expect(events.some(event => event.reason === SKIP_REASON.NOT_READY)).toBe(true);
  });

  it('uses the injected interval for the next frame after a success', async () => {
    const loop = build({ getIntervalMs: () => 999 });

    loop.start();
    await tick();

    expect(harness.pendingDelays()).toEqual([999]);
  });

  it('falls back to the configured interval when the injected one is not a positive number', async () => {
    const loop = build({ getIntervalMs: () => undefined, config: { intervalMs: 600 } });

    loop.start();
    await tick();

    expect(harness.pendingDelays()).toEqual([600]);
  });

  it('keeps running when an event listener throws', async () => {
    // spyOn is unusable here: sound-names.spec.mjs replaces global.console at
    // import time with objects that are already spies. Swap and restore instead.
    const originalConsoleError = console.error;
    const reported = [];
    console.error = (...args) => reported.push(args);

    try {
      const loop = build({
        onEvent: () => {
          throw new Error('listener blew up');
        },
      });

      loop.start();
      await tick();

      expect(loop.getState()).toBe(LOOP_STATE.RUNNING);
      expect(harness.pendingCount()).toBe(1);
      expect(reported.length).toBeGreaterThan(0);
    } finally {
      console.error = originalConsoleError;
    }
  });

  it('does not resurrect itself when a listener stops it mid-event', async () => {
    let loop;

    loop = build({
      onEvent: event => {
        events.push(event);

        if (event.type === LOOP_EVENT.FRAME_OK) {
          loop.stop();
        }
      },
    });

    loop.start();
    await tick();

    expect(loop.getState()).toBe(LOOP_STATE.IDLE);
    expect(harness.pendingCount()).toBe(0);
  });
});
