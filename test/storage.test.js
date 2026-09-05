const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const StorageManager = require('../src/db/storage');

describe('StorageManager Tests', () => {
  const testDbPath = path.join(__dirname, 'temp_test_db.json');
  let storage;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    storage = new StorageManager(testDbPath);
  });

  afterEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  test('upsertTrack and incrementPlayCount', () => {
    const track = {
      filePath: '/music/song1.mp3',
      title: 'Song 1',
      artist: 'Artist A',
      album: 'Album 1',
      duration: 180
    };

    storage.upsertTrack(track);
    let stored = storage.getTrack('/music/song1.mp3');
    assert.strictEqual(stored.title, 'Song 1');
    assert.strictEqual(stored.play_count, 0);

    // Increment play count
    storage.incrementPlayCount('/music/song1.mp3');
    stored = storage.getTrack('/music/song1.mp3');
    assert.strictEqual(stored.play_count, 1);
    assert.ok(stored.last_played_at > 0);

    storage.incrementPlayCount('/music/song1.mp3');
    stored = storage.getTrack('/music/song1.mp3');
    assert.strictEqual(stored.play_count, 2);
  });

  test('getTopTracks orders strictly by play_count DESC', () => {
    storage.upsertTrack({ filePath: '/m/1.mp3', title: 'Track 1' });
    storage.upsertTrack({ filePath: '/m/2.mp3', title: 'Track 2' });
    storage.upsertTrack({ filePath: '/m/3.mp3', title: 'Track 3' });

    storage.incrementPlayCount('/m/1.mp3');
    storage.incrementPlayCount('/m/2.mp3');
    storage.incrementPlayCount('/m/2.mp3');
    storage.incrementPlayCount('/m/2.mp3');
    storage.incrementPlayCount('/m/3.mp3');
    storage.incrementPlayCount('/m/3.mp3');

    const top = storage.getTopTracks(10);
    assert.strictEqual(top.length, 3);
    assert.strictEqual(top[0].filePath, '/m/2.mp3'); // 3 plays
    assert.strictEqual(top[0].play_count, 3);
    assert.strictEqual(top[1].filePath, '/m/3.mp3'); // 2 plays
    assert.strictEqual(top[1].play_count, 2);
    assert.strictEqual(top[2].filePath, '/m/1.mp3'); // 1 play
    assert.strictEqual(top[2].play_count, 1);
  });

  test('Playlist CRUD and custom ordering', () => {
    const pl1 = storage.createPlaylist('Rock Classics');
    const pl2 = storage.createPlaylist('Ambient Lounge');

    assert.strictEqual(storage.getPlaylists().length, 2);

    // Rename
    storage.renamePlaylist(pl1.id, 'Classic Rock');
    const updated = storage.getPlaylists().find(p => p.id === pl1.id);
    assert.strictEqual(updated.name, 'Classic Rock');

    // Add track
    storage.upsertTrack({ filePath: '/music/rock1.mp3', title: 'Rock 1' });
    storage.addTrackToPlaylist(pl1.id, '/music/rock1.mp3');
    assert.strictEqual(storage.getPlaylistTracks(pl1.id).length, 1);

    // Remove track
    storage.removeTrackFromPlaylist(pl1.id, 0);
    assert.strictEqual(storage.getPlaylistTracks(pl1.id).length, 0);

    // Delete playlist
    storage.deletePlaylist(pl2.id);
    assert.strictEqual(storage.getPlaylists().length, 1);
  });

  test('Settings persistence', () => {
    storage.updateSettings({ crossfadeSeconds: 5, repeatMode: 'repeat-one' });
    const settings = storage.getSettings();
    assert.strictEqual(settings.crossfadeSeconds, 5);
    assert.strictEqual(settings.repeatMode, 'repeat-one');

    // Verify reloaded from disk
    const reloaded = new StorageManager(testDbPath);
    assert.strictEqual(reloaded.getSettings().crossfadeSeconds, 5);
  });
});
