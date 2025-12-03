import { updateChartFromTimestamps } from './chart.js';
import { getArray, getInt, setArray, setInt } from './storage.js';

const videoElement = document.getElementById('video');
const alertSound = document.getElementById('alertSound');
const loading = document.getElementById('loading');

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
      loading.innerHTML = '<div class="loading-spinner"></div>System Ready';
      setTimeout(() => {
        loading.style.display = 'none';
        document.querySelector('.video-container').classList.add('active');
      }, 1000);
      startDetectionLoop(holistic);
    };
  } catch (err) {
    loading.style.display = 'block';
    loading.innerHTML = '<div style="color: #ef4444;">❌ Camera access denied or unavailable.</div>';
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

// Initial update
updateChartFromTimestamps(alertsList);
updateDashboard();

// Start interval to update "Time Since" every minute
setInterval(updateDashboard, 60000);

function getTodayStats(alerts) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const todayAlerts = alerts.filter(timestamp => timestamp >= todayStart);
  const count = todayAlerts.length;

  if (count === 0) {
    return {
      count: 0,
      avgInterval: 0,
      first: null,
      last: null,
      activeTime: 0,
    };
  }

  const first = todayAlerts[0];
  const last = todayAlerts[todayAlerts.length - 1];
  const activeTime = now.getTime() - first;

  // Calculate average interval
  let totalInterval = 0;
  if (count > 1) {
    for (let i = 1; i < count; i++) {
      totalInterval += todayAlerts[i] - todayAlerts[i - 1];
    }
    var avgInterval = totalInterval / (count - 1);
  } else {
    var avgInterval = 0;
  }

  return {
    count,
    avgInterval,
    first,
    last,
    activeTime,
  };
}

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
  document.getElementById('todayActiveTime').innerText = formatDuration(todayStats.activeTime);
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
        alertsCount++;

        setInt('lastAlertTime', lastAlertTime);
        setInt('alertsCount', alertsCount);
        setInt('lastDuration', lastDuration);
        setArray('alertsList', alertsList);

        updateChartFromTimestamps(alertsList);
        updateDashboard();

        return;
      }
    }
  }
}
