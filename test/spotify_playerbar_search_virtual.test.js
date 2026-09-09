const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Mock components and dependencies
const PlayerBar = require('../src/ui/components/PlayerBar');
const TopHeader = require('../src/ui/components/TopHeader');
const SearchView = require('../src/ui/components/SearchView');
const PlaylistDetailView = require('../src/ui/components/PlaylistDetailView');

const mockAudioEngine = {
  isPlaying: false,
  volume: 0.8,
  setVolume(v) { this.volume = v; },
  togglePlayPause() { this.isPlaying = !this.isPlaying; return this.isPlaying; },
  playTrack(t) { this.isPlaying = true; },
  seek(t) {},
  on(evt, cb) {},
  getActiveDeck() { return null; }
};

const mockQueueManager = {
  repeatMode: 'off',
  shuffle: false,
  queue: [],
  currentIndex: -1,
  getCurrentTrack() { return this.queue[this.currentIndex] || null; },
  toggleShuffle() { this.shuffle = !this.shuffle; return this.shuffle; },
  toggleRepeatMode() { return 'off'; },
  setQueue(tracks, idx = 0) { this.queue = tracks; this.currentIndex = idx; },
  addTrackPlayNext(t) {},
  addTrack(t) {},
  on(evt, cb) {}
};

const mockApp = {
  audioEngine: mockAudioEngine,
  queueManager: mockQueueManager,
  tracks: [],
  views: {},
  favoritesSet: new Set(['/music/fav.mp3']),
  isFavorite(fp) { return this.favoritesSet.has(fp); },
  syncFavorites(list) { this.favoritesSet = new Set(list); },
  toggleFavorite(fp) {
    if (this.favoritesSet.has(fp)) {
      this.favoritesSet.delete(fp);
      return false;
    }
    this.favoritesSet.add(fp);
    return true;
  },
  playTrackDirectly(track, list, idx) {
    mockQueueManager.setQueue(list, idx);
    mockAudioEngine.playTrack(track);
  },
  setQueueAndPlay(list, idx) {
    mockQueueManager.setQueue(list, idx);
    mockAudioEngine.playTrack(list[idx]);
  },
  showToast(msg) {}
};

describe('Instant Search & Enter Submit Tests', () => {
  test('TopHeader exposes 150ms debounce and onSubmitSearch callback', () => {
    let searchCalled = null;
    let submitCalled = null;

    const th = new TopHeader(mockApp, {
      onSearch: (t) => { searchCalled = t; },
      onSubmitSearch: (t) => { submitCalled = t; }
    });

    assert.strictEqual(th.debounceMs, 150);
    assert.strictEqual(typeof th.onSubmitSearch, 'function');

    th.onSubmitSearch('Queen');
    assert.strictEqual(submitCalled, 'Queen');
  });

  test('SearchView accesses in-memory app.tracks directly and supports playFirstResult()', async () => {
    const sv = new SearchView(mockApp);
    const container = {
      innerHTML: '',
      style: {},
      querySelector: () => null,
      querySelectorAll: () => []
    };
    sv.mount(container);

    const sampleTracks = [
      { filePath: '/music/queen.mp3', title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', duration: 354 },
      { filePath: '/music/bowie.mp3', title: 'Heroes', artist: 'David Bowie', album: 'Heroes', duration: 240 }
    ];

    mockApp.tracks = sampleTracks;
    await sv.setQuery('Bohemian');

    assert.strictEqual(sv.tracks.length, 2);
    assert.ok(container.innerHTML.includes('Bohemian Rhapsody'));
    assert.ok(container.innerHTML.includes('spotify-badge-btn'));

    // playFirstResult
    let playedTrack = null;
    mockApp.playTrackDirectly = (track) => { playedTrack = track; };
    sv.playFirstResult();
    assert.ok(playedTrack);
    assert.strictEqual(playedTrack.title, 'Bohemian Rhapsody');
  });
});

describe('Global Spacebar Play/Pause Protection Logic', () => {
  test('Spacebar is ignored when activeElement is input, textarea, or contenteditable', () => {
    const checkCanToggle = (activeElement) => {
      const isEditable = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable ||
        activeElement.getAttribute?.('contenteditable') === 'true'
      );
      return !isEditable;
    };

    assert.strictEqual(checkCanToggle({ tagName: 'INPUT' }), false);
    assert.strictEqual(checkCanToggle({ tagName: 'TEXTAREA' }), false);
    assert.strictEqual(checkCanToggle({ tagName: 'DIV', isContentEditable: true }), false);
    assert.strictEqual(checkCanToggle({ tagName: 'DIV', getAttribute: (attr) => attr === 'contenteditable' ? 'true' : null }), false);
    assert.strictEqual(checkCanToggle({ tagName: 'BUTTON' }), true);
    assert.strictEqual(checkCanToggle({ tagName: 'DIV' }), true);
    assert.strictEqual(checkCanToggle(null), true);
  });
});

