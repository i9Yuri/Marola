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
});
