import { DETECTION_WORKER_SOURCE } from './detection-worker.js';

// A one-shot timer source that survives background-tab throttling.
//
// Chrome clamps main-thread timers to >=1s while a tab is hidden, then to about
// one per minute after five minutes ("intensive throttling"). Worker timers are
// not throttled, so the clock lives in a worker wherever one can be created and
// falls back to host timers everywhere else — notably jsdom, which provides
// neither Worker nor URL.createObjectURL.

export const SCHEDULER_KIND = Object.freeze({
  WORKER: 'worker',
  TIMEOUT: 'timeout',
});

// Every API the worker path touches, checked up front. Probing only `Worker`
// would throw on createObjectURL before the fallback could be reached.
function supportsWorker(host) {
  return (
    typeof host.Worker === 'function' &&
    typeof host.Blob === 'function' &&
    Boolean(host.URL) &&
    typeof host.URL.createObjectURL === 'function' &&
    typeof host.URL.revokeObjectURL === 'function'
  );
}

export function createScheduler({
  host = globalThis,
  workerSource = DETECTION_WORKER_SOURCE,
  onWorkerError = null,
} = {}) {
  const tickets = new Map();
  let nextTicketId = 1;
  let worker = null;
  let workerUrl = null;
  let isDisposed = false;

  function takeTicket(ticketId) {
    const ticket = tickets.get(ticketId);

    if (ticket === undefined) {
      return null;
    }

    tickets.delete(ticketId);
    return ticket;
  }

  function releaseWorker() {
    if (worker !== null) {
      try {
        worker.terminate();
      } catch (error) {
        console.warn('Detection clock worker did not terminate cleanly:', error);
      }

      worker = null;
    }

    if (workerUrl !== null) {
      try {
        host.URL.revokeObjectURL(workerUrl);
      } catch (error) {
        console.warn('Detection clock worker URL was not revoked:', error);
      }

      workerUrl = null;
    }
  }

  function tryCreateWorker() {
    if (!supportsWorker(host)) {
      return false;
    }

    try {
      const blob = new host.Blob([workerSource], { type: 'text/javascript' });
      workerUrl = host.URL.createObjectURL(blob);
      worker = new host.Worker(workerUrl);

      worker.onmessage = event => {
        const data = (event && event.data) || {};

        if (data.type !== 'tick') {
          return;
        }

        // A tick for an unknown ticket was cancelled while the message was
        // already in flight. Dropping it on arrival is the only way to cancel
        // work the worker has handed off; without this, a cancelled frame can
        // still fire and race the live chain.
        const ticket = takeTicket(data.ticketId);

        if (ticket === null) {
          return;
        }

        ticket.callback();
      };

      worker.onerror = error => {
        // The clock is dead. Say so rather than going quiet: the watchdog will
        // also notice the resulting staleness and rebuild.
        console.error('Detection clock worker failed:', error);

        if (typeof onWorkerError === 'function') {
          onWorkerError(error);
        }
      };

      return true;
    } catch (error) {
      console.warn('Detection clock worker unavailable, using main-thread timers:', error);
      releaseWorker();
      return false;
    }
  }

  const kind = tryCreateWorker() ? SCHEDULER_KIND.WORKER : SCHEDULER_KIND.TIMEOUT;

  function schedule(delayMs, callback) {
    if (isDisposed) {
      return null;
    }

    const ticketId = nextTicketId;
    nextTicketId += 1;

    if (kind === SCHEDULER_KIND.WORKER) {
      tickets.set(ticketId, { callback, timerId: null });
      worker.postMessage({ type: 'schedule', ticketId, delayMs });
      return ticketId;
    }

    // Registered before the timer is armed, so a tick can never find no ticket.
    const ticket = { callback, timerId: null };
    tickets.set(ticketId, ticket);

    ticket.timerId = host.setTimeout(() => {
      const pending = takeTicket(ticketId);

      if (pending === null) {
        return;
      }

      pending.callback();
    }, delayMs);

    return ticketId;
  }

  function cancel(ticketId) {
    if (ticketId === null || ticketId === undefined) {
      return;
    }

    const ticket = takeTicket(ticketId);

    if (ticket === null) {
      return;
    }

    if (kind === SCHEDULER_KIND.WORKER) {
      worker.postMessage({ type: 'cancel', ticketId });
      return;
    }

    if (ticket.timerId !== null) {
      host.clearTimeout(ticket.timerId);
    }
  }

  function dispose() {
    if (isDisposed) {
      return;
    }

    isDisposed = true;

    if (kind === SCHEDULER_KIND.WORKER && worker !== null) {
      try {
        worker.postMessage({ type: 'dispose' });
      } catch (error) {
        console.warn('Detection clock worker did not accept dispose:', error);
      }
    } else {
      tickets.forEach(ticket => {
        if (ticket.timerId !== null) {
          host.clearTimeout(ticket.timerId);
        }
      });
    }

    tickets.clear();
    releaseWorker();
  }

  return { kind, schedule, cancel, dispose };
}