describe('Zero Blue Colors (Total Spotify Green) Verification', () => {
  test('styles.css contains strictly zero legacy blue tokens in light theme and quick cards', () => {
    const cssContent = fs.readFileSync(path.join(__dirname, '../src/ui/styles.css'), 'utf-8');

    // Check light theme variables
    assert.strictEqual(cssContent.includes('--accent: #1d4ed8;'), false);
    assert.strictEqual(cssContent.includes('--accent-hover: #1e40af;'), false);
    assert.strictEqual(cssContent.includes('rgba(29, 78, 216'), false);

    // Check quick-card-cover-all-tracks
    assert.strictEqual(cssContent.includes('#1e3a8a'), false);
    assert.strictEqual(cssContent.includes('#3b82f6'), false);

    // Verify presence of Spotify green (#1ed760 / #1db954)
    assert.ok(cssContent.includes('--accent: #1ed760;'));
    assert.ok(cssContent.includes('--accent-hover: #1db954;'));
    assert.ok(cssContent.includes('background: linear-gradient(135deg, #0f5132 0%, #1ed760 100%);'));
  });
});

describe('PlayerBar Spotify 32x32 Play Button, Draggable 120px Volume Slider & Checkmark Badge', () => {
  test('PlayerBar DOM template includes 120px volume slider and Spotify checkmark badge', () => {
    const pBar = new PlayerBar(mockAudioEngine, mockQueueManager);
    const container = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };
    pBar.mount(container);

    // Check 120px volume slider wrapper
    assert.ok(container.innerHTML.includes('volume-slider-wrapper'));
    assert.ok(container.innerHTML.includes('volume-slider-bar'));
    assert.ok(container.innerHTML.includes('volume-slider-fill'));
    assert.ok(container.innerHTML.includes('volume-slider-thumb'));

    // Check Play button
    assert.ok(container.innerHTML.includes('id="btn-play-pause"'));
    assert.ok(container.innerHTML.includes('class="play-btn"'));

    // Check Spotify checkmark badge (replaces heart)
    assert.ok(container.innerHTML.includes('spotify-badge-btn'));
    assert.ok(container.innerHTML.includes('id="player-btn-fav"'));

    // Verify styles.css rules for play button and volume slider
    const cssContent = fs.readFileSync(path.join(__dirname, '../src/ui/styles.css'), 'utf-8');
    assert.ok(cssContent.includes('.play-btn {'));
    assert.ok(cssContent.includes('background-color: #ffffff;'));
    assert.ok(cssContent.includes('width: 32px;'));
    assert.ok(cssContent.includes('height: 32px;'));
    assert.ok(cssContent.includes('.volume-slider-wrapper {'));
    assert.ok(cssContent.includes('width: 120px;'));
    assert.ok(cssContent.includes('.volume-slider-thumb {'));
    assert.ok(cssContent.includes('width: 12px;'));
    assert.ok(cssContent.includes('height: 12px;'));
  });

  test('PlayerBar._updateVolumeUi clamps volume between 0 and 1 and updates DOM', () => {
    const pBar = new PlayerBar(mockAudioEngine, mockQueueManager);
    const mockFill = { style: { width: '' } };
    const mockThumb = { style: { left: '' } };
    const mockNative = { value: 0 };
    pBar.dom = {
      volumeSliderFill: mockFill,
      volumeSliderThumb: mockThumb,
      volumeSlider: mockNative
    };

    pBar._updateVolumeUi(0.75);
    assert.strictEqual(mockFill.style.width, '75.0%');
    assert.strictEqual(mockThumb.style.left, '75.0%');
    assert.strictEqual(mockNative.value, 0.75);

    pBar._updateVolumeUi(1.5); // clamped to 1
    assert.strictEqual(mockFill.style.width, '100.0%');

    pBar._updateVolumeUi(-0.5); // clamped to 0
    assert.strictEqual(mockFill.style.width, '0.0%');
  });

  test('PlayerBar.syncFavoriteState renders green checkmark circle when active and outline circle when inactive', () => {
    const pBar = new PlayerBar(mockAudioEngine, mockQueueManager);
    const mockBtn = {
      classList: {
        add: (c) => {},
        remove: (c) => {}
      },
      title: '',
      innerHTML: ''
    };
    pBar.dom = { btnFav: mockBtn };

    pBar.syncFavoriteState(true);
    assert.strictEqual(mockBtn.title, 'Salvo em Músicas Curtidas');
    assert.ok(mockBtn.innerHTML.includes('fill="#1ed760"'));
    assert.ok(mockBtn.innerHTML.includes('circle cx="8" cy="8" r="8"'));
    assert.strictEqual(mockBtn.innerHTML.includes('M12 21.35'), false); // No heart

    pBar.syncFavoriteState(false);
    assert.strictEqual(mockBtn.title, 'Salvar em Músicas Curtidas');
    assert.ok(mockBtn.innerHTML.includes('stroke="#a7a7a7"'));
    assert.strictEqual(mockBtn.innerHTML.includes('M12 21.35'), false); // No heart
  });
});

