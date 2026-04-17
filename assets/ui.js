import { APP_STATUS, subscribe } from './state.js';

const loadingElement = document.getElementById('loading');
const loadingSpinnerElement = loadingElement.querySelector('.loading-spinner');
const loadingMessageElement = document.getElementById('loadingMessage');
const videoContainerElement = document.getElementById('videoContainer');
const videoOverlayElement = document.getElementById('videoOverlay');
const statusLiveRegionElement = document.getElementById('statusLiveRegion');

function renderAppState(state) {
  loadingMessageElement.textContent = state.statusMessage;
  statusLiveRegionElement.textContent = state.statusMessage;

  const isLoading = state.status === APP_STATUS.LOADING;
  const isError = state.status === APP_STATUS.ERROR;
  const isPaused = state.status === APP_STATUS.PAUSED;
  const isActive = state.status === APP_STATUS.ACTIVE;

  loadingElement.style.display = isLoading || isError ? 'flex' : 'none';
  loadingElement.setAttribute('aria-hidden', isLoading || isError ? 'false' : 'true');
  loadingElement.dataset.state = state.status;
  loadingSpinnerElement.style.display = isError ? 'none' : 'block';

  videoContainerElement.classList.toggle('active', isActive);
  videoContainerElement.classList.toggle('paused', isPaused);
  videoContainerElement.classList.toggle('error', isError);

  videoOverlayElement.textContent = state.statusMessage;
  videoOverlayElement.dataset.state = state.status;
}

subscribe(renderAppState);
