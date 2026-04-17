import { updateChartFromTimestamps, updateMinuteChartFromTimestamps } from './chart.js';
import { getTodayStats, pruneAlertHistory } from './analytics.js';
import { getArray, getInt, setArray, setInt } from './storage.js';
import { getState, setErrorState, setLoadingState, setReadyState, subscribe } from './state.js';

const videoElement = document.getElementById('video');
const alertSound = document.getElementById('alertSound');

const DETECTION_INTERVAL_MS = 600;
const MIN_ALERT_INTERVAL = 10000;

let detectionTimerId = null;
let isDetectionLoopRunning = false;
let isInferenceInFlight = false;
let cameraStream = null;
let holisticInstance = null;

export function startDetectionLoop(holistic) {
  holisticInstance = holistic;

  if (isDetectionLoopRunning) {
    return;
  }

  isDetectionLoopRunning = true;

  const runDetectionFrame = async () => {
    if (!isDetectionLoopRunning) {
      return;
    }

    if (document.hidden || getState().isPaused || videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      detectionTimerId = window.setTimeout(runDetectionFrame, DETECTION_INTERVAL_MS);
      return;
    }

    if (isInferenceInFlight) {
      detectionTimerId = window.setTimeout(runDetectionFrame, DETECTION_INTERVAL_MS);
      return;
    }

    isInferenceInFlight = true;

    try {
      await holistic.send({ image: videoElement });
    } catch (error) {
      console.error('Detection loop error:', error);
      stopDetectionLoop();
      setErrorState('Detection stopped unexpectedly. Please refresh the page.');
      return;
    } finally {
      isInferenceInFlight = false;
    }

    detectionTimerId = window.setTimeout(runDetectionFrame, DETECTION_INTERVAL_MS);
  };

  runDetectionFrame();
}

export function stopDetectionLoop() {
  isDetectionLoopRunning = false;

  if (detectionTimerId !== null) {
    window.clearTimeout(detectionTimerId);
    detectionTimerId = null;
  }
}

export async function setupCamera(holistic) {
  try {
    setLoadingState('Requesting camera access...');
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoElement.srcObject = cameraStream;

    videoElement.onloadedmetadata = () => {
      videoElement.play();
      setLoadingState('Loading AI models...');
      startDetectionLoop(holistic);
    };
  } catch (err) {
    console.error('Camera setup error:', err);
    setErrorState('Camera access denied or unavailable.');
  }
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

subscribe(state => {
  if (state.isPaused) {
    stopDetectionLoop();
    return;
  }

  if (!document.hidden && holisticInstance) {
    startDetectionLoop(holisticInstance);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopDetectionLoop();
    return;
  }

  if (!getState().isPaused && holisticInstance) {
    startDetectionLoop(holisticInstance);
  }
});

window.addEventListener('beforeunload', () => {
  stopDetectionLoop();

  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
  }
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

let isSystemReady = false;

export function onResults(results) {
  if (!isSystemReady) {
    isSystemReady = true;
    setReadyState();
  }

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
