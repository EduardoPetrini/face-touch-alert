import { JSDOM } from 'jsdom';

// Set up DOM environment for testing
const dom = new JSDOM(`<!doctype html><html><body></body></html>`);
global.window = dom.window;
global.document = dom.window.document;
global.console = {
  warn: jasmine.createSpy('console.warn'),
  error: jasmine.createSpy('console.error')
};

describe('Sound Name Mapping System', () => {
  let getSoundName, hasSoundName, getAllSoundNames, SOUND_NAMES;

  beforeEach(async () => {
    // Reset console spies
    global.console.warn.calls.reset();
    global.console.error.calls.reset();
    
    // Import the module
    const module = await import('../assets/sound-names.js');
    getSoundName = module.getSoundName;
    hasSoundName = module.hasSoundName;
    getAllSoundNames = module.getAllSoundNames;
    SOUND_NAMES = module.SOUND_NAMES;
  });

  describe('SOUND_NAMES object', () => {
    it('should contain mappings for all expected sound files', () => {
      expect(SOUND_NAMES['alarm_clock.ogg']).toBe('Alarm Clock');
      expect(SOUND_NAMES['mixkit-bell-notification-933.wav']).toBe('Bell');
      expect(SOUND_NAMES['mixkit-clear-announce-tones-2861.wav']).toBe('Clear Tones');
      expect(SOUND_NAMES['mixkit-confirmation-tone-2867.wav']).toBe('Confirmation');
      expect(SOUND_NAMES['mixkit-correct-answer-tone-2870.wav']).toBe('Success Chime');
      expect(SOUND_NAMES['mixkit-digital-quick-tone-2866.wav']).toBe('Digital Beep');
      expect(SOUND_NAMES['mixkit-happy-bells-notification-937.wav']).toBe('Happy Bells');
      expect(SOUND_NAMES['mixkit-software-interface-back-2575.wav']).toBe('Interface Back');
      expect(SOUND_NAMES['mixkit-software-interface-start-2574.wav']).toBe('Interface Start');
      expect(SOUND_NAMES['mixkit-urgent-simple-tone-loop-2976.wav']).toBe('Urgent Alert');
    });

    it('should have at least 10 sound mappings', () => {
      expect(Object.keys(SOUND_NAMES).length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('getSoundName function', () => {
    it('should return correct friendly name for valid sound URLs', () => {
      expect(getSoundName('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg')).toBe('Alarm Clock');
      expect(getSoundName('assets/sounds/mixkit-bell-notification-933.wav')).toBe('Bell');
      expect(getSoundName('/path/to/mixkit-clear-announce-tones-2861.wav')).toBe('Clear Tones');
    });

    it('should return correct friendly name for file paths with complex directory structures', () => {
      expect(getSoundName('../../assets/sounds/mixkit-confirmation-tone-2867.wav')).toBe('Confirmation');
      expect(getSoundName('C:\\Users\\sounds\\mixkit-digital-quick-tone-2866.wav')).toBe('Digital Beep');
    });

    it('should handle URLs with query parameters', () => {
      expect(getSoundName('assets/sounds/mixkit-bell-notification-933.wav?v=1.0')).toBe('Unknown Sound');
    });

    it('should return "Unknown Sound" for files not in the mapping', () => {
      expect(getSoundName('assets/sounds/unknown-sound.wav')).toBe('Unknown Sound');
      expect(getSoundName('https://example.com/random-sound.mp3')).toBe('Unknown Sound');
    });

    it('should handle invalid inputs gracefully', () => {
      expect(getSoundName(null)).toBe('Unknown Sound');
      expect(getSoundName(undefined)).toBe('Unknown Sound');
      expect(getSoundName('')).toBe('Unknown Sound');
      expect(getSoundName(123)).toBe('Unknown Sound');
      expect(getSoundName({})).toBe('Unknown Sound');
      expect(getSoundName([])).toBe('Unknown Sound');
    });

    it('should handle edge cases with URL parsing', () => {
      expect(getSoundName('/')).toBe('Unknown Sound');
      expect(getSoundName('//')).toBe('Unknown Sound');
      expect(getSoundName('just-filename.wav')).toBe('Unknown Sound');
    });

    it('should log warnings for invalid inputs', () => {
      getSoundName(null);
      expect(global.console.warn).toHaveBeenCalledWith('Invalid sound URL provided:', null);
      
      getSoundName('');
      expect(global.console.warn).toHaveBeenCalledWith('Invalid sound URL provided:', '');
    });

    it('should log warnings for unknown sound files', () => {
      getSoundName('assets/sounds/unknown-file.wav');
      expect(global.console.warn).toHaveBeenCalledWith('No friendly name found for sound file:', 'unknown-file.wav');
    });

    it('should handle errors in URL parsing', () => {
      // Mock a scenario where split might throw an error
      const originalSplit = String.prototype.split;
      String.prototype.split = jasmine.createSpy('split').and.throwError('Mock error');
      
      const result = getSoundName('test-url');
      expect(result).toBe('Unknown Sound');
      expect(global.console.error).toHaveBeenCalledWith('Error resolving sound name:', jasmine.any(Error));
      
      // Restore original split method
      String.prototype.split = originalSplit;
    });
  });

  describe('hasSoundName function', () => {
    it('should return true for sounds that have mappings', () => {
      expect(hasSoundName('assets/sounds/mixkit-bell-notification-933.wav')).toBe(true);
      expect(hasSoundName('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg')).toBe(true);
    });

    it('should return false for sounds that do not have mappings', () => {
      expect(hasSoundName('assets/sounds/unknown-sound.wav')).toBe(false);
      expect(hasSoundName('https://example.com/random.mp3')).toBe(false);
    });

    it('should return false for invalid inputs', () => {
      expect(hasSoundName(null)).toBe(false);
      expect(hasSoundName(undefined)).toBe(false);
      expect(hasSoundName('')).toBe(false);
      expect(hasSoundName(123)).toBe(false);
      expect(hasSoundName({})).toBe(false);
    });

    it('should handle errors gracefully', () => {
      // Mock a scenario where split might throw an error
      const originalSplit = String.prototype.split;
      String.prototype.split = jasmine.createSpy('split').and.throwError('Mock error');
      
      const result = hasSoundName('test-url');
      expect(result).toBe(false);
      expect(global.console.error).toHaveBeenCalledWith('Error checking sound name existence:', jasmine.any(Error));
      
      // Restore original split method
      String.prototype.split = originalSplit;
    });
  });

  describe('getAllSoundNames function', () => {
    it('should return an array of sound mappings', () => {
      const soundNames = getAllSoundNames();
      expect(Array.isArray(soundNames)).toBe(true);
      expect(soundNames.length).toBeGreaterThan(0);
    });

    it('should return objects with fileName and friendlyName properties', () => {
      const soundNames = getAllSoundNames();
      soundNames.forEach(sound => {
        expect(sound).toHaveProperty('fileName');
        expect(sound).toHaveProperty('friendlyName');
        expect(typeof sound.fileName).toBe('string');
        expect(typeof sound.friendlyName).toBe('string');
      });
    });

    it('should include all mappings from SOUND_NAMES', () => {
      const soundNames = getAllSoundNames();
      const expectedCount = Object.keys(SOUND_NAMES).length;
      expect(soundNames.length).toBe(expectedCount);
    });

    it('should contain expected sound mappings', () => {
      const soundNames = getAllSoundNames();
      const bellMapping = soundNames.find(sound => sound.fileName === 'mixkit-bell-notification-933.wav');
      expect(bellMapping).toBeDefined();
      expect(bellMapping.friendlyName).toBe('Bell');
      
      const alarmMapping = soundNames.find(sound => sound.fileName === 'alarm_clock.ogg');
      expect(alarmMapping).toBeDefined();
      expect(alarmMapping.friendlyName).toBe('Alarm Clock');
    });
  });

  describe('Integration tests', () => {
    it('should work correctly with actual sound URLs from the application', () => {
      // Test with the actual sound URLs used in the application
      const testUrls = [
        'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg',
        'assets/sounds/mixkit-bell-notification-933.wav',
        'assets/sounds/mixkit-clear-announce-tones-2861.wav',
        'assets/sounds/mixkit-confirmation-tone-2867.wav',
        'assets/sounds/mixkit-correct-answer-tone-2870.wav'
      ];

      testUrls.forEach(url => {
        const soundName = getSoundName(url);
        expect(soundName).not.toBe('Unknown Sound');
        expect(typeof soundName).toBe('string');
        expect(soundName.length).toBeGreaterThan(0);
      });
    });

    it('should maintain consistency between getSoundName and hasSoundName', () => {
      const testUrls = [
        'assets/sounds/mixkit-bell-notification-933.wav',
        'assets/sounds/unknown-sound.wav',
        'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg'
      ];

      testUrls.forEach(url => {
        const hasName = hasSoundName(url);
        const soundName = getSoundName(url);
        
        if (hasName) {
          expect(soundName).not.toBe('Unknown Sound');
        } else {
          expect(soundName).toBe('Unknown Sound');
        }
      });
    });
  });
});
