const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const QueueManager = require('../src/audio/queue-manager');

describe('QueueManager Tests', () => {
  let q;
  const tracks = [
    { filePath: '/m/1.mp3', title: 'Track 1' },
    { filePath: '/m/2.mp3', title: 'Track 2' },
    { filePath: '/m/3.mp3', title: 'Track 3' }
  ];

  beforeEach(() => {
    q = new QueueManager();
    q.setQueue(tracks, 0);
  });

  test('Sequential playback reaches null at end', () => {
    q.setRepeatMode('sequential');
    assert.strictEqual(q.getCurrentTrack().title, 'Track 1');

    assert.strictEqual(q.advanceNext().title, 'Track 2');
    assert.strictEqual(q.advanceNext().title, 'Track 3');
    assert.strictEqual(q.advanceNext(), null);
  });

  test('Repeat-all wraps around', () => {
    q.setRepeatMode('repeat-all');
    assert.strictEqual(q.advanceNext().title, 'Track 2');
    assert.strictEqual(q.advanceNext().title, 'Track 3');
    assert.strictEqual(q.advanceNext().title, 'Track 1'); // Wraps
  });

  test('Repeat-one repeats current track', () => {
    q.setRepeatMode('repeat-one');
    assert.strictEqual(q.getCurrentTrack().title, 'Track 1');
    assert.strictEqual(q.advanceNext().title, 'Track 1');
  });

  test('Shuffle does not immediately repeat current track', () => {
    q.setShuffle(true);
    const first = q.getCurrentTrack();
    const next = q.advanceNext();
    assert.notStrictEqual(next.filePath, first.filePath);
  });

  test('Move and remove track operations', () => {
    // Current is Track 1 (index 0)
    q.moveTrack(0, 2); // Move Track 1 to end -> [Track 2, Track 3, Track 1]
    assert.strictEqual(q.currentIndex, 2);
    assert.strictEqual(q.getCurrentTrack().title, 'Track 1');

    q.removeTrack(0); // Removes Track 2
    assert.strictEqual(q.queue.length, 2);
    assert.strictEqual(q.currentIndex, 1); // Track 1 is now index 1
    assert.strictEqual(q.getCurrentTrack().title, 'Track 1');
  });

  test('addTrackPlayNext preserves chronological FIFO order following current track', () => {
    // Initial queue: [Track 1 (current, idx 0), Track 2 (idx 1), Track 3 (idx 2)]
    assert.strictEqual(q.currentIndex, 0);
    assert.strictEqual(q.getCurrentTrack().title, 'Track 1');

    const trackA = { filePath: '/m/A.mp3', title: 'Track A' };
    const trackB = { filePath: '/m/B.mp3', title: 'Track B' };
    const trackC = { filePath: '/m/C.mp3', title: 'Track C' };

    // First Play Next insertion -> placed at currentIndex + 1 = index 1
    q.addTrackPlayNext(trackA);
    assert.strictEqual(q.queue[1].title, 'Track A');
    assert.strictEqual(q.priorityQueueCount, 1);

    // Second Play Next insertion -> placed at currentIndex + 1 + 1 = index 2 (after Track A)
    q.addTrackPlayNext(trackB);
    assert.strictEqual(q.queue[2].title, 'Track B');
    assert.strictEqual(q.priorityQueueCount, 2);

    // Third Play Next insertion -> placed at currentIndex + 1 + 2 = index 3 (after Track B)
    q.addTrackPlayNext(trackC);
    assert.strictEqual(q.queue[3].title, 'Track C');
    assert.strictEqual(q.priorityQueueCount, 3);

    // Queue order should be: [Track 1, Track A, Track B, Track C, Track 2, Track 3]
    const titles = q.queue.map(t => t.title);
    assert.deepStrictEqual(titles, ['Track 1', 'Track A', 'Track B', 'Track C', 'Track 2', 'Track 3']);

    // Sequential playback should visit them in exact FIFO order
    q.setRepeatMode('sequential');
    assert.strictEqual(q.advanceNext().title, 'Track A');
    assert.strictEqual(q.priorityQueueCount, 0); // resets on track advance
    assert.strictEqual(q.advanceNext().title, 'Track B');
    assert.strictEqual(q.advanceNext().title, 'Track C');
    assert.strictEqual(q.advanceNext().title, 'Track 2');
    assert.strictEqual(q.advanceNext().title, 'Track 3');
  });
});
