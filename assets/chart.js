const ctx = document.getElementById('alertChart').getContext('2d');
const chart = new Chart(ctx, {
  type: 'bar',
  data: {
    labels: getLabelsForLast24Hours(),
    datasets: [
      {
        label: 'Face Touch Alerts',
        data: Array(24).fill(0),
        backgroundColor: '#0f0',
      },
    ],
  },
  options: {
    scales: {
      x: {
        ticks: { color: '#fff' },
        grid: { color: '#444' },
      },
      y: {
        beginAtZero: true,
        ticks: { color: '#fff' },
        grid: { color: '#444' },
      },
    },
    plugins: {
      legend: false,
      tooltip: {
        callbacks: {
          label: context => `${context.raw > 0 ? 'Touches: ' + context.raw : 'Touch: ' + context.raw}`,
        },
      },
    },
    backgroundColor: 'rgba(0,0,0,0)',
  },
});

export function getLabelsForLast24Hours() {
  const now = new Date();
  return Array.from({ length: 24 }, (_, i) => {
    const hour = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
    return `${hour.getHours()}:00`;
  });
}

export function updateChartFromTimestamps(timestamps) {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const hourlyCounts = Array(24).fill(0);

  const now = new Date();

  timestamps
    .filter(ts => ts > oneDayAgo)
    .forEach(ts => {
      const hoursAgo = Math.floor((now - ts) / (60 * 60 * 1000));
      if (hoursAgo >= 0 && hoursAgo < 24) {
        const bucket = 23 - hoursAgo;
        hourlyCounts[bucket]++;
      }
    });

  chart.data.labels = getLabelsForLast24Hours();
  chart.data.datasets[0].data = hourlyCounts;
  chart.update();

  return hourlyCounts
}
