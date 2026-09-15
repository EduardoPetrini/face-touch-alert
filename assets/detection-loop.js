import { DETECTION_CONFIG } from './detection-config.js';

// A pure, injectable detection loop. No DOM, no timers of its own, no state store.
//
// Three invariants matter, each of them a bug that used to brick the app:
//   1. Every inference settles. A send that hangs forever is resolved as a timeout,
//      so the in-flight slot is always released and the next frame is always scheduled.
//   2. Work is owned by a generation. start()/stop() bump it; a continuation whose
//      generation is stale returns without rescheduling, so chains never duplicate.
//   3. The loop only emits events. It never calls into the state store, so an error
//      cannot feed back through a subscriber and restart the loop underneath itself.

export const LOOP_STATE = Object.freeze({
  IDLE: 'idle',
  RUNNING: 'running',
});

export const LOOP_EVENT = Object.freeze({
  STARTED: 'started',
  STOPPED: 'stopped',
  FRAME_OK: 'frame-ok',
  FRAME_ERROR: 'frame-error',
  FRAME_TIMEOUT: 'frame-timeout',
  FRAME_SKIPPED: 'frame-skipped',
  STALLED: 'stalled',
});

export const FRAME_OUTCOME = Object.freeze({
  OK: 'ok',
  ERROR: 'error',
  TIMEOUT: 'timeout',
});

export const SKIP_REASON = Object.freeze({
  IN_FLIGHT: 'in-flight',
  NOT_READY: 'not-ready',
});

export function createDetectionLoop({
  schedule,
  cancel,
  sendFrame,
  now = Date.now,
  canSendFrame = () => true,
  getIntervalMs = null,
  onEvent = () => {},
  config = DETECTION_CONFIG,
}) {
  let state = LOOP_STATE.IDLE;
  let generation = 0;
  let inFlightGeneration = null;
  let frameTicket = null;
  let consecutiveFailures = 0;

  const stats = {
    framesOk: 0,
    framesError: 0,
    framesTimeout: 0,
    framesSkipped: 0,
    lastFrameAt: null,
  };

  // A listener that throws must not take the loop down with it.
  function emit(type, detail) {
    try {
      onEvent({ type, ...detail });
    } catch (error) {
      console.error('Detection loop listener failed:', error);
    }
  }

  function resolveIntervalMs() {
    if (typeof getIntervalMs !== 'function') {
      return config.intervalMs;
    }

    const interval = getIntervalMs();
    return Number.isFinite(interval) && interval > 0 ? interval : config.intervalMs;
  }

  function resolveBackoffMs() {
    const exponential = config.retryBackoffMs * 2 ** (consecutiveFailures - 1);
    return Math.min(exponential, config.maxRetryBackoffMs);
  }

  // Guarded on both state and generation: an event listener may have called
  // stop() (state clears) or restarted us (generation moves on) while we were
  // emitting, and in either case this chain must not schedule anything more.
  function scheduleFrame(delayMs, myGeneration) {
    if (state !== LOOP_STATE.RUNNING || myGeneration !== generation) {
      return;
    }

    frameTicket = schedule(delayMs, () => {
      frameTicket = null;

      if (myGeneration !== generation) {
        return;
      }

      runFrame(myGeneration);
    });
  }

  // Resolves a discriminated outcome instead of rejecting, so the caller has
  // exactly one settlement path to reason about.
  function sendFrameWithTimeout() {
    return new Promise(resolve => {
      let isSettled = false;
      let timeoutTicket = null;

      const settle = outcome => {
        if (isSettled) {
          return;
        }

        isSettled = true;

        if (timeoutTicket !== null) {
          cancel(timeoutTicket);
          timeoutTicket = null;
        }

        resolve(outcome);
      };

      timeoutTicket = schedule(config.sendTimeoutMs, () => settle({ kind: FRAME_OUTCOME.TIMEOUT }));

      // Promise.resolve().then() so a synchronous throw from sendFrame lands here too.
      Promise.resolve()
        .then(() => sendFrame())
        .then(
          () => settle({ kind: FRAME_OUTCOME.OK }),
          error => settle({ kind: FRAME_OUTCOME.ERROR, error })
        );
    });
  }

  async function runFrame(myGeneration) {
    if (myGeneration !== generation || state !== LOOP_STATE.RUNNING) {
      return;
    }

    if (inFlightGeneration !== null) {
      stats.framesSkipped += 1;
      emit(LOOP_EVENT.FRAME_SKIPPED, { reason: SKIP_REASON.IN_FLIGHT });
      scheduleFrame(resolveIntervalMs(), myGeneration);
      return;
    }

    if (!canSendFrame()) {
      stats.framesSkipped += 1;
      emit(LOOP_EVENT.FRAME_SKIPPED, { reason: SKIP_REASON.NOT_READY });
      scheduleFrame(config.idleIntervalMs, myGeneration);
      return;
    }

    inFlightGeneration = myGeneration;
    const startedAt = now();
    const outcome = await sendFrameWithTimeout();

    // Only release the slot if it is still ours — a restart already cleared it.
    if (inFlightGeneration === myGeneration) {
      inFlightGeneration = null;
    }

    if (myGeneration !== generation || state !== LOOP_STATE.RUNNING) {
      return;
    }

    const durationMs = now() - startedAt;

    if (outcome.kind === FRAME_OUTCOME.OK) {
      consecutiveFailures = 0;
      stats.framesOk += 1;
      stats.lastFrameAt = now();
      emit(LOOP_EVENT.FRAME_OK, { durationMs });
      scheduleFrame(resolveIntervalMs(), myGeneration);
      return;
    }

    consecutiveFailures += 1;

    if (outcome.kind === FRAME_OUTCOME.TIMEOUT) {
      stats.framesTimeout += 1;
      emit(LOOP_EVENT.FRAME_TIMEOUT, { durationMs, consecutiveFailures });
    } else {
      stats.framesError += 1;
      emit(LOOP_EVENT.FRAME_ERROR, { error: outcome.error, durationMs, consecutiveFailures });
    }

    if (consecutiveFailures >= config.maxConsecutiveFailures) {
      // The supervisor decides what this means. If it does nothing we keep
      // retrying at the backoff ceiling rather than going quiet.
      emit(LOOP_EVENT.STALLED, { consecutiveFailures });
    }

    scheduleFrame(resolveBackoffMs(), myGeneration);
  }

  function start() {
    if (state === LOOP_STATE.RUNNING) {
      return false;
    }

    generation += 1;
    state = LOOP_STATE.RUNNING;
    consecutiveFailures = 0;
    inFlightGeneration = null;

    const myGeneration = generation;
    emit(LOOP_EVENT.STARTED, { generation: myGeneration });
    scheduleFrame(0, myGeneration);

    return true;
  }

  function stop() {
    if (state === LOOP_STATE.IDLE) {
      return false;
    }

    state = LOOP_STATE.IDLE;
    // Orphans every in-flight continuation.
    generation += 1;
    inFlightGeneration = null;

    if (frameTicket !== null) {
      cancel(frameTicket);
      frameTicket = null;
    }

    emit(LOOP_EVENT.STOPPED, {});

    return true;
  }

  function getState() {
    return state;
  }

  function getStats() {
    return {
      ...stats,
      state,
      generation,
      consecutiveFailures,
      isInFlight: inFlightGeneration !== null,
    };
  }

  return { start, stop, getState, getStats };
}
