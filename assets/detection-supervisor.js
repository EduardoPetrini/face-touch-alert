import { DETECTION_CONFIG } from './detection-config.js';
import { createDetectionLoop, LOOP_EVENT, LOOP_STATE, SKIP_REASON } from './detection-loop.js';
import { createWatchdog, WATCHDOG_VERDICT } from './watchdog.js';

// Owns the detection pipeline's lifecycle: when the loop may run, what its
// events mean for the app, and how a wedged model instance gets replaced.
// No DOM and no state store — both arrive as injected callbacks, so a failure
// can never feed back through a state subscriber and restart the loop.
//
// Rebuild ordering is load-bearing:
//   1. stop the loop              nothing may send to an instance being destroyed
//   2. announce recovery
//   3. destroy the old instance   bounded — close() can hang on a wedged instance
//   4. create a new one
//   5. restart                    markActive(true) re-baselines the watchdog, so the
//                                 fresh loop cannot inherit a stale lastResultAt
//                                 and immediately trigger another rebuild
// A budget caps how often this may happen. Without it a broken GPU driver turns
// into an endless rebuild loop, which is worse than the original bug.

export const SUPERVISOR_MESSAGE = Object.freeze({
  LOADING_MODELS: 'Loading AI models...',
  STARTING: 'Starting detection...',
  RECOVERING: 'Recovering detection...',
  HALTED: 'Detection keeps failing. Please reload the page.',
});

