import { getInt, setInt } from './storage.js';
import { getSoundName } from './sound-names.js';
import { initializeState, setPausedState, subscribe } from './state.js';

const muteBtn = document.getElementById('muteBtn');
const pauseBtn = document.getElementById('pauseBtn');
const volDownBtn = document.getElementById('volDownBtn');
const volUpBtn = document.getElementById('volUpBtn');
const changeSoundBtn = document.getElementById('changeSoundBtn');
const previewSoundBtn = document.getElementById('previewSoundBtn');

const muteBtnTxt = document.getElementById('muteBtnTxt');
const pauseBtnTxt = document.getElementById('pauseBtnTxt');
const volBtnTxt = document.getElementById('volBtnTxt');
const changeSoundBtnTxt = document.getElementById('changeSoundBtnTxt');

const ALERT_SOUNDS = [
  'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg',
  'assets/sounds/mixkit-bell-notification-933.wav',
  'assets/sounds/mixkit-clear-announce-tones-2861.wav',
  'assets/sounds/mixkit-confirmation-tone-2867.wav',
  'assets/sounds/mixkit-correct-answer-tone-2870.wav',
  'assets/sounds/mixkit-digital-quick-tone-2866.wav',
  'assets/sounds/mixkit-happy-bells-notification-937.wav',
  'assets/sounds/mixkit-software-interface-back-2575.wav',
  'assets/sounds/mixkit-software-interface-start-2574.wav',
  'assets/sounds/mixkit-urgent-simple-tone-loop-2976.wav',
];

const alertSound = document.getElementById('alertSound');
alertSound.src = ALERT_SOUNDS[getInt('alertSoundIndex') || 0];
initializeState();
subscribe(renderSystemControls);
updateControlTxt();

volDownBtn.title = `Volume: ${Math.round(alertSound.volume * 100)}%`;
volUpBtn.title = `Volume: ${Math.round(alertSound.volume * 100)}%`;
previewSoundBtn.title = `Preview sound: ${getSoundName(alertSound.src)}`;

muteBtn.addEventListener('click', () => {
  const alertSound = document.getElementById('alertSound');
  alertSound.muted = !alertSound.muted;
  muteBtn.title = alertSound.muted ? 'Unmute' : 'Mute';
  muteBtn.setAttribute('aria-label', alertSound.muted ? 'Unmute alerts' : 'Mute alerts');
  muteBtn.setAttribute('aria-pressed', alertSound.muted ? 'true' : 'false');

  if (alertSound.muted) {
    muteBtn.innerHTML = '<i data-feather="volume-x"></i>';
  } else {
    muteBtn.innerHTML = '<i data-feather="volume-2"></i>';
  }
  feather.replace();

  updateControlTxt();
});

function renderPauseButton() {
  const isPaused = getInt('isPaused') || 0;

  if (isPaused) {
    pauseBtn.title = 'Resume Detection';
    pauseBtn.setAttribute('aria-label', 'Resume detection');
    pauseBtn.setAttribute('aria-pressed', 'true');
    pauseBtn.innerHTML = '<i data-feather="play-circle"></i>';
  } else {
    pauseBtn.title = 'Pause Detection';
    pauseBtn.setAttribute('aria-label', 'Pause detection');
    pauseBtn.setAttribute('aria-pressed', 'false');
    pauseBtn.innerHTML = '<i data-feather="pause-circle"></i>';
  }
  feather.replace();
}

function updatePauseButton() {
  const isPaused = getInt('isPaused') || 0;
  setPausedState(!isPaused);
}
pauseBtn.addEventListener('click', updatePauseButton);

volDownBtn.addEventListener('click', () => {
  const alertSound = document.getElementById('alertSound');
  const currentVolume = alertSound.volume;
  const newVolume = Math.max(0, currentVolume - 0.1);
  alertSound.volume = newVolume;
  volDownBtn.title = `Volume: ${Math.round(newVolume * 100)}%`;
  volUpBtn.title = `Volume: ${Math.round(newVolume * 100)}%`;

  updateControlTxt();
});

volUpBtn.addEventListener('click', () => {
  const alertSound = document.getElementById('alertSound');
  const currentVolume = alertSound.volume;
  const newVolume = Math.min(1, currentVolume + 0.1);
  alertSound.volume = newVolume;
  volUpBtn.title = `Volume: ${Math.round(newVolume * 100)}%`;
  volDownBtn.title = `Volume: ${Math.round(newVolume * 100)}%`;

  updateControlTxt();
});

changeSoundBtn.addEventListener('click', () => {
  const alertSound = document.getElementById('alertSound');
  const currentSoundIndex = ALERT_SOUNDS.findIndex(sound => sound.split('/').pop() === alertSound.src.split('/').pop());
  const nextSoundIndex = (currentSoundIndex + 1) % ALERT_SOUNDS.length;
  alertSound.src = ALERT_SOUNDS[nextSoundIndex];
  alertSound.load();

  const friendlyName = getSoundName(ALERT_SOUNDS[nextSoundIndex]);
  changeSoundBtn.title = `Choose next alert sound. Current: ${friendlyName}`;
  previewSoundBtn.title = `Preview sound: ${friendlyName}`;

  setInt('alertSoundIndex', nextSoundIndex);

  updateControlTxt();
});

previewSoundBtn.addEventListener('click', async () => {
  try {
    alertSound.currentTime = 0;
    await alertSound.play();
  } catch (error) {
    console.warn('Sound preview failed:', error);
  }
});

function updateControlTxt() {
  const isPaused = getInt('isPaused') || 0;

  // Update Pause Status
  pauseBtnTxt.textContent = isPaused ? 'Paused' : 'Active';
  pauseBtnTxt.style.color = isPaused ? 'var(--warning-400)' : 'var(--success-400)';

  // Update Volume Status
  volBtnTxt.textContent = `${Math.round(alertSound.volume * 100)}%`;

  // Update Sound Name
  const currentSoundUrl = alertSound.src;
  const soundName = getSoundName(currentSoundUrl);
  changeSoundBtnTxt.textContent = soundName;
  changeSoundBtn.title = `Choose next alert sound. Current: ${soundName}`;
  previewSoundBtn.title = `Preview sound: ${soundName}`;

  // Update Mute Status
  muteBtnTxt.textContent = alertSound.muted ? 'Muted' : 'On';
  muteBtnTxt.style.color = alertSound.muted ? 'var(--gray-400)' : 'var(--success-400)';
}

function renderSystemControls() {
  renderPauseButton();
  updateControlTxt();
}
