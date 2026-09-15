// Tunables for the detection loop, the watchdog, and pipeline recovery.
// Kept in one frozen object so specs can override a single value without
// reaching into module internals.

export const DETECTION_CONFIG = Object.freeze({
  // Cadence between inferences while the tab is visible.
  intervalMs: 600,
  // Slower cadence while hidden without a pop-out window — a deliberate battery trade.
  hiddenIntervalMs: 1000,
  // Cadence while the camera has no usable frame (paused, muted track, warming up).
  idleIntervalMs: 1500,
  // A send that has not settled by now is treated as hung. ~8x the visible cadence.
  sendTimeoutMs: 5000,

  // Failure backoff: retryBackoffMs * 2^(failures - 1), capped.
  retryBackoffMs: 1000,
  maxRetryBackoffMs: 15000,
  maxConsecutiveFailures: 5,

  // Watchdog.
  watchdogIntervalMs: 5000,
  staleThresholdMs: 20000,
  // A gap this large between watchdog checks means the page froze or the machine
  // slept. Staleness is legitimate then, so re-baseline instead of rebuilding.
  suspendGapMs: 60000,
  videoStallThresholdMs: 30000,

  // Rebuild budget. Without a cap, a broken GPU driver yields an endless rebuild loop.
  maxRebuildAttempts: 3,
  rebuildWindowMs: 300000,
  // holistic.close() can itself hang on a wedged instance.
  closeTimeoutMs: 3000,
  // The MediaPipe CDN script. Without a ceiling a stalled request leaves the
  // app on "Loading the system..." forever.
  scriptLoadTimeoutMs: 20000,
  // WASM + model download on first use. Generous: a cold, slow connection is
  // legitimate, but a hang must still end in an error rather than forever.
  modelInitTimeoutMs: 60000,
});
