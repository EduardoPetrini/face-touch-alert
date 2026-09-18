import { readFileSync } from 'node:fs';
import { OFFLINE_ALARM_PATH, REMOTE_ALARM_URL, replaceExactlyOnce, toOfflineHtml } from '../scripts/offline/transform-html.mjs';

// Runs against the real index.html on purpose: if someone edits a CDN tag
// there, this spec (and the offline build) should fail rather than ship a zip
// that silently reaches for the network.

const SOURCE_HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function remoteResourceUrls(html) {
  // src= anywhere, plus href= on anything but <a> (links the user clicks are fine).
  const srcUrls = [...html.matchAll(/\ssrc="(https?:[^"]*)"/g)].map(match => match[1]);
  const hrefUrls = [...html.matchAll(/<(?!a\s)[a-z]+[^>]*\shref="(https?:[^"]*)"/g)].map(match => match[1]);
  return [...srcUrls, ...hrefUrls];
}

describe('Offline HTML transform', () => {
  let offlineHtml;

  beforeAll(() => {
    offlineHtml = toOfflineHtml(SOURCE_HTML);
  });

  it('starts from a page that does load remote resources', () => {
    expect(remoteResourceUrls(SOURCE_HTML).length).toBeGreaterThan(0);
  });

  it('leaves no remote script, stylesheet, or audio source', () => {
    expect(remoteResourceUrls(offlineHtml)).toEqual([]);
  });

  it('drops analytics entirely', () => {
    expect(offlineHtml).not.toContain('gtag');
    expect(offlineHtml).not.toContain('googletagmanager');
  });

  it('points the default alert sound at the bundled copy', () => {
    expect(offlineHtml).toContain(`<audio id="alertSound" src="${OFFLINE_ALARM_PATH}"></audio>`);
    expect(offlineHtml).not.toContain(REMOTE_ALARM_URL);
  });

  it('replaces module scripts with classic ones, since file:// blocks modules', () => {
    expect(offlineHtml).not.toContain('type="module"');
  });

  it('loads feather before its inline call, and Chart before the app bundle', () => {
    const position = needle => {
      const index = offlineHtml.indexOf(needle);
      expect(index).withContext(needle).toBeGreaterThan(-1);
      return index;
    };

    expect(position('vendor/fonts/inter.css')).toBeLessThan(position('</head>'));
    expect(position('src="vendor/feather.min.js"')).toBeLessThan(position('feather.replace()'));
    expect(position('src="vendor/chart.umd.js"')).toBeLessThan(position('src="app.js"'));
    expect(position('src="app.js"')).toBeLessThan(position('</body>'));
  });

  it('fails loudly when an expected tag has changed', () => {
    const drifted = SOURCE_HTML.replace('https://cdn.jsdelivr.net/npm/chart.js', 'https://cdn.example.com/chart.js');

    expect(() => toOfflineHtml(drifted)).toThrowError(/Chart\.js/);
  });

  describe('replaceExactlyOnce', () => {
    it('rejects a pattern that matches more than once', () => {
      expect(() => replaceExactlyOnce('a a', /a/g, 'b', 'letter')).toThrowError(/letter.*2/);
    });
  });
});
