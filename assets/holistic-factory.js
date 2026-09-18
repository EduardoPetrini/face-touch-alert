import { DETECTION_CONFIG } from './detection-config.js';

// Loads, builds, and tears down MediaPipe Holistic instances. Side-effect-free:
// nothing runs at import time, so it can sit anywhere in the module graph.
//
// A wedged instance (typically after WebGL context loss in a background tab)
// cannot be repaired in place. Recovery means destroying it and building a new
// one; the CDN script itself is fetched once and reused across rebuilds.

export const HOLISTIC_VERSION = '0.5.1675471629';
export const HOLISTIC_CDN_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@${HOLISTIC_VERSION}`;

export const HOLISTIC_OPTIONS = Object.freeze({
  modelComplexity: 1,
  smoothLandmarks: true,
  enableSegmentation: false,
  refineFaceLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

export const DESTROY_OUTCOME = Object.freeze({
  CLOSED: 'closed',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
  SKIPPED: 'skipped',
});

const SETTLED = Object.freeze({
  OK: 'ok',
  ERROR: 'error',
  TIMEOUT: 'timeout',
});

// Adapts host timers to the { schedule, cancel } shape createScheduler returns,
// so a caller running in a background tab can pass the worker clock instead.
function createHostTimers(host) {
  return {
    schedule: (delayMs, callback) => host.setTimeout(callback, delayMs),
    cancel: timerId => host.clearTimeout(timerId),
  };
}

// Runs task and resolves { kind, error } — never rejects, never waits past timeoutMs.
function settleWithin(task, timers, timeoutMs) {
  return new Promise(resolve => {
    let isSettled = false;
    let timeoutTicket = null;

    const settle = outcome => {
      if (isSettled) {
        return;
      }

      isSettled = true;

      if (timeoutTicket !== null) {
        timers.cancel(timeoutTicket);
      }

      resolve(outcome);
    };

    timeoutTicket = timers.schedule(timeoutMs, () => settle({ kind: SETTLED.TIMEOUT }));

    // Promise.resolve().then() so a synchronous throw from task lands here too.
    Promise.resolve()
      .then(task)
      .then(
        () => settle({ kind: SETTLED.OK }),
        error => settle({ kind: SETTLED.ERROR, error })
      );
  });
}

export function createHolisticLoader({
  doc = globalThis.document,
  host = globalThis,
  timers = createHostTimers(host),
  baseUrl = HOLISTIC_CDN_BASE,
  timeoutMs = DETECTION_CONFIG.scriptLoadTimeoutMs,
} = {}) {
  let pending = null;

  function load() {
    if (typeof host.Holistic === 'function') {
      return Promise.resolve(host.Holistic);
    }

    if (pending !== null) {
      return pending;
    }

    pending = new Promise((resolve, reject) => {
      const script = doc.createElement('script');
      const url = `${baseUrl}/holistic.js`;
      let isSettled = false;
      let timeoutTicket = null;

      function settle(loadError) {
        if (isSettled) {
          return;
        }

        isSettled = true;
        timers.cancel(timeoutTicket);
        script.onload = null;
        script.onerror = null;

        const error =
          loadError ||
          (typeof host.Holistic === 'function'
            ? null
            : new Error('MediaPipe Holistic loaded but did not define window.Holistic.'));

        if (error) {
          // Forget the failed attempt so the next load() retries; only a
          // success stays memoised.
          pending = null;
          script.remove();
          reject(error);
          return;
        }

        resolve(host.Holistic);
      }

      script.onload = () => settle(null);
      script.onerror = () => settle(new Error(`Failed to load MediaPipe Holistic from ${url}.`));
      timeoutTicket = timers.schedule(timeoutMs, () =>
        settle(new Error(`Timed out after ${timeoutMs}ms loading MediaPipe Holistic.`))
      );

      script.src = url;
      doc.body.appendChild(script);
    });

    return pending;
  }

  return { load };
}

// Where default builds — including the supervisor's rebuilds, which pass no
// source of their own — load the script and WASM/model files from.
let defaultSource = Object.freeze({ baseUrl: HOLISTIC_CDN_BASE, locateFile: null });

// Created on first use rather than at import, so importing this module in a
// DOM-less environment captures nothing.
let defaultLoader = null;

function getDefaultLoader() {
  if (defaultLoader === null) {
    defaultLoader = createHolisticLoader({ baseUrl: defaultSource.baseUrl });
  }

  return defaultLoader;
}

// Repoints every later default build. The offline edition calls this once at
// startup, since it cannot reach the CDN; the hosted app never does.
export function setHolisticSource({ baseUrl, locateFile = null } = {}) {
  if (typeof baseUrl !== 'string' || baseUrl === '') {
    throw new TypeError('setHolisticSource requires a baseUrl.');
  }

  defaultSource = Object.freeze({ baseUrl, locateFile });
  defaultLoader = null;
}

export async function createHolistic({
  onResults,
  loader = getDefaultLoader(),
  baseUrl = defaultSource.baseUrl,
  // Where each WASM/model file is fetched from. The offline build swaps this
  // for blob URLs, since file:// pages cannot fetch sibling files.
  locateFile = defaultSource.locateFile ?? (file => `${baseUrl}/${file}`),
  options = HOLISTIC_OPTIONS,
  timers = createHostTimers(globalThis),
  initializeTimeoutMs = DETECTION_CONFIG.modelInitTimeoutMs,
} = {}) {
  if (typeof onResults !== 'function') {
    throw new TypeError('createHolistic requires an onResults callback.');
  }

  const Holistic = await loader.load();
  const instance = new Holistic({ locateFile });

  instance.setOptions({ ...options });
  instance.onResults(onResults);

  // Download the WASM and model files now rather than inside the first send().
  // A cold download takes far longer than the per-frame send timeout, and the
  // detection loop would otherwise read a slow first frame as a hang.
  if (typeof instance.initialize === 'function') {
    const outcome = await settleWithin(() => instance.initialize(), timers, initializeTimeoutMs);

    if (outcome.kind !== SETTLED.OK) {
      destroyHolistic(instance, { timers });

      throw outcome.kind === SETTLED.TIMEOUT
        ? new Error(`MediaPipe Holistic did not initialize within ${initializeTimeoutMs}ms.`)
        : outcome.error;
    }
  }

  return instance;
}

// Never rejects. close() can hang on the very wedged instance being replaced,
// and a leaked GPU context is far better than a recovery that never finishes.
export async function destroyHolistic(
  instance,
  { timers = createHostTimers(globalThis), timeoutMs = DETECTION_CONFIG.closeTimeoutMs } = {}
) {
  if (!instance || typeof instance.close !== 'function') {
    return DESTROY_OUTCOME.SKIPPED;
  }

  const outcome = await settleWithin(() => instance.close(), timers, timeoutMs);

  if (outcome.kind === SETTLED.OK) {
    return DESTROY_OUTCOME.CLOSED;
  }

  if (outcome.kind === SETTLED.TIMEOUT) {
    console.warn(`Holistic close() did not settle within ${timeoutMs}ms; abandoning the instance.`);
    return DESTROY_OUTCOME.TIMEOUT;
  }

  console.warn('Holistic close() failed; abandoning the instance:', outcome.error);
  return DESTROY_OUTCOME.FAILED;
}
