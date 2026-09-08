const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ConfigStorage = require('../src/services/configStorage');
const StorageManager = require('../src/db/storage');
const LibraryScanner = require('../src/services/libraryScanner');
const SettingsModal = require('../src/ui/components/SettingsModal');

describe('Music Folders Granular Manager Tests', () => {
  const testDb = path.join(__dirname, 'temp_music_folders_test.json');
  let storage;

  beforeEach(() => {
    if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
    storage = new StorageManager(testDb);
  });

  afterEach(() => {
    if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
  });

  test('ConfigStorage.sanitize migrates legacy libraryFolders and libraryPath to musicFolders', () => {
    // Legacy array of strings
    const legacyArray = {
      libraryFolders: ['/home/user/Music', '/home/user/Downloads/Audio']
    };
    const sanitizedArray = ConfigStorage.sanitize(legacyArray);
    assert.strictEqual(sanitizedArray.musicFolders.length, 2);
    assert.strictEqual(sanitizedArray.musicFolders[0].path, '/home/user/Music');
    assert.strictEqual(sanitizedArray.musicFolders[0].enabled, true);
    assert.ok(sanitizedArray.musicFolders[0].id);
    assert.strictEqual(sanitizedArray.musicFolders[1].path, '/home/user/Downloads/Audio');
    assert.deepStrictEqual(sanitizedArray.libraryFolders, ['/home/user/Music', '/home/user/Downloads/Audio']);

    // Legacy single string
    const legacySingle = {
      libraryPath: '/home/user/SingleFolder'
    };
    const sanitizedSingle = ConfigStorage.sanitize(legacySingle);
    assert.strictEqual(sanitizedSingle.musicFolders.length, 1);
    assert.strictEqual(sanitizedSingle.musicFolders[0].path, '/home/user/SingleFolder');
    assert.strictEqual(sanitizedSingle.musicFolders[0].enabled, true);

    // Deduplication of trailing slashes and duplicates
    const duplicates = {
      musicFolders: [
        { path: '/home/user/Rock/', enabled: true },
        { path: '/home/user/Rock', enabled: false }
      ]
    };
    const sanitizedDupes = ConfigStorage.sanitize(duplicates);
    assert.strictEqual(sanitizedDupes.musicFolders.length, 1);
    assert.strictEqual(sanitizedDupes.musicFolders[0].path, '/home/user/Rock');
  });

  test('StorageManager.addMusicFolder normalizes path, prevents duplicates, and persists', () => {
    const entry1 = storage.addMusicFolder('/home/user/Musicas/Rock');
    assert.ok(entry1);
    assert.ok(entry1.id.startsWith('fld_'));
    assert.strictEqual(entry1.enabled, true);
    assert.strictEqual(entry1.trackCount, 0);

    const folders = storage.getMusicFolders();
    assert.strictEqual(folders.length, 1);
    assert.strictEqual(folders[0].path, '/home/user/Musicas/Rock');

    // Adding same folder again should not duplicate
    const entry2 = storage.addMusicFolder('/home/user/Musicas/Rock/');
    assert.strictEqual(entry2.id, entry1.id);
    assert.strictEqual(storage.getMusicFolders().length, 1);

    // Reload from disk
    const reloaded = new StorageManager(testDb);
    assert.strictEqual(reloaded.getMusicFolders().length, 1);
    assert.strictEqual(reloaded.getMusicFolders()[0].id, entry1.id);
  });

  test('StorageManager.toggleMusicFolder disables and re-enables library visibility', () => {
    const fld = storage.addMusicFolder('/home/user/Music');
    assert.strictEqual(fld.enabled, true);

    // Add mock tracks inside and outside the folder
    storage.upsertTrack({ filePath: '/home/user/Music/song1.mp3', title: 'Song 1' });
    storage.upsertTrack({ filePath: '/home/user/Music/song2.mp3', title: 'Song 2' });

    let tracks = storage.getAllTracks();
    assert.strictEqual(tracks.length, 2);

    // Toggle folder off
    storage.toggleMusicFolder(fld.id, false);
    const updated = storage.getMusicFolders().find(f => f.id === fld.id);
    assert.strictEqual(updated.enabled, false);

    // Tracks in disabled folder should be excluded from active query results
    tracks = storage.getAllTracks();
    assert.strictEqual(tracks.length, 0);

    // Re-enable folder
    storage.toggleMusicFolder(fld.id, true);
    tracks = storage.getAllTracks();
    assert.strictEqual(tracks.length, 2);
  });

  test('StorageManager.removeMusicFolder purges records from DB and playlists without deleting files', () => {
    const fld1 = storage.addMusicFolder('/home/user/Album1');
    const fld2 = storage.addMusicFolder('/home/user/Album2');

    const track1 = storage.upsertTrack({ filePath: '/home/user/Album1/t1.mp3', title: 'T1' });
    const track2 = storage.upsertTrack({ filePath: '/home/user/Album2/t2.mp3', title: 'T2' });

    // Create a playlist containing both tracks
    const pl = storage.createPlaylist('Mix Playlist');
    storage.addTrackToPlaylist(pl.id, track1.filePath);
    storage.addTrackToPlaylist(pl.id, track2.filePath);

    let plTracks = storage.getPlaylistTracks(pl.id);
    assert.strictEqual(plTracks.length, 2);

    // Remove Album1
    storage.removeMusicFolder(fld1.id);

    // Folder list should now only contain Album2
    const remainingFolders = storage.getMusicFolders();
    assert.strictEqual(remainingFolders.length, 1);
    assert.strictEqual(remainingFolders[0].id, fld2.id);

    // Track 1 should be completely purged from database
    assert.strictEqual(storage.getTrack(track1.filePath), null);
    assert.ok(storage.getTrack(track2.filePath));

    // Playlist should automatically have track 1 cleaned out
    plTracks = storage.getPlaylistTracks(pl.id);
    assert.strictEqual(plTracks.length, 1);
    assert.strictEqual(plTracks[0].filePath, track2.filePath);
  });

  test('LibraryScanner helper methods', () => {
    // isPathInFolder
    assert.strictEqual(LibraryScanner.isPathInFolder('/home/user/Music/rock/song.mp3', '/home/user/Music'), true);
    assert.strictEqual(LibraryScanner.isPathInFolder('/home/user/Music2/song.mp3', '/home/user/Music'), false);
    assert.strictEqual(LibraryScanner.isPathInFolder('/home/user/Music/song.mp3', '/home/user/Music/'), true);

    // countTracksInFolder
    const sampleTracks = [
      { filePath: '/music/a/1.mp3' },
      { filePath: '/music/a/2.flac' },
      { filePath: '/music/b/3.ogg' }
    ];
    assert.strictEqual(LibraryScanner.countTracksInFolder('/music/a', sampleTracks), 2);
    assert.strictEqual(LibraryScanner.countTracksInFolder('/music/b', sampleTracks), 1);
    assert.strictEqual(LibraryScanner.countTracksInFolder('/other', sampleTracks), 0);

    // filterTracksByActiveFolders
    const folders = [
      { path: '/music/a', enabled: true },
      { path: '/music/b', enabled: false }
    ];
    const filtered = LibraryScanner.filterTracksByActiveFolders(sampleTracks, folders);
    assert.strictEqual(filtered.length, 2);
    assert.strictEqual(filtered[0].filePath, '/music/a/1.mp3');
    assert.strictEqual(filtered[1].filePath, '/music/a/2.flac');
  });

  test('SettingsModal renders folder cards and empty states', () => {
    const mockApp = {
      showToast: () => {},
      views: { recent: { loadTracks: async () => {} } }
    };
    const modal = new SettingsModal(mockApp);
    const dirListEl = {
      innerHTML: '',
      querySelectorAll: () => []
    };
    modal.dom = { dirList: dirListEl };

    // Empty state test
    modal.currentSettings = { musicFolders: [] };
    modal._renderDirectories();
    assert.ok(dirListEl.innerHTML.includes('settings-folders-empty'));
    assert.ok(dirListEl.innerHTML.includes('Nenhuma pasta de mídia monitorada'));

    // Populated state test
    modal.currentSettings = {
      musicFolders: [
        { id: 'fld-1', path: '/home/user/Musicas/HeavyMetal', enabled: true, trackCount: 15 },
        { id: 'fld-2', path: '/home/user/Musicas/Podcasts', enabled: false, trackCount: 3 }
      ]
    };
    modal._renderDirectories();
    assert.ok(dirListEl.innerHTML.includes('settings-folder-card'));
    assert.ok(dirListEl.innerHTML.includes('HeavyMetal'));
    assert.ok(dirListEl.innerHTML.includes('15 faixas'));
    assert.ok(dirListEl.innerHTML.includes('folder-toggle-input'));
    assert.ok(dirListEl.innerHTML.includes('btn-remove-folder'));
    assert.ok(dirListEl.innerHTML.includes('disabled')); // fld-2 is disabled
  });
});
