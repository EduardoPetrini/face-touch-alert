const ctx = document.getElementById('alertChart').getContext('2d');
const chart = new Chart(ctx, {
  type: 'bar',
  data: {
    labels: [...Array(24).keys()].map(h => `${h}:00`),
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

export function updateChartFromTimestamps(timestamps) {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const hourlyCounts = Array(24).fill(0);

  timestamps
    .filter(ts => ts > oneDayAgo)
    .forEach(ts => {
      const hour = new Date(ts).getHours();
      hourlyCounts[hour]++;
    });

  chart.data.datasets[0].data = hourlyCounts;
  chart.update();
}
