import { JSDOM } from 'jsdom';

const dom = new JSDOM(`<!doctype html><html><body>
  <div id="chartContainer" style="width: 600px; height: 400px; margin-top: 20px">
    <canvas id="alertChart" width="400" height="200"></canvas>
  </div>
</body></html>`);
class Chart {
  constructor(ctx, config) {
    this.ctx = ctx;
    this.config = config;
    this.data = config.data;
  }
  update() {}
}
global.window = dom.window;
global.document = dom.window.document;
global.Chart = Chart;

describe('Chart Data Functions', () => {
  it('should generate labels for the last 24 hours', async () => {
    const { getLabelsForLast24Hours } = await import('../assets/chart.js');
    const now = new Date();
    const labels = getLabelsForLast24Hours();
    expect(labels.length).toBe(24);
    expect(labels[23]).toBe(`${now.getHours()}:00`);
    expect(labels[0]).toBe(`${(now.getHours() + 1) % 24}:00`);
  });

  it('should update chart data from timestamps', async () => {
    const { updateChartFromTimestamps } = await import('../assets/chart.js');
    const timestamps = [Date.now() - 30 * 60 * 1000, Date.now() - 3 * 60 * 1000, Date.now() - 55 * 60 * 1000, Date.now() - 64 * 60 * 1000, Date.now() - 2 * 60 * 60 * 1000, Date.now() - 5 * 60 * 60 * 1000, Date.now() - 25 * 60 * 60 * 1000, Date.now() - 24 * 59 * 60 * 1000];
    const hourlyCounts = updateChartFromTimestamps(timestamps);
    expect(hourlyCounts[0]).toBe(1);
    expect(hourlyCounts[21]).toBe(1);
    expect(hourlyCounts[18]).toBe(1);
    expect(hourlyCounts[22]).toBe(1);
    expect(hourlyCounts[23]).toBe(3);
    expect(hourlyCounts.filter(count => count > 0).length).toBe(5);
  });

  fit('should update chart data from static timestamps', async () => {
    const { updateChartFromTimestamps } = await import('../assets/chart.js');
    const timestamps = [1750205183751];
    const hourlyCounts = updateChartFromTimestamps(timestamps, new Date(1750266177113));
    expect(hourlyCounts[6]).toBe(1);
    expect(hourlyCounts.filter(count => count > 0).length).toBe(1);
  });
});
