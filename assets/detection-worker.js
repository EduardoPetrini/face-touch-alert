// Source for the detection clock worker, kept as a string and loaded from a
// Blob URL rather than emitted as a bundler chunk.
//
// Why not `new Worker(new URL('./x.js', import.meta.url))`: there is no
// vite.config.js, so `base` defaults to '/' and the worker would be emitted as
// a hashed chunk referenced from the site root. Under subpath hosting (a GitHub
// Pages project site) that 404s and the scheduler degrades *silently* to
// throttled main-thread timers — the exact invisible failure this module exists
// to prevent. The worker has no imports, so bundling buys nothing.
//
// If a Content-Security-Policy is ever added to index.html it must allow
// `worker-src blob:`, or this falls back to main-thread timers.
//
// Protocol
//   in:  { type: 'schedule', ticketId, delayMs } | { type: 'cancel', ticketId } | { type: 'dispose' }
//   out: { type: 'tick', ticketId }
//
// One-shot only, deliberately. A repeating timer here would queue ticks faster
// than MediaPipe can consume them; the loop re-arms after each frame instead,
// which is what provides back-pressure.

export const DETECTION_WORKER_SOURCE = `
'use strict';

var timers = new Map();

self.onmessage = function (event) {
  var data = event.data || {};

  if (data.type === 'schedule') {
    var ticketId = data.ticketId;

    var timerId = setTimeout(function () {
      timers.delete(ticketId);
      self.postMessage({ type: 'tick', ticketId: ticketId });
    }, data.delayMs);

    timers.set(ticketId, timerId);
    return;
  }

  if (data.type === 'cancel') {
    var pending = timers.get(data.ticketId);

    if (pending !== undefined) {
      clearTimeout(pending);
      timers.delete(data.ticketId);
    }

    return;
  }

  if (data.type === 'dispose') {
    timers.forEach(function (timerId) {
      clearTimeout(timerId);
    });
    timers.clear();
  }
};
`;
