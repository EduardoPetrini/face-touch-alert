const videoElement = document.getElementById('video');
const alertSound = document.getElementById('alertSound');
const loading = document.getElementById('loading');

const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/holistic/holistic.js';
script.onload = () => {
  const holistic = new window.Holistic({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
  });

  holistic.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    refineFaceLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  holistic.onResults(onResults);

  async function setupCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoElement.srcObject = stream;

      videoElement.onloadedmetadata = () => {
        videoElement.play();
        loading.style.display = 'none';
        startDetectionLoop();
      };
    } catch (err) {
      loading.textContent = 'Camera access denied or unavailable.';
      console.error('Camera setup error:', err);
    }
  }

  function startDetectionLoop() {
    setInterval(() => {
      holistic.send({ image: videoElement });
    }, 300);
  }

  setupCamera();

  let lastAlertTime = 0;
  const MIN_ALERT_INTERVAL = 3000;

  function onResults(results) {
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
          return;
        }
      }
    }
  }
};

script.onerror = () => {
  loading.textContent = 'Failed to load detection model.';
};

document.body.appendChild(script);
