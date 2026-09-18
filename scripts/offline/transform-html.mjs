// Turns the hosted index.html into the offline edition's index.html.
//
// Pure string work on purpose: every replacement is anchored to the exact tag
// it expects and throws unless it matches exactly once. If index.html changes
// shape, the offline build fails loudly instead of shipping a page that still
// reaches for a CDN. When that happens, update the pattern here.

export const REMOTE_ALARM_URL = 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg';
export const OFFLINE_ALARM_PATH = 'assets/sounds/alarm_clock.ogg';

// The module tags index.html loads, in order. offline/entry.js imports the
// same modules in the same order (with main.js swapped for offline-main.js).
export const EXPECTED_MODULE_ORDER = Object.freeze([
  'assets/storage.js',
  'assets/ui.js',
  'assets/actions.js',
  'assets/functions.js',
  'assets/main.js',
  'assets/chart.js',
]);

export function replaceExactlyOnce(text, pattern, replacement, label) {
  const matches = text.match(pattern) || [];

  if (matches.length !== 1) {
    throw new Error(`Offline build: expected exactly 1 match for ${label}, found ${matches.length}. Update scripts/offline/transform-html.mjs.`);
  }

  return text.replace(pattern, replacement);
}

function assertModuleOrder(html) {
  const found = [...html.matchAll(/<script type="module" src="([^"]+)"><\/script>/g)].map(match => match[1]);

  if (found.join() !== EXPECTED_MODULE_ORDER.join()) {
    throw new Error(
      `Offline build: index.html module scripts changed (${found.join(', ')}). ` +
        'Mirror the new order in offline/entry.js, then update EXPECTED_MODULE_ORDER.'
    );
  }
}

const REPLACEMENTS = Object.freeze([
  {
    label: 'the Google Analytics block',
    pattern: /[ \t]*<!-- Google tag \(gtag\.js\) -->\n[ \t]*<script async src="https:\/\/www\.googletagmanager\.com\/[^"]*"><\/script>\n[ \t]*<script>[\s\S]*?<\/script>\n/g,
    replacement: '',
  },
  {
    label: 'the feather-icons CDN script',
    pattern: /<script src="https:\/\/unpkg\.com\/feather-icons"><\/script>/g,
    replacement: '<script src="vendor/feather.min.js"></script>',
  },
  {
    label: 'the Google Fonts links',
    pattern: /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com" \/>\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin \/>\s*<link href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*" rel="stylesheet" \/>/g,
    replacement: '<link rel="stylesheet" href="vendor/fonts/inter.css" />',
  },
  {
    label: 'the remote alert sound',
    pattern: new RegExp(`<audio id="alertSound" src="${REMOTE_ALARM_URL.replace(/[.?/]/g, '\\$&')}"></audio>`, 'g'),
    replacement: `<audio id="alertSound" src="${OFFLINE_ALARM_PATH}"></audio>`,
  },
  {
    label: 'the Chart.js CDN script and app module scripts',
    pattern: /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/chart\.js"><\/script>(?:\s*<script type="module" src="assets\/[a-z-]+\.js"><\/script>)+/g,
    replacement: '<script src="vendor/chart.umd.js"></script>\n    <script src="app.js"></script>',
  },
]);

export function toOfflineHtml(html) {
  assertModuleOrder(html);

  return REPLACEMENTS.reduce(
    (current, { pattern, replacement, label }) => replaceExactlyOnce(current, pattern, replacement, label),
    html
  );
}
