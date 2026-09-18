// Builds the offline edition into dist-offline/: a folder that works when the
// user double-clicks index.html, with no server and no network.
//
//   npm run build:offline     -> dist-offline/
//   npm run package:offline   -> face-touch-alert-offline.zip
//
// See CLAUDE.md ("Offline edition") for why each piece looks the way it does.

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { HOLISTIC_VERSION } from '../assets/holistic-factory.js';
import { OFFLINE_ASSET_GLOBAL, OFFLINE_EMBEDDED_FILES, OFFLINE_DATA_DIR, OFFLINE_VENDOR_DIR } from '../offline/offline-assets.js';
import { OFFLINE_ALARM_PATH, REMOTE_ALARM_URL, replaceExactlyOnce, toOfflineHtml } from './offline/transform-html.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist-offline');

// Loaded by our own <script> tag (no crossorigin attribute), so it can stay a
// plain file. Everything it loads in turn is embedded; see offline-assets.js.
const HOLISTIC_ENTRY_FILE = 'holistic.js';

const INTER_WEIGHTS = Object.freeze([300, 400, 500, 600, 700]);

// The hosted app's CDN default survives in app.js as a dead default:
// offline-main.js replaces it via setHolisticSource before the first build.
const ALLOWED_BUNDLE_URL_PREFIXES = Object.freeze(['https://cdn.jsdelivr.net/npm/@mediapipe/holistic@']);

// Straight from node_modules: some packages (chart.js) don't export package.json.
function packageDir(name) {
  return join(ROOT, 'node_modules', name);
}

async function assertHolisticVersion() {
  const { version } = JSON.parse(await readFile(join(packageDir('@mediapipe/holistic'), 'package.json'), 'utf8'));

  if (version !== HOLISTIC_VERSION) {
    throw new Error(`@mediapipe/holistic is ${version} but the app pins ${HOLISTIC_VERSION}. Align package.json with HOLISTIC_VERSION.`);
  }
}

// Swaps the one remote sound in actions.js for the bundled copy. The source
// file stays untouched, so the hosted app keeps its current behaviour.
function localAlarmSound() {
  return {
    name: 'offline-local-alarm-sound',
    transform(code, id) {
      if (!id.endsWith('/assets/actions.js')) {
        return null;
      }

      return replaceExactlyOnce(code, new RegExp(REMOTE_ALARM_URL.replace(/[.?/]/g, '\\$&'), 'g'), OFFLINE_ALARM_PATH, 'the remote alarm URL in actions.js');
    },
  };
}

async function bundleApp() {
  await build({
    configFile: false,
    root: ROOT,
    logLevel: 'warn',
    publicDir: false,
    plugins: [localAlarmSound()],
    build: {
      outDir: OUT,
      emptyOutDir: false,
      // Readable on purpose: people who download the zip are invited to edit app.js.
      minify: false,
      rollupOptions: {
        input: join(ROOT, 'offline/entry.js'),
        output: { format: 'iife', entryFileNames: 'app.js', inlineDynamicImports: true },
      },
    },
  });
}

async function copyMediapipe() {
  const source = packageDir('@mediapipe/holistic');
  await mkdir(join(OUT, OFFLINE_VENDOR_DIR), { recursive: true });
  await mkdir(join(OUT, OFFLINE_DATA_DIR), { recursive: true });

  await cp(join(source, HOLISTIC_ENTRY_FILE), join(OUT, OFFLINE_VENDOR_DIR, HOLISTIC_ENTRY_FILE));

  await Promise.all(
    Object.keys(OFFLINE_EMBEDDED_FILES).map(async file => {
      const base64 = (await readFile(join(source, file))).toString('base64');
      const script =
        `// ${file} from @mediapipe/holistic@${HOLISTIC_VERSION}, base64-encoded so a file:// page can load it.\n` +
        `window.${OFFLINE_ASSET_GLOBAL} = window.${OFFLINE_ASSET_GLOBAL} || {};\n` +
        `window.${OFFLINE_ASSET_GLOBAL}[${JSON.stringify(file)}] = "${base64}";\n`;
      await writeFile(join(OUT, OFFLINE_DATA_DIR, `${file}.js`), script);
    })
  );
}

async function copyVendorLibraries() {
  const fontsDir = join(OUT, 'vendor/fonts');
  await mkdir(fontsDir, { recursive: true });

  await cp(join(packageDir('chart.js'), 'dist/chart.umd.js'), join(OUT, 'vendor/chart.umd.js'));
  await cp(join(packageDir('feather-icons'), 'dist/feather.min.js'), join(OUT, 'vendor/feather.min.js'));

  const interFiles = join(packageDir('@fontsource/inter'), 'files');
  const faces = await Promise.all(
    INTER_WEIGHTS.map(async weight => {
      const file = `inter-latin-${weight}-normal.woff2`;
      await cp(join(interFiles, file), join(fontsDir, file));
      return `@font-face {\n  font-family: 'Inter';\n  font-style: normal;\n  font-weight: ${weight};\n  font-display: swap;\n  src: url('${file}') format('woff2');\n}\n`;
    })
  );
  await writeFile(join(fontsDir, 'inter.css'), faces.join('\n'));
}

async function copyAppFiles() {
  await cp(join(ROOT, 'assets/sounds'), join(OUT, 'assets/sounds'), { recursive: true });
  await cp(join(ROOT, 'offline/sounds/alarm_clock.ogg'), join(OUT, OFFLINE_ALARM_PATH));
  await cp(join(ROOT, 'assets/favicon.png'), join(OUT, 'assets/favicon.png'));
  await cp(join(ROOT, 'privacy.html'), join(OUT, 'privacy.html'));
  await cp(join(ROOT, 'offline/README-OFFLINE.txt'), join(OUT, 'README-OFFLINE.txt'));

  const html = await readFile(join(ROOT, 'index.html'), 'utf8');
  await writeFile(join(OUT, 'index.html'), toOfflineHtml(html));
}

// Belt and braces on top of the transform's own checks.
async function assertNoRemoteResources() {
  const html = await readFile(join(OUT, 'index.html'), 'utf8');
  const remoteInHtml = [...html.matchAll(/\ssrc="(https?:[^"]*)"|<(?!a\s)[a-z]+[^>]*\shref="(https?:[^"]*)"/g)];

  const bundle = await readFile(join(OUT, 'app.js'), 'utf8');
  const remoteInBundle = [...bundle.matchAll(/https?:\/\/[^'"`\s)]+/g)]
    .map(match => match[0])
    .filter(url => !ALLOWED_BUNDLE_URL_PREFIXES.some(prefix => url.startsWith(prefix)));

  const offenders = [...remoteInHtml.map(match => match[1] || match[2]), ...remoteInBundle];

  if (offenders.length > 0) {
    throw new Error(`Offline build still references remote resources:\n  ${offenders.join('\n  ')}`);
  }
}

async function main() {
  await assertHolisticVersion();
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  await bundleApp();
  await Promise.all([copyMediapipe(), copyVendorLibraries(), copyAppFiles()]);
  await assertNoRemoteResources();

  console.log(`Offline edition built in ${OUT}`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
