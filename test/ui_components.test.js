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
const TopHeader = require('../src/ui/components/TopHeader');
const LibraryRail = require('../src/ui/components/LibraryRail');
const SidebarRight = require('../src/ui/components/SidebarRight');
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

  test('TopHeader instantiates and exposes public API', () => {
    assert.ok(typeof TopHeader === 'function');
    let searched = '';
    const th = new TopHeader(mockApp, {
      onSearch: (t) => { searched = t; }
    });
    assert.ok(th);
    th.setSearchTerm('rock');
    assert.strictEqual(th.searchTerm, 'rock');

    const dummyContainer = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };
    th.mount(dummyContainer);
    assert.ok(dummyContainer.innerHTML.includes('top-search-pill'));
    assert.ok(dummyContainer.innerHTML.includes('top-search-divider'));
    assert.ok(dummyContainer.innerHTML.includes('top-search-browse-btn'));
    assert.ok(dummyContainer.innerHTML.includes('id="top-btn-browse"'));
  });

  test('LibraryRail instantiates and manages playlist state', () => {
    assert.ok(typeof LibraryRail === 'function');
    let selectedPl = null;
    const lr = new LibraryRail(mockApp, {
      onSelectPlaylist: (id) => { selectedPl = id; }
    });
    assert.ok(lr);
    assert.deepStrictEqual(lr.playlists, []);
    lr.setActiveItem('liked');
    assert.strictEqual(lr.activeItemId, 'liked');
  });

  test('SidebarRight instantiates and computes artist stats', async () => {
    assert.ok(typeof SidebarRight === 'function');
    const sr = new SidebarRight(mockApp, mockAudioEngine, queueManager);
    assert.ok(sr);
    assert.strictEqual(sr.isOpen, true);
    sr.toggle();
    assert.strictEqual(sr.isOpen, false);
    sr.open();
    assert.strictEqual(sr.isOpen, true);

    // Test artist stats calculation with fallback when window.api is undefined in Node
    const stats = await sr.computeArtistStats('Queen');
    assert.strictEqual(typeof stats.totalPlays, 'number');
    assert.strictEqual(typeof stats.trackCount, 'number');
  });

  test('HomeRecentView contains category filters and strictly zero advertisements', () => {
    const homeView = new HomeRecentView(mockApp);
    const dummyContainer = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };
    homeView.mount(dummyContainer);

    // Verify advertisement suppression
    const htmlLower = dummyContainer.innerHTML.toLowerCase();
    assert.strictEqual(htmlLower.includes('anúncio'), false);
    assert.strictEqual(htmlLower.includes('ad banner'), false);
    assert.strictEqual(htmlLower.includes('patrocinado'), false);
    assert.strictEqual(htmlLower.includes('upgrade to premium'), false);

    // Verify presence of modern Spotify layout elements
    assert.ok(dummyContainer.innerHTML.includes('category-pills-bar'));
    assert.ok(dummyContainer.innerHTML.includes('quick-access-grid'));
    assert.ok(dummyContainer.innerHTML.includes('cards-carousel-row'));
  });

  test('PlayerBar includes trifurcated controls: favorite heart, sidebar toggle, fullscreen', () => {
    const pBar = new PlayerBar(mockAudioEngine, queueManager);
    const dummyContainer = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };
    pBar.mount(dummyContainer);
    assert.ok(dummyContainer.innerHTML.includes('player-btn-fav'));
    assert.ok(dummyContainer.innerHTML.includes('btn-toggle-right-sidebar'));
    assert.ok(dummyContainer.innerHTML.includes('btn-fullscreen'));
  });

  test('HomeRecentView and styles.css enforce 1:1 aspect ratio and correct card markup', () => {
    const homeView = new HomeRecentView(mockApp);
    const quickGridEl = { innerHTML: '', querySelectorAll: () => [] };
    const carouselEl = { innerHTML: '', querySelectorAll: () => [] };
    const dummyContainer = {
      innerHTML: '',
      querySelector: (sel) => {
        if (sel === '#quick-access-grid') return quickGridEl;
        if (sel === '#cards-carousel-row') return carouselEl;
        return null;
      },
      querySelectorAll: () => []
    };
    homeView.container = dummyContainer;

    // Provide mock tracks with coverDataUrl
    homeView.tracks = [
      { id: '1', title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', duration: 354, play_count: 10, coverDataUrl: 'data:image/png;base64,cover1' },
      { id: '2', title: 'Under Pressure', artist: 'Queen', album: 'Hot Space', duration: 248, play_count: 5, coverDataUrl: 'data:image/png;base64,cover2' }
    ];

    homeView._renderQuickGrid();
    homeView._renderCarouselCards();

    // Check rendered card classes
    assert.ok(quickGridEl.innerHTML.includes('quick-card-cover'));
    assert.ok(quickGridEl.innerHTML.includes('quick-card-cover-img'));
    assert.ok(carouselEl.innerHTML.includes('card-item-cover-wrap'));
    assert.ok(carouselEl.innerHTML.includes('card-item-cover-img'));

    // Check CSS file directly to ensure aspect-ratio and object-fit rules are intact
    const fs = require('fs');
    const path = require('path');
    const cssContent = fs.readFileSync(path.join(__dirname, '../src/ui/styles.css'), 'utf-8');

    assert.ok(cssContent.includes('.card-item-cover-img {'));
    assert.ok(cssContent.includes('.quick-card-cover-img {'));
    assert.ok(cssContent.includes('aspect-ratio: 1 / 1;'));
    assert.ok(cssContent.includes('object-fit: cover;'));
    assert.ok(cssContent.includes('--player-bar-height: 88px;'));
    assert.ok(cssContent.includes('grid-template-columns: repeat(4, 1fr);'));
    assert.ok(cssContent.includes('padding-right: 56px;'));
  });

  test('PlayerBar includes Audio Output Sink selector and popover', () => {
    const pBar = new PlayerBar(mockAudioEngine, queueManager);
    const dummyContainer = {
      innerHTML: '',
      querySelector: (sel) => {
        if (sel === '#btn-audio-sink') return { addEventListener: () => {} };
        if (sel === '#audio-sink-popover') return { addEventListener: () => {} };
        if (sel === '#audio-sink-list') return { innerHTML: '' };
        return null;
      },
      querySelectorAll: () => []
    };
    pBar.mount(dummyContainer);

    assert.ok(dummyContainer.innerHTML.includes('id="btn-audio-sink"'));
    assert.ok(dummyContainer.innerHTML.includes('id="audio-sink-popover"'));
    assert.ok(dummyContainer.innerHTML.includes('id="audio-sink-list"'));
    assert.ok(pBar.dom.btnAudioSink);
    assert.ok(pBar.dom.audioSinkPopover);
  });

  test('HomeRecentView contains Top Tracks, Artists, and Albums carousels', () => {
    const homeView = new HomeRecentView(mockApp);
    const dummyContainer = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };
    homeView.mount(dummyContainer);

    assert.ok(dummyContainer.innerHTML.includes('id="section-top-tracks"'));
    assert.ok(dummyContainer.innerHTML.includes('id="top-tracks-carousel"'));
    assert.ok(dummyContainer.innerHTML.includes('id="section-artists"'));
    assert.ok(dummyContainer.innerHTML.includes('id="artists-carousel"'));
    assert.ok(dummyContainer.innerHTML.includes('id="section-albums"'));
    assert.ok(dummyContainer.innerHTML.includes('id="albums-carousel"'));
  });
});
