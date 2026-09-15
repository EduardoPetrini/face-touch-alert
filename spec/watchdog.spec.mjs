import { DETECTION_CONFIG } from '../assets/detection-config.js';
import { createWatchdog, WATCHDOG_VERDICT } from '../assets/watchdog.js';

// No jsdom: the watchdog takes an injectable clock and owns no timers.

describe('Watchdog', () => {
  const STALE_THRESHOLD_MS = 20000;
  const SUSPEND_GAP_MS = 60000;

  let currentTime;
  let watchdog;

  function advance(ms) {
    currentTime += ms;
  }

  beforeEach(() => {
    currentTime = 1000;
    watchdog = createWatchdog({
      now: () => currentTime,
      config: {
        ...DETECTION_CONFIG,
        staleThresholdMs: STALE_THRESHOLD_MS,
        suspendGapMs: SUSPEND_GAP_MS,
      },
    });
  });

  it('reports inactive until monitoring is switched on', () => {
    expect(watchdog.check()).toBe(WATCHDOG_VERDICT.INACTIVE);
  });

  it('never reports stale while inactive, however long the silence', () => {
    advance(10 * SUSPEND_GAP_MS);

    expect(watchdog.check()).toBe(WATCHDOG_VERDICT.INACTIVE);
  });

  it('reports healthy shortly after activation', () => {
    watchdog.markActive(true);
    advance(5000);

    expect(watchdog.check()).toBe(WATCHDOG_VERDICT.HEALTHY);
  });

  it('reports stale once results stop arriving for longer than the threshold', () => {
    watchdog.markActive(true);

    advance(5000);
    expect(watchdog.check()).toBe(WATCHDOG_VERDICT.HEALTHY);

    advance(STALE_THRESHOLD_MS + 1);
    expect(watchdog.check()).toBe(WATCHDOG_VERDICT.STALE);
  });

  it('stays healthy while results keep arriving', () => {
    watchdog.markActive(true);

    for (let index = 0; index < 10; index += 1) {
      advance(STALE_THRESHOLD_MS - 1000);
      watchdog.recordResult();
      expect(watchdog.check()).toBe(WATCHDOG_VERDICT.HEALTHY);
    }
  });

  it('reports suspended rather than stale after a sleep-sized gap between checks', () => {
    // The anti-rebuild-storm test. Waking from sleep must not trigger recovery.
    watchdog.markActive(true);

    advance(5000);
    expect(watchdog.check()).toBe(WATCHDOG_VERDICT.HEALTHY);

    advance(2 * SUSPEND_GAP_MS);
    expect(watchdog.check()).toBe(WATCHDOG_VERDICT.SUSPENDED);
  });

  it('re-baselines after a suspension so the next check is healthy', () => {
    watchdog.markActive(true);

    advance(5000);
    watchdog.check();

    advance(2 * SUSPEND_GAP_MS);
    expect(watchdog.check()).toBe(WATCHDOG_VERDICT.SUSPENDED);

    advance(5000);
    expect(watchdog.check()).toBe(WATCHDOG_VERDICT.HEALTHY);
  });

  it('still reports stale when the gap between checks stays below the suspend threshold', () => {
    watchdog.markActive(true);

    advance(5000);
    watchdog.check();

    advance(SUSPEND_GAP_MS - 1);
    expect(watchdog.check()).toBe(WATCHDOG_VERDICT.STALE);
  });

  it('clears staleness on reset', () => {
    watchdog.markActive(true);

    advance(STALE_THRESHOLD_MS + 1);
    expect(watchdog.check()).toBe(WATCHDOG_VERDICT.STALE);

    watchdog.reset();
    expect(watchdog.check()).toBe(WATCHDOG_VERDICT.HEALTHY);
  });

  it('does not read the pause around a reset as a suspension', () => {
    // A rebuild calls reset() before restarting the loop; the gap it introduces
    // must not be reported as a suspension on the next check.
    watchdog.markActive(true);

    advance(5000);
    watchdog.check();

    advance(2 * SUSPEND_GAP_MS);
    watchdog.reset();

    expect(watchdog.check()).toBe(WATCHDOG_VERDICT.HEALTHY);
  });

  it('re-baselines when monitoring is switched back on', () => {
    watchdog.markActive(true);
    advance(5000);
    watchdog.check();

    watchdog.markActive(false);
    advance(10 * STALE_THRESHOLD_MS);
    expect(watchdog.check()).toBe(WATCHDOG_VERDICT.INACTIVE);

    watchdog.markActive(true);
    expect(watchdog.check()).toBe(WATCHDOG_VERDICT.HEALTHY);
  });

  it('ignores a repeated markActive with the same value', () => {
    watchdog.markActive(true);
    advance(STALE_THRESHOLD_MS + 1);

    // A redundant markActive(true) must not silently reset the baseline.
    watchdog.markActive(true);

    expect(watchdog.check()).toBe(WATCHDOG_VERDICT.STALE);
  });

  it('exposes how long it has been since the last result', () => {
    watchdog.markActive(true);
    watchdog.recordResult();
    advance(7000);

    const status = watchdog.getStatus();

    expect(status.isActive).toBe(true);
    expect(status.msSinceLastResult).toBe(7000);
  });
});
