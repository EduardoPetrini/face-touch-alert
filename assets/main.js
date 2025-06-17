import { setupCamera, onResults } from './functions.js';

const script = document.createElement('script');
const mediapipeVersion = '0.5.1675471629';

script.src = `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@${mediapipeVersion}/holistic.js`;

script.onload = () => {
  const holistic = new window.Holistic({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@${mediapipeVersion}/${file}`,
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

  setupCamera(holistic);
};

script.onerror = () => {
  loading.textContent = 'Failed to load detection model.';
};

document.body.appendChild(script);