describe('PlaylistDetailView Virtual Windowing & Spotify Checkmark Badge', () => {
  test('PlaylistDetailView renders virtual phantom with computed total height and slice', () => {
    const view = new PlaylistDetailView(mockApp);
    const container = {
      innerHTML: '',
      style: {},
      querySelector: () => null,
      querySelectorAll: () => []
    };
    view.mount(container);

    const manyTracks = Array.from({ length: 100 }, (_, i) => ({
      filePath: `/music/track_${i}.mp3`,
      title: `Track ${i + 1}`,
      artist: 'Artist',
      album: 'Album',
      duration: 200,
      added_at: Date.now()
    }));

    view.playlist = { id: 'pl-1', name: 'Big Playlist', type: 'playlist' };
    view.tracks = manyTracks;
    view.sortedTracks = manyTracks;
    view.render();

    // Verify virtual phantom height = 100 * 56 = 5600px
    assert.ok(container.innerHTML.includes('spotify-table-phantom'));
    assert.ok(container.innerHTML.includes('height: 5600px'));
    assert.ok(container.innerHTML.includes('spotify-table-window'));
    assert.ok(container.innerHTML.includes('spotify-track-row'));

    // Check that row has checkmark badge and NO heart SVG
    assert.ok(container.innerHTML.includes('spotify-badge-btn'));
    assert.strictEqual(container.innerHTML.includes('M12 21.35l-1.45-1.32'), false);
  });

  test('PlaylistDetailView._onScrollVirtual computes correct slice index on scroll', () => {
    const view = new PlaylistDetailView(mockApp);
    view.sortedTracks = Array.from({ length: 100 }, (_, i) => ({
      filePath: `/music/track_${i}.mp3`,
      title: `Track ${i + 1}`,
      duration: 180
    }));

    const mockWindow = {
      style: { transform: '' },
      innerHTML: ''
    };
    const mockScrollContainer = {
      scrollTop: 1120, // 1120 / 56 = row 20
      clientHeight: 560 // 560 / 56 = 10 rows
    };
    const mockTableBody = {
      offsetTop: 0
    };

    view.container = {
      querySelector: (sel) => {
        if (sel === '.playlist-detail-scrollable') return mockScrollContainer;
        if (sel === '#playlist-table-rows') return mockTableBody;
        if (sel === '#spotify-table-window') return mockWindow;
        return null;
      },
      querySelectorAll: () => []
    };

    view._onScrollVirtual();

    // row 20 - 8 (overscan) = 12
    assert.strictEqual(view.virtualStartIndex, 12);
    // translateY = 12 * 56 = 672px
    assert.strictEqual(mockWindow.style.transform, 'translateY(672px)');
    assert.ok(mockWindow.innerHTML.includes('spotify-track-row'));
  });
});
