import { getInt, setInt } from './storage.js';

export const APP_STATUS = Object.freeze({
  LOADING: 'loading',
  ACTIVE: 'active',
  PAUSED: 'paused',
  ERROR: 'error',
});

const listeners = new Set();

const state = {
  status: APP_STATUS.LOADING,
  isPaused: false,
  statusMessage: 'Loading the system...',
  errorMessage: '',
};

function emitChange() {
  const snapshot = getState();
  listeners.forEach(listener => listener(snapshot));
}

export function getState() {
  return { ...state };
}

export function subscribe(listener) {
  listeners.add(listener);
  listener(getState());

  return () => {
    listeners.delete(listener);
  };
}

export function initializeState() {
  state.isPaused = false;
  state.status = APP_STATUS.LOADING;
  state.statusMessage = 'Loading the system...';
  state.errorMessage = '';

  // The system should always start active on a fresh page load.
  setInt('isPaused', 0);
  emitChange();
}

export function setLoadingState(message = 'Loading the system...') {
  state.status = APP_STATUS.LOADING;
  state.statusMessage = message;
  state.errorMessage = '';
  emitChange();
}

export function setReadyState() {
  state.status = state.isPaused ? APP_STATUS.PAUSED : APP_STATUS.ACTIVE;
  state.statusMessage = state.isPaused ? 'Detection paused' : 'Live detection active';
  state.errorMessage = '';
  emitChange();
}

export function setPausedState(isPaused) {
  state.isPaused = Boolean(isPaused);
  setInt('isPaused', state.isPaused ? 1 : 0);
  state.status = state.isPaused ? APP_STATUS.PAUSED : APP_STATUS.ACTIVE;
  state.statusMessage = state.isPaused ? 'Detection paused' : 'Live detection active';
  state.errorMessage = '';
  emitChange();
}

export function setErrorState(message) {
  state.status = APP_STATUS.ERROR;
  state.statusMessage = message;
  state.errorMessage = message;
  emitChange();
}

export function syncPausedStateFromStorage() {
  state.isPaused = Boolean(getInt('isPaused'));
  emitChange();
}
