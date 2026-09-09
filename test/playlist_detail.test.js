const { test, describe } = require('node:test');
const assert = require('node:assert');

const PlaylistDetailView = require('../src/ui/components/PlaylistDetailView');
const QueueManager = require('../src/audio/queue-manager');

describe('PlaylistDetailView Unit Tests', () => {
  const queueManager = new QueueManager();
  const mockAudioEngine = {
    isPlaying: false,
    on: () => {},
    emit: () => {},
    playTrack: () => {}
  };

  const mockApp = {
    audioEngine: mockAudioEngine,
    queueManager,
    currentView: 'playlist-detail',
    favoritesSet: new Set(['/music/fav1.mp3']),
    isFavorite: (fp) => mockApp.favoritesSet.has(fp),
    playTrackDirectly: () => {},
    setQueueAndPlay: () => {},
    showToast: () => {}
  };

  const sampleTracks = [
    { filePath: '/music/fav1.mp3', title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', duration: 354, added_at: Date.now() - 3600000 },
    { filePath: '/music/track2.mp3', title: 'Starman', artist: 'David Bowie', album: 'The Rise and Fall of Ziggy Stardust', duration: 250, added_at: Date.now() - 86400000 * 3 },
    { filePath: '/music/track3.mp3', title: 'Another One Bites the Dust', artist: 'Queen', album: 'The Game', duration: 215, added_at: Date.now() - 86400000 * 20 }
  ];

  test('Instantiates with default state', () => {
    const view = new PlaylistDetailView(mockApp);
    assert.ok(view);
    assert.strictEqual(view.sortBy, 'default');
    assert.strictEqual(view.userName, 'Yuri');
    assert.deepStrictEqual(view.tracks, []);
  });

  test('Formats aggregate duration accurately', () => {
    const view = new PlaylistDetailView(mockApp);

    assert.strictEqual(view._formatAggregateDuration([]), '');
    assert.strictEqual(view._formatAggregateDuration([{ duration: 45 }]), '45 s');
    assert.strictEqual(view._formatAggregateDuration([{ duration: 150 }]), '2 min 30 s');
    assert.strictEqual(view._formatAggregateDuration([{ duration: 3600 }]), '1 hr 0 min');
    assert.strictEqual(view._formatAggregateDuration([{ duration: 3665 }]), '1 hr 1 min');
    assert.strictEqual(view._formatAggregateDuration([{ duration: 7320 }]), '2 hr 2 min');
  });

  test('Formats date added accurately', () => {
    const view = new PlaylistDetailView(mockApp);

    assert.strictEqual(view._formatDateAdded(0), '—');
    assert.strictEqual(view._formatDateAdded(null), '—');

    const now = Date.now();
    assert.strictEqual(view._formatDateAdded(now - 1000 * 60 * 10), 'Hoje');
    assert.strictEqual(view._formatDateAdded(now - 1000 * 60 * 60 * 25), 'Ontem');
    assert.strictEqual(view._formatDateAdded(now - 1000 * 60 * 60 * 24 * 4), 'há 4 dias');
    
    // Older date format
    const oldTimestamp = new Date(2023, 0, 15).getTime();
    const formatted = view._formatDateAdded(oldTimestamp);
    assert.ok(formatted.includes('2023'));
    assert.ok(formatted.includes('15'));
  });

  test('Sorts tracks correctly by different criteria', () => {
    const view = new PlaylistDetailView(mockApp);
    view.tracks = [...sampleTracks];

    // Title sort
    view.sortBy = 'title';
    view._applySort();
    assert.strictEqual(view.sortedTracks[0].title, 'Another One Bites the Dust');
    assert.strictEqual(view.sortedTracks[1].title, 'Bohemian Rhapsody');
    assert.strictEqual(view.sortedTracks[2].title, 'Starman');

    // Artist sort
    view.sortBy = 'artist';
    view._applySort();
    assert.strictEqual(view.sortedTracks[0].artist, 'David Bowie');
    assert.strictEqual(view.sortedTracks[1].artist, 'Queen');

    // Duration sort (descending)
    view.sortBy = 'duration';
    view._applySort();
    assert.strictEqual(view.sortedTracks[0].duration, 354);
    assert.strictEqual(view.sortedTracks[1].duration, 250);
    assert.strictEqual(view.sortedTracks[2].duration, 215);

    // Recent sort (descending added_at)
    view.sortBy = 'recent';
    view._applySort();
    assert.strictEqual(view.sortedTracks[0].filePath, '/music/fav1.mp3');
  });

  test('Renders playlist view with Spotify header, action bar and 5-column table', () => {
    const view = new PlaylistDetailView(mockApp);
    const container = {
      innerHTML: '',
      style: {},
      className: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };

    view.mount(container);
    view.playlist = {
      id: 'pl-1',
      name: 'Rock Clássico',
      type: 'playlist'
    };
    view.tracks = [...sampleTracks];
    view.sortedTracks = [...sampleTracks];

    view.render();

    // Verify critical Spotify markup elements
    assert.ok(container.innerHTML.includes('playlist-hero-header'));
    assert.ok(container.innerHTML.includes('Rock Clássico'));
    assert.ok(container.innerHTML.includes('playlist-author-line'));
    assert.ok(container.innerHTML.includes('3 músicas'));
    assert.ok(container.innerHTML.includes('btn-playlist-play-main'));
    assert.ok(container.innerHTML.includes('btn-playlist-shuffle'));
    assert.ok(container.innerHTML.includes('playlist-sort-select'));
    assert.ok(container.innerHTML.includes('spotify-table-header'));
    assert.ok(container.innerHTML.includes('spotify-track-row'));
    assert.ok(container.innerHTML.includes('Bohemian Rhapsody'));
    assert.ok(container.innerHTML.includes('David Bowie'));
    assert.ok(container.innerHTML.includes('A Night at the Opera'));
  });

  test('Renders Liked Songs specific theme and empty state', () => {
    const view = new PlaylistDetailView(mockApp);
    const container = {
      innerHTML: '',
      style: {},
      className: '',
      querySelector: () => null,
      querySelectorAll: () => []
    };

    view.mount(container);
    view.playlist = {
      id: 'liked',
      name: 'Músicas Curtidas',
      type: 'liked'
    };
    view.tracks = [];
    view.sortedTracks = [];

    view.render();

    assert.ok(container.innerHTML.includes('hero-liked-songs'));
    assert.ok(container.innerHTML.includes('hero-cover-liked-gradient'));
    assert.ok(container.innerHTML.includes('playlist-empty-table-state'));
    assert.ok(container.innerHTML.includes('Esta playlist está vazia'));
  });
});
