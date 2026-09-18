import { JSDOM } from 'jsdom';
import {
  OFFLINE_ASSET_GLOBAL,
  OFFLINE_DATA_DIR,
  OFFLINE_VENDOR_DIR,
  offlineAssetScriptPath,
  prepareOfflineAssets,
} from '../offline/offline-assets.js';

// Everything is injected — document and host — and no globals are assigned,
// so random ordering cannot leak state into other specs. jsdom does not run
// external scripts, so each test plays the data script by hand: it stores the
// base64 payload on the host global, then fires onload.

const FILES = Object.freeze({
  'model.wasm': 'application/wasm',
  'model.data': 'application/octet-stream',
});

function createHost() {
  const created = [];

  return {
    created,
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    Blob: class FakeBlob {
      constructor(parts, { type }) {
        this.bytes = parts[0];
        this.type = type;
      }
    },
    URL: {
      createObjectURL(blob) {
        created.push(blob);
        return `blob:offline/${created.length}`;
      },
    },
  };
}

describe('Offline assets', () => {
  let doc;
  let host;

  function scripts() {
    return [...doc.querySelectorAll('script')];
  }

  function deliver(file, base64) {
    host[OFFLINE_ASSET_GLOBAL] = { ...host[OFFLINE_ASSET_GLOBAL], [file]: base64 };
    scripts()
      .find(script => script.getAttribute('src') === offlineAssetScriptPath(file))
      .onload();
  }

  function deliverAll() {
    deliver('model.wasm', Buffer.from([0, 97, 115, 109]).toString('base64'));
    deliver('model.data', Buffer.from('hello').toString('base64'));
  }

  beforeEach(() => {
    doc = new JSDOM('<!doctype html><html><body></body></html>').window.document;
    host = createHost();
  });

  it('injects one data script per embedded file, in parallel', () => {
    prepareOfflineAssets({ doc, host, files: FILES });

    expect(scripts().map(script => script.getAttribute('src'))).toEqual([
      `${OFFLINE_DATA_DIR}/model.wasm.js`,
      `${OFFLINE_DATA_DIR}/model.data.js`,
    ]);
  });

  it('decodes each payload into a blob with its MIME type', async () => {
    const preparing = prepareOfflineAssets({ doc, host, files: FILES });
    deliverAll();
    await preparing;

    const [wasm, data] = host.created;
    expect(wasm.type).toBe('application/wasm');
    expect([...wasm.bytes]).toEqual([0, 97, 115, 109]);
    expect(data.type).toBe('application/octet-stream');
    expect(Buffer.from(data.bytes).toString()).toBe('hello');
  });

  it('resolves locateFile to blob URLs for embedded files and vendor paths for everything else', async () => {
    const preparing = prepareOfflineAssets({ doc, host, files: FILES });
    deliverAll();
    const locateFile = await preparing;

    expect(locateFile('model.wasm')).toBe('blob:offline/1');
    expect(locateFile('model.data')).toBe('blob:offline/2');
    expect(locateFile('other.js')).toBe(`${OFFLINE_VENDOR_DIR}/other.js`);
  });

  it('drops the base64 payloads and script tags once decoded, to free memory', async () => {
    const preparing = prepareOfflineAssets({ doc, host, files: FILES });
    deliverAll();
    await preparing;

    expect(host[OFFLINE_ASSET_GLOBAL]).toEqual({});
    expect(scripts().length).toBe(0);
  });

  it('rejects with a re-extract hint when a data script is missing', async () => {
    const preparing = prepareOfflineAssets({ doc, host, files: FILES });

    scripts()[0].onerror();

    await expectAsync(preparing).toBeRejectedWithError(/model\.wasm.*re-extract/);
  });

  it('rejects, rather than hanging, when a payload is not valid base64', async () => {
    host.atob = () => {
      throw new Error('InvalidCharacterError');
    };
    const preparing = prepareOfflineAssets({ doc, host, files: FILES });

    deliver('model.wasm', '%%corrupt%%');

    await expectAsync(preparing).toBeRejectedWithError(/model\.wasm is damaged/);
  });

  it('rejects when a data script loads without its payload', async () => {
    const preparing = prepareOfflineAssets({ doc, host, files: FILES });

    scripts()[0].onload();

    await expectAsync(preparing).toBeRejectedWithError(/model\.wasm/);
  });
});
