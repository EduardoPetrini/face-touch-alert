import { DETECTION_CONFIG } from './detection-config.js';

// Staleness detector for the detection pipeline. Pure: it owns no timers and
// touches no DOM — the supervisor calls check() on a scheduler tick.
//
// The SUSPENDED verdict is the reason this is not a one-line timestamp compare.
// If the machine slept or the page froze, results are stale for a legitimate
// reason. Rebuilding then would mean a rebuild storm on every wake, so a
// wall-clock gap between checks that dwarfs the polling interval re-baselines
// instead of escalating.

export const WATCHDOG_VERDICT = Object.freeze({
  HEALTHY: 'healthy',
  STALE: 'stale',
  SUSPENDED: 'suspended',
  INACTIVE: 'inactive',
});

export function createWatchdog({ now = Date.now, config = DETECTION_CONFIG } = {}) {
  let isActive = false;
  let lastResultAt = null;
  let lastCheckAt = null;

  // Re-baseline. Clearing lastCheckAt matters: the next check must not read the
  // pause around a rebuild as a suspension.
  function reset() {
    lastResultAt = now();
    lastCheckAt = null;
  }

  function recordResult() {
    lastResultAt = now();
  }

  function markActive(nextIsActive) {
    const active = Boolean(nextIsActive);

    if (active === isActive) {
      return;
    }

    isActive = active;

    // Resuming must not instantly look stale for the time spent inactive.
    if (active) {
      reset();
    }
  }

  function check() {
    const currentTime = now();
    const previousCheckAt = lastCheckAt;
    lastCheckAt = currentTime;

    if (!isActive) {
      return WATCHDOG_VERDICT.INACTIVE;
    }

    if (previousCheckAt !== null && currentTime - previousCheckAt >= config.suspendGapMs) {
      lastResultAt = currentTime;
      return WATCHDOG_VERDICT.SUSPENDED;
    }

    if (lastResultAt === null) {
      lastResultAt = currentTime;
      return WATCHDOG_VERDICT.HEALTHY;
    }

    if (currentTime - lastResultAt > config.staleThresholdMs) {
      return WATCHDOG_VERDICT.STALE;
    }

    return WATCHDOG_VERDICT.HEALTHY;
  }

  function getStatus() {
    return {
      isActive,
      lastResultAt,
      msSinceLastResult: lastResultAt === null ? null : now() - lastResultAt,
    };
  }

  return { reset, recordResult, markActive, check, getStatus };
}
