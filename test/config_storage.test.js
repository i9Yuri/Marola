const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ConfigStorage = require('../src/services/configStorage');
const StorageManager = require('../src/db/storage');

describe('ConfigStorage & Preferences Tests', () => {
  const testDb = path.join(__dirname, 'temp_config_test.json');
  let storage;

  beforeEach(() => {
    if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
    storage = new StorageManager(testDb);
  });

  afterEach(() => {
    if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
  });

  test('ConfigStorage.sanitize clamps and validates inputs', () => {
    const raw = {
      theme: 'invalid-theme',
      crossfadeSeconds: 25,
      backgroundDim: 1.5,
      libraryFolders: ['/music', '/music', '']
    };
    const sanitized = ConfigStorage.sanitize(raw);
    assert.strictEqual(sanitized.theme, 'dark'); // keeps default
    assert.strictEqual(sanitized.crossfadeSeconds, 12); // clamped
    assert.strictEqual(sanitized.backgroundDim, 0.95); // clamped
    assert.deepStrictEqual(sanitized.libraryFolders, ['/music']); // deduplicated and cleaned
  });

  test('Theme and background persistence in StorageManager', () => {
    storage.updateSettings({
      theme: 'light',
      backgroundImage: '/home/user/bg.jpg',
      backgroundDim: 0.6
    });

    let s = storage.getSettings();
    assert.strictEqual(s.theme, 'light');
    assert.strictEqual(s.backgroundImage, '/home/user/bg.jpg');
    assert.strictEqual(s.backgroundDim, 0.6);

    // Reload from disk
    const reloaded = new StorageManager(testDb);
    s = reloaded.getSettings();
    assert.strictEqual(s.theme, 'light');
    assert.strictEqual(s.backgroundImage, '/home/user/bg.jpg');
    assert.strictEqual(s.backgroundDim, 0.6);
  });

  test('Favorites toggle and check', () => {
    const song = '/music/favorite_song.mp3';
    assert.strictEqual(storage.isFavorite(song), false);

    const res1 = storage.toggleFavorite(song);
    assert.strictEqual(res1.isFavorite, true);
    assert.strictEqual(storage.isFavorite(song), true);
    assert.deepStrictEqual(storage.getFavorites(), [song]);

    const res2 = storage.toggleFavorite(song);
    assert.strictEqual(res2.isFavorite, false);
    assert.strictEqual(storage.isFavorite(song), false);
    assert.deepStrictEqual(storage.getFavorites(), []);
  });

  test('Library folder addition and removal', () => {
    storage.addLibraryFolder('/music/rock');
    storage.addLibraryFolder('/music/jazz');
    storage.addLibraryFolder('/music/rock'); // duplicate

    let s = storage.getSettings();
    assert.deepStrictEqual(s.libraryFolders, ['/music/rock', '/music/jazz']);

    storage.removeLibraryFolder('/music/rock');
    s = storage.getSettings();
    assert.deepStrictEqual(s.libraryFolders, ['/music/jazz']);
  });

  test('Accent color validation and persistence', () => {
    // Valid hex
    const valid = ConfigStorage.sanitize({ accentColor: '#10b981' });
    assert.strictEqual(valid.accentColor, '#10b981');

    // Invalid hex falls back to default
    const invalid = ConfigStorage.sanitize({ accentColor: 'invalid-hex' });
    assert.strictEqual(invalid.accentColor, '#38bdf8');

    // Preset list contains expected sober colors
    assert(ConfigStorage.ACCENT_PRESETS.length >= 5);
    assert(ConfigStorage.ACCENT_PRESETS.some(p => p.hex === '#38bdf8'));
    assert(ConfigStorage.ACCENT_PRESETS.some(p => p.hex === '#10b981'));
    assert(ConfigStorage.ACCENT_PRESETS.some(p => p.hex === '#f59e0b'));

    // Persistence in storage
    storage.updateSettings({ accentColor: '#f59e0b' });
    let s = storage.getSettings();
    assert.strictEqual(s.accentColor, '#f59e0b');

    // Reload from disk
    const reloaded = new StorageManager(testDb);
    s = reloaded.getSettings();
    assert.strictEqual(s.accentColor, '#f59e0b');
  });
});
