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

let lastAlertTime = 0;
const MIN_ALERT_INTERVAL = 3000;
let alertsCount = 0;
let lastInterval = null;

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
        lastAlertTime = Date.now();
        alertsCount++;
        counts.innerText = `Alerts: ${alertsCount} - Latest at ${new Date(lastAlertTime).toLocaleTimeString()} - Duration: ${Math.round((Date.now() - lastAlertTime) / 60000)} min`;

        if (lastInterval) {
          clearInterval(lastInterval);
        }

        lastInterval = setInterval(() => {
          counts.innerText = `Alerts: ${alertsCount} - Latest at ${new Date(lastAlertTime).toLocaleTimeString()} - Duration: ${Math.round((Date.now() - lastAlertTime) / 60000)} min`;
        }, 60000);
        
        return;
      }
    }
  }
}
