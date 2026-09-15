import { updateChartFromTimestamps, updateMinuteChartFromTimestamps } from './chart.js';
import { getTodayStats, pruneAlertHistory } from './analytics.js';
import { DETECTION_CONFIG } from './detection-config.js';
import { createDetectionSupervisor } from './detection-supervisor.js';
import { createHolistic, destroyHolistic } from './holistic-factory.js';
import { createScheduler } from './scheduler.js';
import { getArray, getInt, setArray, setInt } from './storage.js';
import { getState, setErrorState, setLoadingState, setReadyState, subscribe } from './state.js';

const videoElement = document.getElementById('video');
const alertSound = document.getElementById('alertSound');

const MIN_ALERT_INTERVAL = 10000;

let cameraStream = null;

// Bumped on every camera start and stop. A getUserMedia promise that resolves
// after the user has toggled again belongs to a superseded generation, and its
// stream must be released instead of silently holding the webcam open.
let cameraGeneration = 0;

// Detection keeps running while the tab is hidden. The clock lives in a worker so
// background timer throttling cannot starve it, and the supervisor replaces a
// wedged MediaPipe instance instead of leaving the app silently dead.
const detectionClock = createScheduler({
  onWorkerError: () =>
    detectionSupervisor.halt('the detection clock worker failed', 'Detection clock failed. Please reload the page.'),
});

const detectionSupervisor = createDetectionSupervisor({
  schedule: detectionClock.schedule,
  cancel: detectionClock.cancel,
  createInstance: () => createHolistic({ onResults, timers: detectionClock }),
  destroyInstance: instance => destroyHolistic(instance, { timers: detectionClock }),
  sendFrame: instance => instance.send({ image: videoElement }),
  canSendFrame: () => videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA,
  // A slower cadence while hidden is a deliberate battery trade.
  getIntervalMs: () => (document.hidden ? DETECTION_CONFIG.hiddenIntervalMs : DETECTION_CONFIG.intervalMs),
  isPaused: () => getState().isPaused,
  onLoading: setLoadingState,
  onReady: setReadyState,
  onHalted: setErrorState,
});

export function attachHolistic(holistic) {
  detectionSupervisor.attachInstance(holistic);
}

export function reportModelLoadFailure(error) {
  console.error('Detection model failed to load:', error);
  detectionSupervisor.halt(
    'the detection model failed to load',
    'Failed to load the detection model. Check your connection and reload the page.'
  );
}

export async function setupCamera() {
  const generation = ++cameraGeneration;

  try {
    setLoadingState('Requesting camera access...');
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });

    if (generation !== cameraGeneration) {
      stopTracks(stream);
      return;
    }

    cameraStream = stream;
    videoElement.srcObject = stream;

    videoElement.onloadedmetadata = () => {
      videoElement.play().catch(error => {
        console.warn('Video playback failed:', error);
      });
      detectionSupervisor.markCameraReady();
    };
  } catch (err) {
    console.error('Camera setup error:', err);

    // A denial for a stream we already replaced must not overwrite the newer status.
    if (generation !== cameraGeneration) {
      return;
    }

    setErrorState('Camera access denied or unavailable.');
  }
}

// Releases the webcam outright: the browser's in-use indicator goes dark, rather
// than implying we are still watching while the system is off.
export function stopCamera() {
  cameraGeneration += 1;
  detectionSupervisor.markCameraStopped();

  if (cameraStream) {
    stopTracks(cameraStream);
    cameraStream = null;
  }

  videoElement.onloadedmetadata = null;
  videoElement.srcObject = null;
}

function stopTracks(stream) {
  stream.getTracks().forEach(track => track.stop());
}

function getAlertMessage(alertsCount, lastAlertTime, currentDuration, lastDuration) {
  return `Alerts: ${alertsCount} - Latest at ${new Date(lastAlertTime).toLocaleTimeString()} - Duration: ${currentDuration} (was: ${lastDuration}) min`;
}

function getDuration(lastAlertTime) {
  return Math.round((Date.now() - lastAlertTime) / 60000);
}

let lastInterval = null;
let lastAlertTime = getInt('lastAlertTime') || 0;
let alertsCount = getInt('alertsCount') || 0;
let currentDuration = getInt('currentDuration') || 0;
let lastDuration = getInt('lastDuration') || 0;
const persistedAlerts = getArray('alertsList') || [];
const alertsList = pruneAlertHistory(persistedAlerts);

if (alertsList.length !== persistedAlerts.length) {
  setArray('alertsList', alertsList);
}

