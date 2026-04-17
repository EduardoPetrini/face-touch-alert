import {
  getHourlyCounts,
  getLabelsForLast24Hours,
  getLabelsForLast60Minutes,
  getMinuteCounts,
} from './analytics.js';

export { getLabelsForLast24Hours, getLabelsForLast60Minutes } from './analytics.js';

let chart = null;
let minuteChart = null;

function createHourlyChart(ctx) {
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: getLabelsForLast24Hours(),
      datasets: [
        {
          label: 'Face Touch Alerts',
          data: Array(24).fill(0),
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: {
            color: '#9ca3af',
            font: {
              family: 'Inter, sans-serif',
              size: 12,
            },
          },
          grid: {
            color: 'rgba(156, 163, 175, 0.1)',
            drawBorder: false,
          },
          border: {
            color: 'rgba(156, 163, 175, 0.2)',
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: '#9ca3af',
            font: {
              family: 'Inter, sans-serif',
              size: 12,
            },
          },
          grid: {
            color: 'rgba(156, 163, 175, 0.1)',
            drawBorder: false,
          },
          border: {
            color: 'rgba(156, 163, 175, 0.2)',
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          titleColor: '#f3f4f6',
          bodyColor: '#d1d5db',
          borderColor: 'rgba(59, 130, 246, 0.3)',
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: false,
          titleFont: {
            family: 'Inter, sans-serif',
            size: 14,
            weight: '600',
          },
          bodyFont: {
            family: 'Inter, sans-serif',
            size: 13,
          },
          callbacks: {
            label: context => `${context.raw > 1 ? 'Touches: ' + context.raw : 'Touch: ' + context.raw}`,
          },
        },
      },
      interaction: {
        intersect: false,
        mode: 'index',
      },
      animation: {
        duration: 750,
        easing: 'easeInOutQuart',
      },
    },
  });
}

function createMinuteChart(ctx) {
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: getLabelsForLast60Minutes(),
      datasets: [
        {
          label: 'Face Touches (Last Hour)',
          data: Array(60).fill(0),
          backgroundColor: 'rgba(16, 185, 129, 0.8)',
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 1,
          borderRadius: 2,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: {
            color: '#9ca3af',
            font: { family: 'Inter, sans-serif', size: 10 },
            maxTicksLimit: 12,
          },
          grid: { display: false },
          border: { color: 'rgba(156, 163, 175, 0.2)' },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: '#9ca3af',
            font: { family: 'Inter, sans-serif', size: 10 },
            stepSize: 1,
          },
          grid: {
            color: 'rgba(156, 163, 175, 0.1)',
            drawBorder: false,
          },
          border: { color: 'rgba(156, 163, 175, 0.2)' },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          titleColor: '#f3f4f6',
          bodyColor: '#d1d5db',
          borderColor: 'rgba(16, 185, 129, 0.3)',
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            title: items => `Time: ${items[0].label}`,
            label: context => `${context.raw > 1 ? 'Touches: ' + context.raw : 'Touch: ' + context.raw}`,
          },
        },
      },
      interaction: { intersect: false, mode: 'index' },
      animation: { duration: 500 },
    },
  });
}

export function initializeCharts() {
  if (chart && minuteChart) {
    return;
  }

  const alertChartElement = document.getElementById('alertChart');
  const minuteChartElement = document.getElementById('minuteChart');

  if (!alertChartElement || !minuteChartElement) {
    return;
  }

  if (!chart) {
    chart = createHourlyChart(alertChartElement.getContext('2d'));
  }

  if (!minuteChart) {
    minuteChart = createMinuteChart(minuteChartElement.getContext('2d'));
  }
}

export function updateChartFromTimestamps(timestamps, now = new Date()) {
  const hourlyCounts = getHourlyCounts(timestamps, now);
  initializeCharts();

  if (chart) {
    chart.data.labels = getLabelsForLast24Hours(now);
    chart.data.datasets[0].data = hourlyCounts;
    chart.update();
  }

  return hourlyCounts;
}

export function updateMinuteChartFromTimestamps(timestamps, now = new Date()) {
  const minuteCounts = getMinuteCounts(timestamps, now);
  initializeCharts();

  if (minuteChart) {
    minuteChart.data.labels = getLabelsForLast60Minutes(now);
    minuteChart.data.datasets[0].data = minuteCounts;
    minuteChart.update();
  }
}
