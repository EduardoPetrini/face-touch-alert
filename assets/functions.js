import { getArray, getInt, setArray, setInt } from './storage.js';

const videoElement = document.getElementById('video');
const alertSound = document.getElementById('alertSound');
const loading = document.getElementById('loading');
const counts = document.getElementById('counts');

export function startDetectionLoop(holistic) {
  setInterval(() => {
    holistic.send({ image: videoElement });
  }, 300);
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

let lastAlertTime = getInt('lastAlertTime') || 0;
const MIN_ALERT_INTERVAL = 3000;
let alertsCount = getInt('alertsCount') || 0;
let lastInterval = null;
let lastDuration = getInt('lastDuration') || 0;
const alertsList = getArray('alertsList') || [];

if (alertsCount > 0) {
  counts.innerText = `Alerts: ${alertsCount} - Latest at ${new Date(lastAlertTime).toLocaleTimeString()} - Duration: ${lastDuration} min`;
}

export function onResults(results) {
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
        lastDuration = lastAlertTime === 0 ? lastAlertTime : Math.round((Date.now() - lastAlertTime) / 60000);

        loading.style.display = 'block';

        lastAlertTime = Date.now();
        alertsList.push(lastAlertTime);
        alertsCount++;
        let currentDuration = Math.round((Date.now() - lastAlertTime) / 60000);
        counts.innerText = `Alerts: ${alertsCount} - Latest at ${new Date(lastAlertTime).toLocaleTimeString()} - Duration: ${currentDuration} (was: ${lastDuration}) min`;

        if (lastInterval) {
          clearInterval(lastInterval);
        }

        setInt('lastAlertTime', lastAlertTime);
        setInt('alertsCount', alertsCount);
        setInt('lastDuration', lastDuration);
        setInt('currentDuration', currentDuration);
        setArray('alertsList', alertsList);

        lastInterval = setInterval(() => {
          currentDuration = Math.round((Date.now() - lastAlertTime) / 60000);
          setInt('currentDuration', currentDuration);
          counts.innerText = `Alerts: ${alertsCount} - Latest at ${new Date(lastAlertTime).toLocaleTimeString()} - Duration: ${currentDuration} (was: ${lastDuration}) min`;
        }, 10000);

        return;
      }
    }
  }
}
