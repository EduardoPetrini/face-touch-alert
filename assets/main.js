import { attachHolistic, onResults, reportModelLoadFailure, setupCamera } from './functions.js';
import { createHolistic } from './holistic-factory.js';

// The camera prompt and the model download run in parallel; the supervisor
// starts detection once both are ready.
setupCamera();

createHolistic({ onResults }).then(attachHolistic, reportModelLoadFailure);
