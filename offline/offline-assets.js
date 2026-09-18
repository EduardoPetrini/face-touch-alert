// Serves MediaPipe's WASM, model, and loader files to a page opened from file://.
//
// Browsers refuse fetch/XHR of sibling files on file:// pages, but classic
// <script src> tags still load. So the offline build wraps each file in a
// script (vendor/mediapipe-data/<file>.js) that stores it as base64 on
// window[OFFLINE_ASSET_GLOBAL]. This module injects those scripts, turns each
// payload into a Blob URL — which MediaPipe *can* fetch — and returns the
// locateFile callback that points MediaPipe at them.
//
// The Blob URLs are never revoked: the supervisor rebuilds Holistic after a
// wedge, and every rebuild fetches the same files again.

export const OFFLINE_ASSET_GLOBAL = '__FTA_OFFLINE_ASSETS__';
export const OFFLINE_VENDOR_DIR = 'vendor/mediapipe';
export const OFFLINE_DATA_DIR = 'vendor/mediapipe-data';

// Files served as Blob URLs, with the MIME type each Blob needs.
// application/wasm lets WebAssembly.instantiateStreaming work. The loader
// scripts are here too, not beside the page: holistic.js injects them with
// crossorigin="anonymous", and a CORS-mode load of a file:// URL always fails.
// The build script reads this list, so it is the single source of truth.
export const OFFLINE_EMBEDDED_FILES = Object.freeze({
  'holistic.binarypb': 'application/octet-stream',
  'holistic_solution_packed_assets.data': 'application/octet-stream',
  'holistic_solution_packed_assets_loader.js': 'text/javascript',
  'holistic_solution_simd_wasm_bin.js': 'text/javascript',
  'holistic_solution_simd_wasm_bin.wasm': 'application/wasm',
  'holistic_solution_wasm_bin.js': 'text/javascript',
  'holistic_solution_wasm_bin.wasm': 'application/wasm',
  'pose_landmark_full.tflite': 'application/octet-stream',
});

export function offlineAssetScriptPath(file) {
  return `${OFFLINE_DATA_DIR}/${file}.js`;
}

function decodeBase64(host, base64) {
  const binary = host.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

// Hands the payload over and forgets it: a model file held twice, as base64
// and as bytes, would double the page's memory for no reason.
function takePayload(host, file) {
  const { [file]: payload, ...rest } = host[OFFLINE_ASSET_GLOBAL] || {};
  host[OFFLINE_ASSET_GLOBAL] = rest;
  return payload;
}

function loadAsBlobUrl({ doc, host, file, type }) {
  return new Promise((resolve, reject) => {
    const script = doc.createElement('script');

    const rejectAsDamaged = () => reject(new Error(`Model file ${file} is damaged. Please re-extract the zip.`));

    script.onload = () => {
      script.remove();
      const payload = takePayload(host, file);

      if (typeof payload !== 'string') {
        rejectAsDamaged();
        return;
      }

      // An event handler's throw would not reject this promise; it would leave
      // the app on the loading screen forever. Corrupt base64 must reject.
      try {
        const blob = new host.Blob([decodeBase64(host, payload)], { type });
        resolve(host.URL.createObjectURL(blob));
      } catch {
        rejectAsDamaged();
      }
    };

    script.onerror = () => {
      script.remove();
      reject(new Error(`Model file ${file} is missing. Please re-extract the zip, keeping its folders intact.`));
    };

    script.src = offlineAssetScriptPath(file);
    doc.body.appendChild(script);
  });
}

export async function prepareOfflineAssets({
  doc = globalThis.document,
  host = globalThis,
  files = OFFLINE_EMBEDDED_FILES,
} = {}) {
  const entries = Object.entries(files);
  const urls = await Promise.all(entries.map(([file, type]) => loadAsBlobUrl({ doc, host, file, type })));
  const blobUrls = new Map(entries.map(([file], index) => [file, urls[index]]));

  // Anything not embedded falls back to a plain file beside the page.
  return file => blobUrls.get(file) ?? `${OFFLINE_VENDOR_DIR}/${file}`;
}
