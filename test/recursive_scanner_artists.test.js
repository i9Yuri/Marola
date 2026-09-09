const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const LibraryScanner = require('../src/services/libraryScanner');
const StorageManager = require('../src/db/storage');
const { parseAudioMetadata } = require('../src/metadata/tags');
const HomeRecentView = require('../src/ui/components/HomeRecentView');

describe('Deep Recursive Scanner & Featured Artists Tests', () => {

  test('LibraryScanner supports .aac, .opus, .m4a, .flac, .mp3, .ogg, .wav in AUDIO_EXTENSIONS', () => {
    const required = ['.opus', '.ogg', '.m4a', '.mp3', '.flac', '.wav', '.aac'];
    for (const ext of required) {
      assert.ok(LibraryScanner.AUDIO_EXTENSIONS.has(ext), `Expected ${ext} in AUDIO_EXTENSIONS`);
    }
  });

  test('LibraryScanner.scanDirectory traverses nested subdirectories recursively', async () => {
    // Create an in-memory or mock fs structure representing the user's folder
    const mockFiles = {
      '/home/user/songs/Charlie Puth - Light Switch.opus': true,
      '/home/user/songs/Maroon 5 - Cold.opus': true,
      '/home/user/songs/FLAC SONGS/track1.flac': true,
      '/home/user/songs/FLAC SONGS/track2.flac': true,
      '/home/user/songs/Gramado à noite vibes/ambient.m4a': true,
      '/home/user/songs/Gramado à noite vibes/guitar.aac': true,
      '/home/user/songs/NA/ignored.txt': true // Non-audio file
    };

    const mockFs = {
      existsSync: (p) => true,
      promises: {
        stat: async (p) => {
          const isDir = !p.includes('.');
          return {
            isDirectory: () => isDir,
            isFile: () => !isDir
          };
        },
        readdir: async (p, opts) => {
          if (p === '/home/user/songs') {
            return [
              { name: 'Charlie Puth - Light Switch.opus', isDirectory: () => false, isFile: () => true },
              { name: 'Maroon 5 - Cold.opus', isDirectory: () => false, isFile: () => true },
              { name: 'FLAC SONGS', isDirectory: () => true, isFile: () => false },
              { name: 'Gramado à noite vibes', isDirectory: () => true, isFile: () => false },
              { name: 'NA', isDirectory: () => true, isFile: () => false },
              { name: '.hidden_folder', isDirectory: () => true, isFile: () => false }
            ];
          }
          if (p === '/home/user/songs/FLAC SONGS') {
            return [
              { name: 'track1.flac', isDirectory: () => false, isFile: () => true },
              { name: 'track2.flac', isDirectory: () => false, isFile: () => true }
            ];
          }
          if (p === '/home/user/songs/Gramado à noite vibes') {
            return [
              { name: 'ambient.m4a', isDirectory: () => false, isFile: () => true },
              { name: 'guitar.aac', isDirectory: () => false, isFile: () => true }
            ];
          }
          if (p === '/home/user/songs/NA') {
            return [
              { name: 'ignored.txt', isDirectory: () => false, isFile: () => true }
            ];
          }
          return [];
        }
      }
    };

    const scanned = await LibraryScanner.scanDirectory('/home/user/songs', mockFs);

    assert.strictEqual(scanned.length, 6);
    assert.ok(scanned.includes('/home/user/songs/Charlie Puth - Light Switch.opus'));
    assert.ok(scanned.includes('/home/user/songs/Maroon 5 - Cold.opus'));
    assert.ok(scanned.includes('/home/user/songs/FLAC SONGS/track1.flac'));
    assert.ok(scanned.includes('/home/user/songs/FLAC SONGS/track2.flac'));
    assert.ok(scanned.includes('/home/user/songs/Gramado à noite vibes/ambient.m4a'));
    assert.ok(scanned.includes('/home/user/songs/Gramado à noite vibes/guitar.aac'));
    assert.ok(!scanned.some(f => f.endsWith('ignored.txt')));
  });

  test('Metadata parser infers artist and title from filename when tags are unknown', async () => {
    const res1 = await parseAudioMetadata('/nonexistent/path/Charlie Puth - Light Switch.opus');
    assert.strictEqual(res1.artist, 'Charlie Puth');
    assert.strictEqual(res1.title, 'Light Switch');

    const res2 = await parseAudioMetadata('/nonexistent/path/Eminem - Till I Collapse.opus');
    assert.strictEqual(res2.artist, 'Eminem');
    assert.strictEqual(res2.title, 'Till I Collapse');

    const res3 = await parseAudioMetadata('/nonexistent/path/Kygo, Selena Gomez - It Ain\'t Me.opus');
    assert.strictEqual(res3.artist, 'Kygo, Selena Gomez');
    assert.strictEqual(res3.title, 'It Ain\'t Me');

    // Filename without separator falls back to baseName
    const res4 = await parseAudioMetadata('/nonexistent/path/Obsession.opus');
    assert.strictEqual(res4.artist, 'Artista Desconhecido');
    assert.strictEqual(res4.title, 'Obsession');
  });

  test('StorageManager.getTopArtistsByTrackCount aggregates and ranks artists descending', () => {
    const testDbPath = path.join(__dirname, 'test_top_artists_db.json');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    const storage = new StorageManager(testDbPath);
    storage.upsertTracksBatch([
      { filePath: '/m/1.opus', artist: 'Queen', title: 'Song 1', duration: 180, coverDataUrl: 'data:img/queen' },
      { filePath: '/m/2.opus', artist: 'Queen', title: 'Song 2', duration: 200 },
      { filePath: '/m/3.opus', artist: 'Queen', title: 'Song 3', duration: 210 },
      { filePath: '/m/4.opus', artist: 'David Bowie', title: 'Song 4', duration: 190, coverDataUrl: 'data:img/bowie' },
      { filePath: '/m/5.opus', artist: 'David Bowie', title: 'Song 5', duration: 220 },
      { filePath: '/m/6.opus', artist: 'Maroon 5', title: 'Song 6', duration: 150 },
      { filePath: '/m/7.opus', artist: 'Artista Desconhecido', title: 'Song 7', duration: 120 }
    ]);

    const topArtists = storage.getTopArtistsByTrackCount(10);

    assert.strictEqual(topArtists.length, 3);
    assert.strictEqual(topArtists[0].name, 'Queen');
    assert.strictEqual(topArtists[0].trackCount, 3);
    assert.strictEqual(topArtists[0].coverDataUrl, 'data:img/queen');

    assert.strictEqual(topArtists[1].name, 'David Bowie');
    assert.strictEqual(topArtists[1].trackCount, 2);
    assert.strictEqual(topArtists[1].coverDataUrl, 'data:img/bowie');

    assert.strictEqual(topArtists[2].name, 'Maroon 5');
    assert.strictEqual(topArtists[2].trackCount, 1);

    // Clean up
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  test('HomeRecentView renders Artistas em Destaque section and circular cards with dynamic track count', () => {
    const mockApp = {
      currentView: 'recent',
      favoritesSet: new Set(),
      playTrackDirectly: () => {},
      setQueueAndPlay: () => {},
      showToast: () => {}
    };

    const view = new HomeRecentView(mockApp);
    const container = {
      innerHTML: '',
      style: {},
      querySelector: (sel) => {
        if (sel === '#section-artists') return { style: {} };
        if (sel === '#artists-carousel') return { innerHTML: '', querySelectorAll: () => [] };
        return null;
      },
      querySelectorAll: () => []
    };

    view.mount(container);

    assert.ok(container.innerHTML.includes('Artistas em Destaque'));
    assert.ok(container.innerHTML.includes('id="section-artists"'));
    assert.ok(container.innerHTML.includes('id="artists-carousel"'));

    view.tracks = [
      { filePath: '/a.opus', artist: 'Charlie Puth', title: 'Song 1', duration: 180 },
      { filePath: '/b.opus', artist: 'Charlie Puth', title: 'Song 2', duration: 190 },
      { filePath: '/c.opus', artist: 'Eminem', title: 'Song 3', duration: 200 }
    ];

    let carouselHtml = '';
    const mockRow = {
      set innerHTML(val) { carouselHtml = val; },
      get innerHTML() { return carouselHtml; },
      querySelectorAll: () => []
    };

    view.container.querySelector = (sel) => {
      if (sel === '#artists-carousel') return mockRow;
      if (sel === '#section-artists') return { style: {} };
      return null;
    };

    view._renderArtistsCarousel();

    assert.ok(carouselHtml.includes('Charlie Puth'));
    assert.ok(carouselHtml.includes('2 músicas'));
    assert.ok(carouselHtml.includes('Eminem'));
    assert.ok(carouselHtml.includes('1 música'));
    assert.ok(carouselHtml.includes('artist-item'));
  });
});
