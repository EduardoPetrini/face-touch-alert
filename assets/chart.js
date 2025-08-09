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
            size: 12
          }
        },
        grid: { 
          color: 'rgba(156, 163, 175, 0.1)', // gray-400 with low opacity
          drawBorder: false
        },
        border: {
          color: 'rgba(156, 163, 175, 0.2)'
        }
      },
      y: {
        beginAtZero: true,
        ticks: { 
          color: '#9ca3af', // gray-400
          font: {
            family: 'Inter, sans-serif',
            size: 12
          }
        },
        grid: { 
          color: 'rgba(156, 163, 175, 0.1)', // gray-400 with low opacity
          drawBorder: false
        },
        border: {
          color: 'rgba(156, 163, 175, 0.2)'
        }
      },
    },
    plugins: {
      legend: {
        display: false
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
          weight: '600'
        },
        bodyFont: {
          family: 'Inter, sans-serif',
          size: 13
        },
        callbacks: {
          label: context => `${context.raw > 1 ? 'Touches: ' + context.raw : 'Touch: ' + context.raw}`,
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index'
    },
    animation: {
      duration: 750,
      easing: 'easeInOutQuart'
    }
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
