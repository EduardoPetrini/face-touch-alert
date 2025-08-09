import { getInt, setInt } from './storage.js';

const muteBtn = document.getElementById('muteBtn');
const pauseBtn = document.getElementById('pauseBtn');
const volDownBtn = document.getElementById('volDownBtn');
const volUpBtn = document.getElementById('volUpBtn');
const changeSoundBtn = document.getElementById('changeSoundBtn');

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

volDownBtn.title = `Volume: ${Math.round(alertSound.volume * 100)}%`;
volUpBtn.title = `Volume: ${Math.round(alertSound.volume * 100)}%`;

muteBtn.addEventListener('click', () => {
  const alertSound = document.getElementById('alertSound');
  alertSound.muted = !alertSound.muted;
  muteBtn.title = alertSound.muted ? 'Unmute' : 'Mute';
  feather.replace();
});

function updatePauseButton() {
  const isPaused = getInt('isPaused') || 0;
  const icon = pauseBtn.querySelector('svg');
  if (isPaused) {
    pauseBtn.title = 'Pause';
    icon.outerHTML = feather.icons['pause'].toSvg();
    setInt('isPaused', 0);
  } else {
    pauseBtn.title = 'Play';
    icon.outerHTML = feather.icons['play'].toSvg();
    setInt('isPaused', 1);
  }
  feather.replace();
}
pauseBtn.addEventListener('click', updatePauseButton);

volDownBtn.addEventListener('click', () => {
  const alertSound = document.getElementById('alertSound');
  const currentVolume = alertSound.volume;
  const newVolume = Math.max(0, currentVolume - 0.1);
  alertSound.volume = newVolume;
  volDownBtn.title = `Volume: ${Math.round(newVolume * 100)}%`;
  volUpBtn.title = `Volume: ${Math.round(newVolume * 100)}%`;
  feather.replace();
});

volUpBtn.addEventListener('click', () => {
  const alertSound = document.getElementById('alertSound');
  const currentVolume = alertSound.volume;
  const newVolume = Math.min(1, currentVolume + 0.1);
  alertSound.volume = newVolume;
  volUpBtn.title = `Volume: ${Math.round(newVolume * 100)}%`;
  volDownBtn.title = `Volume: ${Math.round(newVolume * 100)}%`;
  feather.replace();
});

changeSoundBtn.addEventListener('click', () => {
  const alertSound = document.getElementById('alertSound');
  const currentSoundIndex = ALERT_SOUNDS.findIndex(sound => sound.split('/').pop() === alertSound.src.split('/').pop());
  const nextSoundIndex = (currentSoundIndex + 1) % ALERT_SOUNDS.length;
  alertSound.src = ALERT_SOUNDS[nextSoundIndex];
  alertSound.load();
  alertSound.play();
  changeSoundBtn.title = `Change sound (${nextSoundIndex + 1}/${ALERT_SOUNDS.length})`;
  feather.replace();
  setInt('alertSoundIndex', nextSoundIndex);
});
