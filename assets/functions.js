import { updateChartFromTimestamps } from './chart.js';
import { getArray, getInt, setArray, setInt } from './storage.js';

const videoElement = document.getElementById('video');
const alertSound = document.getElementById('alertSound');
const loading = document.getElementById('loading');
const counts = document.getElementById('counts');

export function startDetectionLoop(holistic) {
  setInterval(() => {
    holistic.send({ image: videoElement });
  }, 600);
}

export async function setupCamera(holistic) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoElement.srcObject = stream;

    videoElement.onloadedmetadata = () => {
      videoElement.play();
      loading.style.display = 'none';
      startDetectionLoop(holistic);
    };
  } catch (err) {
    loading.style.display = 'block';
    loading.textContent = 'Camera access denied or unavailable.';
    console.error('Camera setup error:', err);
  }
}

function getAlertMessage(alertsCount, lastAlertTime, currentDuration, lastDuration) {
  return `Alerts: ${alertsCount} - Latest at ${new Date(lastAlertTime).toLocaleTimeString()} - Duration: ${currentDuration} (was: ${lastDuration}) min`;
}

function getDuration(lastAlertTime) {
  return Math.round((Date.now() - lastAlertTime) / 60000);
}

const MIN_ALERT_INTERVAL = 10000;
let lastInterval = null;
let lastAlertTime = getInt('lastAlertTime') || 0;
let alertsCount = getInt('alertsCount') || 0;
let currentDuration = getInt('currentDuration') || 0;
let lastDuration = getInt('lastDuration') || 0;
const alertsList = getArray('alertsList') || [];

updateChartFromTimestamps(alertsList);
currentDuration = getDuration(lastAlertTime);
counts.innerText = getAlertMessage(alertsCount, lastAlertTime, currentDuration, lastDuration);

if (alertsCount > 0) {
  counts.innerText = getAlertMessage(alertsCount, lastAlertTime, currentDuration, lastDuration);
}

export function onResults(results) {
  const isPaused = getInt('isPaused') || 0;
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
        alertSound.play();
        lastDuration = lastAlertTime === 0 ? lastAlertTime : getDuration(lastAlertTime);

        lastAlertTime = Date.now();
        alertsList.push(lastAlertTime);
        alertsCount++;
        let currentDuration = getDuration(lastAlertTime);
        counts.innerText = getAlertMessage(alertsCount, lastAlertTime, currentDuration, lastDuration);

        setInt('lastAlertTime', lastAlertTime);
        setInt('alertsCount', alertsCount);
        setInt('lastDuration', lastDuration);
        setInt('currentDuration', currentDuration);
        setArray('alertsList', alertsList);

        updateChartFromTimestamps(alertsList);

        if (lastInterval) {
          clearInterval(lastInterval);
        }

        lastInterval = setInterval(() => {
          currentDuration = getDuration(lastAlertTime);
          setInt('currentDuration', currentDuration);
          counts.innerText = getAlertMessage(alertsCount, lastAlertTime, currentDuration, lastDuration);
        }, 10000);

        return;
      }
    }
  }
}
