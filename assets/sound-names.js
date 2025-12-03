/**
 * Sound Name Mapping System
 * Maps sound file names to user-friendly display names
 */

// Mapping of sound file names to user-friendly names
export const SOUND_NAMES = {
  // Google Actions sound
  'alarm_clock.ogg': 'Alarm Clock',
  
  // Local sound files
  'mixkit-bell-notification-933.wav': 'Bell',
  'mixkit-clear-announce-tones-2861.wav': 'Clear Tones',
  'mixkit-confirmation-tone-2867.wav': 'Confirmation',
  'mixkit-confirmation-tone-2867 (1).wav': 'Confirmation Alt',
  'mixkit-correct-answer-tone-2870.wav': 'Success Chime',
  'mixkit-digital-quick-tone-2866.wav': 'Digital Beep',
  'mixkit-happy-bells-notification-937.wav': 'Happy Bells',
  'mixkit-software-interface-back-2575.wav': 'Interface Back',
  'mixkit-software-interface-start-2574.wav': 'Interface Start',
  'mixkit-urgent-simple-tone-loop-2976.wav': 'Urgent Alert'
};

/**
 * Resolves a user-friendly sound name from a sound URL or file path
 * @param {string} soundUrl - The URL or file path of the sound
 * @returns {string} User-friendly sound name or fallback
 */
export function getSoundName(soundUrl) {
  try {
    // Handle null, undefined, or empty string
    if (!soundUrl || typeof soundUrl !== 'string') {
      console.warn('Invalid sound URL provided:', soundUrl);
      return 'Unknown Sound';
    }

    // Extract filename from URL/path
    const fileName = soundUrl.split('/').pop();
    
    // Handle case where split results in empty string
    if (!fileName) {
      console.warn('Could not extract filename from URL:', soundUrl);
      return 'Unknown Sound';
    }

    // Look up the friendly name
    const friendlyName = SOUND_NAMES[fileName];
    
    if (friendlyName) {
      return friendlyName;
    } else {
      console.warn('No friendly name found for sound file:', fileName);
      return 'Unknown Sound';
    }
    
  } catch (error) {
    console.error('Error resolving sound name:', error);
    return 'Unknown Sound';
  }
}

/**
 * Gets all available sound names as an array
 * @returns {Array<{fileName: string, friendlyName: string}>} Array of sound mappings
 */
export function getAllSoundNames() {
  return Object.entries(SOUND_NAMES).map(([fileName, friendlyName]) => ({
    fileName,
    friendlyName
  }));
}

/**
 * Checks if a sound file has a friendly name mapping
 * @param {string} soundUrl - The URL or file path of the sound
 * @returns {boolean} True if a mapping exists
 */
export function hasSoundName(soundUrl) {
  try {
    if (!soundUrl || typeof soundUrl !== 'string') {
      return false;
    }
    
    const fileName = soundUrl.split('/').pop();
    return fileName && SOUND_NAMES.hasOwnProperty(fileName);
  } catch (error) {
    console.error('Error checking sound name existence:', error);
    return false;
  }
}
