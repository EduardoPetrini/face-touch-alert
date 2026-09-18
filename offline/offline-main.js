import { attachHolistic, onResults, reportModelLoadFailure, setupCamera } from '../assets/functions.js';
import { createHolistic, setHolisticSource } from '../assets/holistic-factory.js';
import { OFFLINE_VENDOR_DIR, prepareOfflineAssets } from './offline-assets.js';

// The offline edition's counterpart to assets/main.js. Same flow, but the
// model comes from files inside the zip instead of the CDN. setHolisticSource
// runs before the first build so the supervisor's rebuilds stay offline too.
setupCamera();

prepareOfflineAssets()
  .then(locateFile => {
    setHolisticSource({ baseUrl: OFFLINE_VENDOR_DIR, locateFile });
    return createHolistic({ onResults });
  })
  .then(attachHolistic, reportModelLoadFailure);
