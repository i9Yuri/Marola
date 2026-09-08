const { test, describe } = require('node:test');
const assert = require('node:assert');

const TrackList = require('../src/ui/components/TrackList');
const HomeRecentView = require('../src/ui/components/HomeRecentView');
const PlaylistsRankView = require('../src/ui/components/PlaylistsRankView');
const QueueView = require('../src/ui/components/QueueView');
const LyricsView = require('../src/ui/components/LyricsView');
const NowPlayingView = require('../src/ui/components/NowPlayingView');
const SettingsModal = require('../src/ui/components/SettingsModal');
const PlayerBar = require('../src/ui/components/PlayerBar');
const QueueManager = require('../src/audio/queue-manager');

describe('UI Components Lifecycle & Instantiation', () => {
  const queueManager = new QueueManager();
  const mockAudioEngine = {
    on: () => {},
    emit: () => {},
    getActiveDeck: () => null,
    setCrossfade: () => {},
    setVolume: () => {},
    volume: 0.8
  };

  const mockApp = {
    audioEngine: mockAudioEngine,
    queueManager,
    currentView: 'recent',
    views: {},
    favoritesSet: new Set(),
    isFavorite: (fp) => mockApp.favoritesSet.has(fp),
    syncFavorites: (f) => { mockApp.favoritesSet = new Set(f || []); },
    showToast: () => {},
    applyTheme: () => {},
    applyBackground: () => {},
    playTrackDirectly: () => {},
    setQueueAndPlay: () => {}
  };

  test('All UI component classes are defined and instantiable', () => {
    assert.ok(typeof TrackList === 'function');
    assert.ok(typeof HomeRecentView === 'function');
    assert.ok(typeof PlaylistsRankView === 'function');
    assert.ok(typeof QueueView === 'function');
    assert.ok(typeof LyricsView === 'function');
    assert.ok(typeof NowPlayingView === 'function');
    assert.ok(typeof SettingsModal === 'function');
    assert.ok(typeof PlayerBar === 'function');

    const homeView = new HomeRecentView(mockApp);
    assert.ok(homeView);
    assert.ok(homeView.trackList instanceof TrackList);

    const plView = new PlaylistsRankView(mockApp);
    assert.ok(plView);
    assert.strictEqual(plView.sortBy, 'created');

    const qView = new QueueView(mockApp);
    assert.ok(qView);

    const lyrView = new LyricsView(mockApp);
    assert.ok(lyrView);

    const npView = new NowPlayingView(mockApp);
    assert.ok(npView);

    const setModal = new SettingsModal(mockApp);
    assert.ok(setModal);

    const pBar = new PlayerBar(mockAudioEngine, queueManager);
    assert.ok(pBar);
  });

  test('HomeRecentView filters tracks accurately without mutating originals', () => {
    const homeView = new HomeRecentView(mockApp);
    homeView.tracks = [
      { filePath: '/a.mp3', title: 'Bohemian Rhapsody', artist: 'Queen', album: 'Opera' },
      { filePath: '/b.mp3', title: 'Starman', artist: 'David Bowie', album: 'Ziggy' },
      { filePath: '/c.mp3', title: 'Radioactive', artist: 'Imagine Dragons', album: 'Night' }
    ];

    homeView.searchTerm = 'queen';
    homeView.filterAndRender();
    assert.strictEqual(homeView.filteredTracks.length, 1);
    assert.strictEqual(homeView.filteredTracks[0].title, 'Bohemian Rhapsody');

    homeView.searchTerm = 'night';
    homeView.filterAndRender();
    assert.strictEqual(homeView.filteredTracks.length, 1);
    assert.strictEqual(homeView.filteredTracks[0].artist, 'Imagine Dragons');

    homeView.searchTerm = '';
    homeView.filterAndRender();
    assert.strictEqual(homeView.filteredTracks.length, 3);
  });

  test('SettingsModal syncState and background UI logic', () => {
    const modal = new SettingsModal(mockApp);
    modal.dom = {
      crossfade: { value: 0 },
      crossfadeVal: { textContent: '' },
      normalization: { checked: false },
      theme: { value: '' },
      bgStatus: { textContent: '' },
      btnResetBg: { style: { display: 'none' } },
      dimmerRow: { style: { display: 'none' } },
      dimmer: { value: 0 },
      dimmerVal: { textContent: '' },
      dirList: { innerHTML: '' },
      libStats: { textContent: '' }
    };

    modal._syncBgUi('/path/to/my_wallpaper.jpg', 0.5);
    assert.strictEqual(modal.dom.bgStatus.textContent, 'my_wallpaper.jpg');
    assert.strictEqual(modal.dom.btnResetBg.style.display, 'inline-flex');
    assert.strictEqual(modal.dom.dimmerRow.style.display, 'flex');
    assert.strictEqual(modal.dom.dimmerVal.textContent, '50%');

    modal._syncBgUi(null);
    assert.strictEqual(modal.dom.bgStatus.textContent, 'Nenhuma imagem personalizada ativa');
    assert.strictEqual(modal.dom.btnResetBg.style.display, 'none');
    assert.strictEqual(modal.dom.dimmerRow.style.display, 'none');
  });

  test('TrackList handles playlist reordering options and data update', () => {
    let reorderedIds = null;
    const tl = new TrackList(mockApp, {
      isPlaylist: true,
      onReorderTracks: (ids) => {
        reorderedIds = ids;
      }
    });

    const sampleTracks = [
      { filePath: '/track1.mp3', title: 'Track 1', artist: 'Artist 1', duration: 180 },
      { filePath: '/track2.mp3', title: 'Track 2', artist: 'Artist 2', duration: 200 },
      { filePath: '/track3.mp3', title: 'Track 3', artist: 'Artist 3', duration: 220 }
    ];

    tl.setTracks(sampleTracks);
    assert.strictEqual(tl.displayTracks.length, 3);
    assert.strictEqual(tl.options.isPlaylist, true);
    assert.ok(typeof tl.options.onReorderTracks === 'function');
  });

  test('PlayerBar DOM template does not contain btn-settings', () => {
    const pBar = new PlayerBar(mockAudioEngine, queueManager);
    const dummyContainer = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };
    pBar.mount(dummyContainer);
    assert.strictEqual(dummyContainer.innerHTML.includes('id="btn-settings"'), false);
    assert.strictEqual(pBar.dom.btnSettings, undefined);
  });
});