// Initial update
updateChartFromTimestamps(alertsList);
updateMinuteChartFromTimestamps(alertsList);
updateDashboard();

// Start interval to update "Time Since" every minute
setInterval(updateDashboard, 60000);

let lastKnownIsPaused = getState().isPaused;

// Reacts to pause transitions only. A status change (loading, ready, error) must
// never restart detection, or a failure could re-arm the loop under its own banner.
subscribe(state => {
  if (state.isPaused === lastKnownIsPaused) {
    return;
  }

  lastKnownIsPaused = state.isPaused;

  // Deferred so the supervisor's status updates never emit from inside this listener.
  queueMicrotask(() => {
    detectionSupervisor.setPaused(state.isPaused);

    // Turning the system off releases the camera; turning it back on reacquires
    // it. setPaused(false) above cannot restart the loop on its own, because the
    // supervisor no longer considers a camera ready — markCameraReady does that
    // once the reacquired stream reports metadata.
    if (state.isPaused) {
      stopCamera();
      return;
    }

    setupCamera();
  });
});

window.addEventListener('beforeunload', () => {
  detectionSupervisor.stop();
  stopCamera();
});

function formatDuration(ms) {
  if (!ms) return '0m';
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m`;
}

function formatTime(timestamp) {
  if (!timestamp) return '--:--';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function updateDashboard() {
  // Update Total Alerts Panel
  document.getElementById('totalAlerts').innerText = alertsCount;
  document.getElementById('lastAlertTime').innerText = formatTime(lastAlertTime);

  if (lastAlertTime) {
    const date = new Date(lastAlertTime);
    const dateStr = date.toISOString().split('T')[0]; // yyyy-MM-DD
    document.getElementById('lastAlertDate').innerText = dateStr;
  } else {
    document.getElementById('lastAlertDate').innerText = '';
  }

  const timeSince = lastAlertTime ? Date.now() - lastAlertTime : 0;
  document.getElementById('timeSinceLast').innerText = lastAlertTime ? formatDuration(timeSince) + ' ago' : '--';

  // Calculate previous interval (gap before last alert)
  let prevInterval = 0;
  if (alertsList.length > 1) {
    prevInterval = alertsList[alertsList.length - 1] - alertsList[alertsList.length - 2];
  }
  document.getElementById('lastInterval').innerText = formatDuration(prevInterval);

  // Update Today Summary Panel
  const todayStats = getTodayStats(alertsList);
  document.getElementById('todayCount').innerText = todayStats.count;
  document.getElementById('todayAvgInterval').innerText = formatDuration(todayStats.avgInterval);
  document.getElementById('todayFirst').innerText = formatTime(todayStats.first);
  document.getElementById('todayActiveTime').innerText = formatDuration(todayStats.timeSinceFirstAlert);
}

// Readiness is announced by the supervisor on the first successful frame after
// every start or rebuild, so this no longer needs a one-shot latch.
export function onResults(results) {
  const isPaused = getState().isPaused;
  if (isPaused) return;

  if (!results.faceLandmarks || (!results.rightHandLandmarks && !results.leftHandLandmarks)) return;

  const facePoints = results.faceLandmarks;
  const hands = [...(results.leftHandLandmarks || []), ...(results.rightHandLandmarks || [])];

  for (const handPoint of hands) {
    for (const facePoint of facePoints) {
      const dx = handPoint.x - facePoint.x;
      const dy = handPoint.y - facePoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 0.03 && Date.now() - lastAlertTime > MIN_ALERT_INTERVAL) {
        alertSound.play().catch(error => {
          console.warn('Alert playback failed:', error);
        });

        // Trigger pulse animation on stat card
        const statCard = document.querySelector('.stat-card.main-stat');
        if (statCard) {
          statCard.classList.add('alert');
          setTimeout(() => statCard.classList.remove('alert'), 600);
        }

        const now = Date.now();
        lastDuration = lastAlertTime === 0 ? 0 : Math.round((now - lastAlertTime) / 60000);

        lastAlertTime = now;
        alertsList.push(lastAlertTime);
        const prunedAlerts = pruneAlertHistory(alertsList, now);
        alertsList.splice(0, alertsList.length, ...prunedAlerts);
        alertsCount++;

        setInt('lastAlertTime', lastAlertTime);
        setInt('alertsCount', alertsCount);
        setInt('lastDuration', lastDuration);
        setArray('alertsList', alertsList);

        updateChartFromTimestamps(alertsList);
        updateMinuteChartFromTimestamps(alertsList);
        updateDashboard();

        return;
      }
    }
  }
}
