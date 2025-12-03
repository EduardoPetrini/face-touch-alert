const ctx = document.getElementById('alertChart').getContext('2d');
const chart = new Chart(ctx, {
  type: 'bar',
  data: {
    labels: getLabelsForLast24Hours(),
    datasets: [
      {
        label: 'Face Touch Alerts',
        data: Array(24).fill(0),
        backgroundColor: 'rgba(59, 130, 246, 0.8)', // Modern blue with transparency
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
          color: '#9ca3af', // gray-400
          font: {
            family: 'Inter, sans-serif',
            size: 12,
          },
        },
        grid: {
          color: 'rgba(156, 163, 175, 0.1)', // gray-400 with low opacity
          drawBorder: false,
        },
        border: {
          color: 'rgba(156, 163, 175, 0.2)',
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#9ca3af', // gray-400
          font: {
            family: 'Inter, sans-serif',
            size: 12,
          },
        },
        grid: {
          color: 'rgba(156, 163, 175, 0.1)', // gray-400 with low opacity
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
        backgroundColor: 'rgba(17, 24, 39, 0.95)', // gray-900 with high opacity
        titleColor: '#f3f4f6', // gray-100
        bodyColor: '#d1d5db', // gray-300
        borderColor: 'rgba(59, 130, 246, 0.3)', // primary-500 with low opacity
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

export function getLabelsForLast24Hours() {
  const now = new Date();
  now.setMinutes(0, 0, 0);

  return Array.from({ length: 24 }, (_, i) => {
    const hour = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
    return `${hour.getHours()}:00`;
  });
}

export function updateChartFromTimestamps(timestamps, now = new Date()) {
  now.setMinutes(0, 0, 0);
  const oneDayAgo = now.getTime() - 24 * 60 * 60 * 1000;

  const hourlyCounts = Array(24).fill(0);

  timestamps
    .filter(ts => ts >= oneDayAgo)
    .forEach(ts => {
      const tsDate = new Date(ts);
      tsDate.setMinutes(0, 0, 0);
      const diffMs = now.getTime() - tsDate.getTime();
      const hoursAgo = Math.floor(diffMs / (60 * 60 * 1000));

      if (hoursAgo >= 0 && hoursAgo < 24) {
        const bucket = 23 - hoursAgo;
        hourlyCounts[bucket]++;
      }
    });

  chart.data.labels = getLabelsForLast24Hours();
  chart.data.datasets[0].data = hourlyCounts;
  chart.update();

  return hourlyCounts;
}

// Minute Chart Implementation
const minuteCtx = document.getElementById('minuteChart').getContext('2d');
const minuteChart = new Chart(minuteCtx, {
  type: 'bar',
  data: {
    labels: getLabelsForLast60Minutes(),
    datasets: [
      {
        label: 'Face Touches (Last Hour)',
        data: Array(60).fill(0),
        backgroundColor: 'rgba(16, 185, 129, 0.8)', // Success green
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
          maxTicksLimit: 12, // Show label every 5 mins
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

export function getLabelsForLast60Minutes() {
  const now = new Date();
  const labels = [];
  for (let i = 59; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 60000);
    labels.push(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }
  return labels;
}

export function updateMinuteChartFromTimestamps(timestamps, now = new Date()) {
  const oneHourAgo = now.getTime() - 60 * 60 * 1000;
  const minuteCounts = Array(60).fill(0);

  timestamps
    .filter(ts => ts >= oneHourAgo)
    .forEach(ts => {
      const diffMs = now.getTime() - ts;
      const minutesAgo = Math.floor(diffMs / 60000);
      if (minutesAgo >= 0 && minutesAgo < 60) {
        minuteCounts[59 - minutesAgo]++;
      }
    });

  minuteChart.data.labels = getLabelsForLast60Minutes();
  minuteChart.data.datasets[0].data = minuteCounts;
  minuteChart.update();
}