export function createDetectionSupervisor({
  schedule,
  cancel,
  createInstance,
  destroyInstance,
  sendFrame,
  canSendFrame = () => true,
  getIntervalMs = null,
  isPaused = () => false,
  onLoading = () => {},
  onReady = () => {},
  onHalted = () => {},
  now = Date.now,
  config = DETECTION_CONFIG,
}) {
  let instance = null;
  let isCameraReady = false;
  let isRebuilding = false;
  let isHalted = false;
  let haltMessage = SUPERVISOR_MESSAGE.HALTED;
  let isAwaitingFirstFrame = false;
  let isWatchdogScheduled = false;
  let recentRebuildTimes = [];

  const watchdog = createWatchdog({ now, config });

  const loop = createDetectionLoop({
    schedule,
    cancel,
    now,
    config,
    canSendFrame,
    getIntervalMs,
    sendFrame: () => sendFrame(instance),
    onEvent: handleLoopEvent,
  });

  function canRun() {
    return !isHalted && !isRebuilding && isCameraReady && Boolean(instance) && !isPaused();
  }

  function isLoopRunning() {
    return loop.getState() === LOOP_STATE.RUNNING;
  }

  function startPipeline() {
    if (!canRun() || isLoopRunning()) {
      return false;
    }

    isAwaitingFirstFrame = true;
    watchdog.markActive(true);
    loop.start();
    scheduleWatchdogCheck();

    return true;
  }

  function stopPipeline() {
    loop.stop();
    watchdog.markActive(false);
  }

  // One-shot and re-armed after each check, like the loop, so at most one
  // watchdog chain ever exists.
  function scheduleWatchdogCheck() {
    if (isWatchdogScheduled || isHalted) {
      return;
    }

    isWatchdogScheduled = true;

    schedule(config.watchdogIntervalMs, () => {
      isWatchdogScheduled = false;
      runWatchdogCheck();
      scheduleWatchdogCheck();
    });
  }

  function runWatchdogCheck() {
    const verdict = watchdog.check();

    if (verdict === WATCHDOG_VERDICT.SUSPENDED) {
      console.warn('Detection was suspended (page frozen or machine asleep); resuming without a rebuild.');
      return;
    }

    if (verdict === WATCHDOG_VERDICT.STALE) {
      rebuild('no detection results within the stale threshold');
    }
  }

  function handleLoopEvent(event) {
    switch (event.type) {
      case LOOP_EVENT.FRAME_OK:
        watchdog.recordResult();

        if (isAwaitingFirstFrame) {
          isAwaitingFirstFrame = false;
          onReady();
        }

        return;
      case LOOP_EVENT.FRAME_SKIPPED:
        // No camera frame yet is not a pipeline failure: the loop is alive and
        // ticking. Camera stalls need their own handling.
        if (event.reason === SKIP_REASON.NOT_READY) {
          watchdog.recordResult();
        }

        return;
      case LOOP_EVENT.FRAME_TIMEOUT:
        console.warn(`Detection frame timed out (${event.consecutiveFailures} in a row).`);
        return;
      case LOOP_EVENT.FRAME_ERROR:
        console.warn(`Detection frame failed (${event.consecutiveFailures} in a row):`, event.error);
        return;
      case LOOP_EVENT.STALLED:
        rebuild('repeated frame failures');
        return;
      default:
        return;
    }
  }

  async function rebuild(reason) {
    if (isRebuilding || isHalted) {
      return;
    }

    const currentTime = now();
    recentRebuildTimes = recentRebuildTimes.filter(time => currentTime - time < config.rebuildWindowMs);

    if (recentRebuildTimes.length >= config.maxRebuildAttempts) {
      halt(`gave up after ${recentRebuildTimes.length} rebuilds within ${config.rebuildWindowMs}ms (last cause: ${reason})`);
      return;
    }

    recentRebuildTimes = [...recentRebuildTimes, currentTime];
    isRebuilding = true;
    console.warn(`Rebuilding detection pipeline: ${reason}.`);

    let nextInstance = null;

    // try/finally so no throw — even from a status callback — can leave
    // isRebuilding stuck true, which would block every future recovery.
    try {
      stopPipeline();
      onLoading(SUPERVISOR_MESSAGE.RECOVERING);

      const previousInstance = instance;
      instance = null;

      await destroyInstance(previousInstance);
      nextInstance = await createInstance();
    } catch (error) {
      console.error('Detection pipeline rebuild failed:', error);
    } finally {
      isRebuilding = false;
    }

    if (!nextInstance) {
      // The watchdog is inactive while no instance runs, so nothing else would
      // retry. The budget above bounds how often this can repeat.
      schedule(config.maxRetryBackoffMs, () => {
        rebuild('the previous rebuild failed');
      });
      return;
    }

    instance = nextInstance;

    if (isHalted) {
      return;
    }

    if (isPaused()) {
      // Resolves to the paused status instead of leaving "Recovering" on screen.
      onReady();
      return;
    }

    startPipeline();
  }

  function halt(reason, message = SUPERVISOR_MESSAGE.HALTED) {
    if (!isHalted) {
      isHalted = true;
      haltMessage = message;
      stopPipeline();
      console.error(`Detection halted: ${reason}.`);
    }

    onHalted(haltMessage);
  }

  function attachInstance(nextInstance) {
    instance = nextInstance;
    return startPipeline();
  }

  function markCameraReady() {
    isCameraReady = true;

    // A repeat metadata event while running must not put "Starting" back on screen.
    if (isHalted || isLoopRunning()) {
      return false;
    }

    if (isPaused()) {
      onReady();
      return false;
    }

    onLoading(instance ? SUPERVISOR_MESSAGE.STARTING : SUPERVISOR_MESSAGE.LOADING_MODELS);
    return startPipeline();
  }

  function setPaused(nextIsPaused) {
    if (nextIsPaused) {
      stopPipeline();
      return;
    }

    // Unpausing overwrites the status with "active"; a halted pipeline must say so again.
    if (isHalted) {
      onHalted(haltMessage);
      return;
    }

    startPipeline();
  }

  function stop() {
    stopPipeline();
  }

  function getStatus() {
    return {
      isHalted,
      isRebuilding,
      isCameraReady,
      hasInstance: Boolean(instance),
      rebuildsInWindow: recentRebuildTimes.length,
      loop: loop.getStats(),
      watchdog: watchdog.getStatus(),
    };
  }

  return { attachInstance, markCameraReady, setPaused, halt, stop, getStatus };
}
