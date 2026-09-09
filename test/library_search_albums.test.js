const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const StorageManager = require('../src/db/storage');
const AllTracksView = require('../src/ui/components/AllTracksView');
const SearchView = require('../src/ui/components/SearchView');
const PlaylistDetailView = require('../src/ui/components/PlaylistDetailView');

describe('Performance, AllTracksView, SearchView & Album Enhancements Tests', () => {

  describe('StorageManager: Album & Artist Aggregations', () => {
    test('getTopAlbumsByTrackCount ranks known albums by trackCount DESC and forces Álbum Desconhecido to the last position', () => {
      const storage = new StorageManager();
      storage.data.tracks = {};

      // Add tracks across albums:
      // Cuphead: 8 tracks
      for (let i = 0; i < 8; i++) {
        storage.data.tracks[`/cuphead_${i}.mp3`] = {
          filePath: `/cuphead_${i}.mp3`,
          title: `Track ${i}`,
          artist: 'Kristofer Maddigan',
          album: 'Cuphead'
        };
      }
      // Oppenheimer: 8 tracks
      for (let i = 0; i < 8; i++) {
        storage.data.tracks[`/opp_${i}.mp3`] = {
          filePath: `/opp_${i}.mp3`,
          title: `Track ${i}`,
          artist: 'Ludwig Göransson',
          album: 'Oppenheimer'
        };
      }
      // Top Gun: 7 tracks
      for (let i = 0; i < 7; i++) {
        storage.data.tracks[`/topgun_${i}.mp3`] = {
          filePath: `/topgun_${i}.mp3`,
          title: `Track ${i}`,
          artist: 'Harold Faltermeyer',
          album: 'Top Gun'
        };
      }
      // Álbum Desconhecido: 50 tracks (massive track count, but must strictly be LAST)
      for (let i = 0; i < 50; i++) {
        storage.data.tracks[`/unk_${i}.mp3`] = {
          filePath: `/unk_${i}.mp3`,
          title: `Unknown ${i}`,
          artist: 'Unknown Artist',
          album: 'Álbum Desconhecido'
        };
      }

      const topAlbums = storage.getTopAlbumsByTrackCount(10);
      assert.ok(topAlbums.length >= 4);

      // Verify Cuphead and Oppenheimer are at the top (8 tracks each)
      assert.strictEqual(topAlbums[0].trackCount, 8);
      assert.strictEqual(topAlbums[1].trackCount, 8);
      assert.strictEqual(topAlbums[2].name, 'Top Gun');
      assert.strictEqual(topAlbums[2].trackCount, 7);

      // STRICT EDGE RULE: Álbum Desconhecido must NOT be at index 0, but strictly the LAST entry!
      const lastAlbum = topAlbums[topAlbums.length - 1];
      assert.strictEqual(lastAlbum.name, 'Álbum Desconhecido');
      assert.strictEqual(lastAlbum.isUnknown, true);
      assert.strictEqual(lastAlbum.trackCount, 50);

      // Index 0 must NEVER be Álbum Desconhecido
      assert.notStrictEqual(topAlbums[0].name, 'Álbum Desconhecido');
    });

    test('getTopArtistsByTrackCount consolidates multiple-artist tags to primary artist (Michael Jackson: 18, Michael Bublé: 7)', () => {
      const storage = new StorageManager();
      storage.data.tracks = {};

      // 18 tracks for Michael Jackson with various feature formats, casing, and trailing whitespace
      for (let i = 0; i < 10; i++) {
        storage.data.tracks[`/mj_${i}.opus`] = {
          filePath: `/mj_${i}.opus`,
          title: `Song ${i}`,
          artist: 'Michael Jackson'
        };
      }
      for (let i = 0; i < 4; i++) {
        storage.data.tracks[`/mj_feat_${i}.opus`] = {
          filePath: `/mj_feat_${i}.opus`,
          title: `Duet ${i}`,
          artist: 'Michael Jackson feat. Siedah Garrett'
        };
      }
      for (let i = 0; i < 2; i++) {
        storage.data.tracks[`/mj_comma_${i}.opus`] = {
          filePath: `/mj_comma_${i}.opus`,
          title: `Collab ${i}`,
          artist: 'Michael Jackson, Justin Bieber'
        };
      }
      storage.data.tracks['/mj_ws.opus'] = {
        filePath: '/mj_ws.opus',
        title: 'Whitespace Track',
        artist: '  Michael   Jackson  '
      };
      storage.data.tracks['/mj_lower.opus'] = {
        filePath: '/mj_lower.opus',
        title: 'Lower Track',
        artist: 'michael jackson'
      };

      // 7 tracks for Michael Bublé
      for (let i = 0; i < 5; i++) {
        storage.data.tracks[`/mb_${i}.opus`] = {
          filePath: `/mb_${i}.opus`,
          title: `Buble Song ${i}`,
          artist: 'Michael Bublé'
        };
      }
      for (let i = 0; i < 2; i++) {
        storage.data.tracks[`/mb_feat_${i}.opus`] = {
          filePath: `/mb_feat_${i}.opus`,
          title: `Buble Duet ${i}`,
          artist: 'Michael Bublé ft. Blake Shelton'
        };
      }

      // Add other artists
      storage.data.tracks['/charlie.opus'] = {
        filePath: '/charlie.opus',
        title: 'Light Switch',
        artist: 'Charlie Puth'
      };

      const topArtists = storage.getTopArtistsByTrackCount(5);

      const mj = topArtists.find(a => a.name.toLowerCase() === 'michael jackson');
      assert.ok(mj, 'Michael Jackson should be in top artists');
      assert.strictEqual(mj.trackCount, 18, 'Michael Jackson should aggregate all 18 tracks');

      const mb = topArtists.find(a => a.name.toLowerCase() === 'michael bublé');
      assert.ok(mb, 'Michael Bublé should be in top artists');
      assert.strictEqual(mb.trackCount, 7, 'Michael Bublé should aggregate 7 tracks');

      assert.strictEqual(topArtists[0].name, 'Michael Jackson', 'Michael Jackson should be #1 top artist');
    });
  });

  describe('AllTracksView Component Logic', () => {
    const mockApp = {
      audioEngine: { isPlaying: false },
      queueManager: { getCurrentTrack: () => null },
      favoritesSet: new Set(),
      playTrackDirectly: () => {},
      setQueueAndPlay: () => {},
      showToast: () => {}
    };

    test('Sorting logic cycles through asc -> desc -> none', () => {
      const view = new AllTracksView(mockApp);
      view.tracks = [
        { title: 'Zebra', artist: 'Band C', duration: 100 },
        { title: 'Apple', artist: 'Band A', duration: 300 },
        { title: 'Mango', artist: 'Band B', duration: 200 }
      ];

      // Default: no sorting
      view._applyFilterAndSort();
      assert.strictEqual(view.displayTracks[0].title, 'Zebra');

      // Cycle 1: asc
      view._cycleSort('title');
      assert.strictEqual(view.sortDirection, 'asc');
      assert.strictEqual(view.displayTracks[0].title, 'Apple');
      assert.strictEqual(view.displayTracks[2].title, 'Zebra');

      // Cycle 2: desc
      view._cycleSort('title');
      assert.strictEqual(view.sortDirection, 'desc');
      assert.strictEqual(view.displayTracks[0].title, 'Zebra');
      assert.strictEqual(view.displayTracks[2].title, 'Apple');

      // Cycle 3: none
      view._cycleSort('title');
      assert.strictEqual(view.sortDirection, 'none');
      assert.strictEqual(view.displayTracks[0].title, 'Zebra');
    });

    test('Diacritic-insensitive filtering in AllTracksView', () => {
      const view = new AllTracksView(mockApp);
      view.tracks = [
        { title: 'Coração Selvagem', artist: 'Belchior', album: 'Alucinação' },
        { title: 'Smooth Criminal', artist: 'Michael Jackson', album: 'Bad' }
      ];

      // Search with "coracao" without accent
      view.searchTerm = 'coracao';
      view._applyFilterAndSort();
      assert.strictEqual(view.displayTracks.length, 1);
      assert.strictEqual(view.displayTracks[0].title, 'Coração Selvagem');

      // Search with "alucinacao" without accent
      view.searchTerm = 'alucinacao';
      view._applyFilterAndSort();
      assert.strictEqual(view.displayTracks.length, 1);
      assert.strictEqual(view.displayTracks[0].title, 'Coração Selvagem');
    });
  });

  describe('SearchView Component Logic', () => {
    const mockApp = {
      audioEngine: { isPlaying: false },
      queueManager: { getCurrentTrack: () => null },
      favoritesSet: new Set(),
      playTrackDirectly: () => {},
      setQueueAndPlay: () => {},
      showToast: () => {},
      openAlbum: () => {}
    };

    test('Renders empty state prompt when query is blank', () => {
      const view = new SearchView(mockApp);
      const mockContainer = { innerHTML: '', style: {} };
      view.mount(mockContainer);
      view.query = '';
      view.render();
      assert.ok(mockContainer.innerHTML.includes('O que você quer ouvir?'));
    });

    test('Categorizes exact artist match into Top Result, Tracks, and Artists', () => {
      const view = new SearchView(mockApp);
      const mockContainer = {
        innerHTML: '',
        style: {},
        querySelector: () => null,
        querySelectorAll: () => []
      };
      view.mount(mockContainer);

      view.tracks = [
        { filePath: '/t1.mp3', title: 'Billie Jean', artist: 'Michael Jackson', album: 'Thriller', duration: 294 },
        { filePath: '/t2.mp3', title: 'Beat It', artist: 'Michael Jackson', album: 'Thriller', duration: 258 },
        { filePath: '/t3.mp3', title: 'Light Switch', artist: 'Charlie Puth', album: 'CHARLIE', duration: 185 }
      ];

      view.setQuery('Michael Jackson', view.tracks);

      // Verify Top Result heading and content
      assert.ok(mockContainer.innerHTML.includes('Melhor resultado'));
      assert.ok(mockContainer.innerHTML.includes('Michael Jackson'));
      assert.ok(mockContainer.innerHTML.includes('Músicas'));
      assert.ok(mockContainer.innerHTML.includes('Billie Jean'));
      assert.ok(mockContainer.innerHTML.includes('Beat It'));
    });
  });

  describe('PlaylistDetailView Album Mode & Liked Songs Gradient', () => {
    const mockApp = {
      audioEngine: { isPlaying: false },
      queueManager: { getCurrentTrack: () => null, shuffle: false },
      favoritesSet: new Set(['/m/fav1.mp3']),
      playTrackDirectly: () => {},
      setQueueAndPlay: () => {},
      showToast: () => {}
    };

    test('Renders album details with "Álbum" badge, artist, and tracks', async () => {
      const view = new PlaylistDetailView(mockApp);
      const mockContainer = {
        innerHTML: '',
        style: {},
        querySelector: () => null,
        querySelectorAll: () => []
      };
      view.mount(mockContainer);

      const albumPayload = {
        id: 'album-oppenheimer',
        type: 'album',
        name: 'Oppenheimer',
        artist: 'Ludwig Göransson',
        year: 2023,
        tracks: [
          { filePath: '/m/can_you_hear.mp3', title: 'Can You Hear the Music', artist: 'Ludwig Göransson', album: 'Oppenheimer', duration: 110 },
          { filePath: '/m/destroyer.mp3', title: 'Destroyer of Worlds', artist: 'Ludwig Göransson', album: 'Oppenheimer', duration: 174 }
        ]
      };

      await view.loadPlaylist(albumPayload);

      assert.strictEqual(view.playlist.type, 'album');
      assert.ok(mockContainer.innerHTML.includes('Álbum'));
      assert.ok(mockContainer.innerHTML.includes('Oppenheimer'));
      assert.ok(mockContainer.innerHTML.includes('Ludwig Göransson'));
      assert.ok(mockContainer.innerHTML.includes('2023'));
      assert.ok(mockContainer.innerHTML.includes('2 músicas'));
    });

    test('Liked Songs uses hero-liked-songs class for rich indigo/violet styling', async () => {
      const view = new PlaylistDetailView(mockApp);
      const mockContainer = {
        innerHTML: '',
        style: {},
        querySelector: () => null,
        querySelectorAll: () => []
      };
      view.mount(mockContainer);

      await view.loadPlaylist({ id: 'liked', type: 'liked', name: 'Músicas Curtidas' });

      assert.ok(mockContainer.innerHTML.includes('hero-liked-songs'));
      assert.ok(mockContainer.innerHTML.includes('hero-cover-liked-gradient'));
    });
  });
});
