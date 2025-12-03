import { getInt, setInt } from './storage.js';
import { getSoundName } from './sound-names.js';

const muteBtn = document.getElementById('muteBtn');
const pauseBtn = document.getElementById('pauseBtn');
const volDownBtn = document.getElementById('volDownBtn');
const volUpBtn = document.getElementById('volUpBtn');
const changeSoundBtn = document.getElementById('changeSoundBtn');

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
updatePauseButton();
updateControlTxt();

volDownBtn.title = `Volume: ${Math.round(alertSound.volume * 100)}%`;
volUpBtn.title = `Volume: ${Math.round(alertSound.volume * 100)}%`;

muteBtn.addEventListener('click', () => {
  const alertSound = document.getElementById('alertSound');
  alertSound.muted = !alertSound.muted;
  muteBtn.title = alertSound.muted ? 'Unmute' : 'Mute';

  if (alertSound.muted) {
    muteBtn.innerHTML = '<i data-feather="volume-x"></i>';
  } else {
    muteBtn.innerHTML = '<i data-feather="volume-2"></i>';
  }
  feather.replace();

  updateControlTxt();
});

function updatePauseButton() {
  const isPaused = getInt('isPaused') || 0;

  if (isPaused) {
    pauseBtn.title = 'Resume Detection';
    pauseBtn.innerHTML = '<i data-feather="play-circle"></i>';
    setInt('isPaused', 0);
  } else {
    pauseBtn.title = 'Pause Detection';
    pauseBtn.innerHTML = '<i data-feather="pause-circle"></i>';
    setInt('isPaused', 1);
  }
  feather.replace();

  updateControlTxt();
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
  alertSound.play();

  const friendlyName = getSoundName(ALERT_SOUNDS[nextSoundIndex]);
  changeSoundBtn.title = `Change sound: ${friendlyName}`;

  setInt('alertSoundIndex', nextSoundIndex);

  updateControlTxt();
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
  changeSoundBtnTxt.textContent = getSoundName(currentSoundUrl);

  // Update Mute Status
  muteBtnTxt.textContent = alertSound.muted ? 'Muted' : 'On';
  muteBtnTxt.style.color = alertSound.muted ? 'var(--gray-400)' : 'var(--success-400)';
}
