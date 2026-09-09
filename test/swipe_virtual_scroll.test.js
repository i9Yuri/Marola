const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { TrackSwipeController, renderSwipeRevealLayer } = require('../src/ui/components/TrackItem');
const QueueManager = require('../src/audio/queue-manager');
const PlaylistDetailView = require('../src/ui/components/PlaylistDetailView');
const AllTracksView = require('../src/ui/components/AllTracksView');

describe('Swipe-to-Action (Drag to Right) & Virtual Windowing Tests', () => {

  describe('TrackSwipeController Mechanics', () => {
    test('renderSwipeRevealLayer renders solid Spotify Green layer with black play next icon and text', () => {
      const html = renderSwipeRevealLayer();
      assert.ok(html.includes('swipe-reveal-layer'));
      assert.ok(html.includes('swipe-reveal-content'));
      assert.ok(html.includes('Tocar a seguir'));
      assert.ok(html.includes('stroke="#000000"'));
      assert.strictEqual(html.includes('M12 21.35'), false); // No hearts
    });

    test('TrackSwipeController ignores non-primary pointer down or interactive child clicks', () => {
      let triggered = false;
      const controller = new TrackSwipeController({
        container: null,
        getTrackByIndex: () => ({ title: 'Test' }),
        onPlayNext: () => { triggered = true; }
      });

      // Right click button = 2
      const fakeEventRightClick = {
        button: 2,
        target: { closest: () => null }
      };
      controller._onPointerDown(fakeEventRightClick);
      assert.strictEqual(controller.isTracking, false);

      // Button child target
      const fakeEventButton = {
        button: 0,
        target: {
          closest: (sel) => sel.includes('button') ? {} : null
        }
      };
      controller._onPointerDown(fakeEventButton);
      assert.strictEqual(controller.isTracking, false);
    });

    test('Vertical scroll intent (dy > 5px) immediately aborts horizontal gesture', () => {
      const track = { title: 'Song A' };
      const row = {
        dataset: { index: '0' },
        closest: () => row,
        classList: { add: () => {}, remove: () => {} },
        style: {}
      };

      const controller = new TrackSwipeController({
        container: null,
        getTrackByIndex: () => track,
        onPlayNext: () => {}
      });

      // Pointer down at (100, 100)
      controller._onPointerDown({
        button: 0,
        clientX: 100,
        clientY: 100,
        pointerId: 1,
        target: {
          closest: (sel) => {
            if (sel.includes('button')) return null;
            return row;
          }
        }
      });

      assert.strictEqual(controller.isTracking, true);
      assert.strictEqual(controller.isSwiping, false);

      // Pointer move with vertical motion: dx = 2, dy = 10 (user is scrolling vertically)
      controller._onPointerMove({
        clientX: 102,
        clientY: 110,
        pointerId: 1,
        cancelable: true,
        preventDefault: () => {}
      });

      // Must abort tracking to prevent any stuttering or conflict with vertical scroll
      assert.strictEqual(controller.isTracking, false);
      assert.strictEqual(controller.isSwiping, false);
      assert.strictEqual(controller.activeRow, null);
    });

    test('Horizontal drag clamps to 100px and triggers onPlayNext when >= 70px', () => {
      let playedNextTrack = null;
      const track = { id: 1, title: 'Epic Track' };
      const parentEl = {
        querySelector: () => ({ classList: { add: () => {}, remove: () => {} } }),
        classList: { add: () => {}, remove: () => {} }
      };
      const row = {
        dataset: { index: '0' },
        closest: (sel) => sel === '.track-virtual-item' ? parentEl : row,
        parentElement: parentEl,
        classList: { add: () => {}, remove: () => {} },
        style: { transform: '' },
        setPointerCapture: () => {},
        releasePointerCapture: () => {}
      };

      const controller = new TrackSwipeController({
        container: null,
        getTrackByIndex: () => track,
        onPlayNext: (t) => { playedNextTrack = t; }
      });

      // Pointer down at (50, 50)
      controller._onPointerDown({
        button: 0,
        clientX: 50,
        clientY: 50,
        pointerId: 1,
        target: {
          closest: (sel) => sel.includes('button') ? null : row
        }
      });

      // Drag horizontally to right by 120px (clientX = 170, clientY = 50)
      controller._onPointerMove({
        clientX: 170,
        clientY: 50,
        pointerId: 1,
        cancelable: true,
        preventDefault: () => {}
      });

      assert.strictEqual(controller.isSwiping, true);
      // Clamped to 100px
      assert.strictEqual(controller.currentDeltaX, 100);
      assert.strictEqual(row.style.transform, 'translateX(100px)');

      // Pointer up -> trigger action
      controller._onPointerUp({ pointerId: 1 });
      assert.strictEqual(playedNextTrack, track);
      assert.strictEqual(row._justSwiped, true);
    });

    test('Horizontal drag under 70px threshold snaps back without triggering onPlayNext', () => {
      let triggered = false;
      const track = { id: 2, title: 'Short Drag Track' };
      const parentEl = {
        querySelector: () => ({ classList: { add: () => {}, remove: () => {} } }),
        classList: { add: () => {}, remove: () => {} }
      };
      const row = {
        dataset: { index: '0' },
        closest: (sel) => sel === '.track-virtual-item' ? parentEl : row,
        parentElement: parentEl,
        classList: { add: () => {}, remove: () => {} },
        style: { transform: '' },
        setPointerCapture: () => {},
        releasePointerCapture: () => {}
      };

      const controller = new TrackSwipeController({
        container: null,
        getTrackByIndex: () => track,
        onPlayNext: () => { triggered = true; }
      });

      // Pointer down at (50, 50)
      controller._onPointerDown({
        button: 0,
        clientX: 50,
        clientY: 50,
        pointerId: 2,
        target: {
          closest: (sel) => sel.includes('button') ? null : row
        }
      });

      // Drag horizontally only by 40px (under 70px)
      controller._onPointerMove({
        clientX: 90,
        clientY: 50,
        pointerId: 2,
        cancelable: true,
        preventDefault: () => {}
      });

      assert.strictEqual(controller.currentDeltaX, 40);

      // Release
      controller._onPointerUp({ pointerId: 2 });
      assert.strictEqual(triggered, false);
      assert.strictEqual(row.style.transform, 'translateX(0px)');
    });
  });

  describe('Chained Chronological FIFO Ordering in Queue', () => {
    test('QueueManager.addTrackPlayNext inserts consecutively after current track', () => {
      const qm = new QueueManager();
      const t0 = { id: 0, title: 'Current Track' };
      const t1 = { id: 1, title: 'Queue Song 1' };
      const t2 = { id: 2, title: 'Queue Song 2' };

      qm.setQueue([t0, t1, t2], 0); // Currently playing t0 at index 0

      const next1 = { id: 10, title: 'Swiped First' };
      const next2 = { id: 11, title: 'Swiped Second' };
      const next3 = { id: 12, title: 'Swiped Third' };

      // User swipes next1, then next2, then next3
      qm.addTrackPlayNext(next1);
      qm.addTrackPlayNext(next2);
      qm.addTrackPlayNext(next3);

      const queue = qm.queue;
      // Should be: [t0, next1, next2, next3, t1, t2]
      assert.strictEqual(queue[0].title, 'Current Track');
      assert.strictEqual(queue[1].title, 'Swiped First');
      assert.strictEqual(queue[2].title, 'Swiped Second');
      assert.strictEqual(queue[3].title, 'Swiped Third');
      assert.strictEqual(queue[4].title, 'Queue Song 1');
      assert.strictEqual(queue[5].title, 'Queue Song 2');
    });
  });

  describe('Virtualization & Zero-Lag DOM Structure', () => {
    const mockApp = {
      audioEngine: { isPlaying: false },
      queueManager: new QueueManager(),
      isFavorite: () => false,
      favoritesSet: new Set(),
      playTrackDirectly: () => {},
      showToast: () => {}
    };

    test('PlaylistDetailView wraps rows in .track-virtual-item with reveal layer and async decoding', () => {
      const view = new PlaylistDetailView(mockApp);
      view.sortedTracks = [
        { filePath: '/music/song1.mp3', title: 'Song 1', artist: 'Artist 1', album: 'Album 1', duration: 210, coverDataUrl: 'data:image/png;base64,abc' }
      ];

      const html = view._renderRowsSlice(0, 1);
      assert.ok(html.includes('class="track-virtual-item"'));
      assert.ok(html.includes('swipe-reveal-layer'));
      assert.ok(html.includes('Tocar a seguir'));
      assert.ok(html.includes('class="spotify-track-row'));
      assert.ok(html.includes('loading="lazy"'));
      assert.ok(html.includes('decoding="async"'));
    });

    test('AllTracksView wraps rows in .track-virtual-item with reveal layer and async decoding', () => {
      const view = new AllTracksView(mockApp);
      view.displayTracks = [
        { filePath: '/music/song2.mp3', title: 'Song 2', artist: 'Artist 2', album: 'Album 2', duration: 180, coverDataUrl: 'data:image/png;base64,xyz' }
      ];

      const mockScrollBody = { scrollTop: 0, clientHeight: 600 };
      const mockPhantom = { style: {} };
      const mockContent = { style: {}, innerHTML: '' };

      const container = {
        querySelector: (sel) => {
          if (sel === '#all-tracks-scroll-body') return mockScrollBody;
          if (sel === '#at-virtual-phantom') return mockPhantom;
          if (sel === '#at-virtual-content') return mockContent;
          return null;
        }
      };
      view.container = container;
      view._renderVirtualList();

      assert.ok(mockContent.innerHTML.includes('class="track-virtual-item"'));
      assert.ok(mockContent.innerHTML.includes('swipe-reveal-layer'));
      assert.ok(mockContent.innerHTML.includes('Tocar a seguir'));
      assert.ok(mockContent.innerHTML.includes('class="at-row'));
      assert.ok(mockContent.innerHTML.includes('loading="lazy"'));
      assert.ok(mockContent.innerHTML.includes('decoding="async"'));
    });

    test('styles.css contains strict layout containment and zero blue color tokens', () => {
      const css = fs.readFileSync(path.join(__dirname, '../src/ui/styles.css'), 'utf-8');

      // Containment rules
      assert.ok(css.includes('contain: layout style paint;'));
      assert.ok(css.includes('contain-intrinsic-size: 56px;'));

      // Swipe rules
      assert.ok(css.includes('.track-virtual-item'));
      assert.ok(css.includes('.swipe-reveal-layer'));
      assert.ok(css.includes('.swipe-reveal-content'));
      assert.ok(css.includes('background-color: #1ed760;'));
    });
  });

});
