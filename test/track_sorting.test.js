const { test, describe } = require('node:test');
const assert = require('node:assert');
const TrackList = require('../src/ui/components/TrackList');

describe('TrackList 3-State Column Sorting Logic', () => {
  const sampleTracks = [
    { filePath: '/m/b.mp3', title: 'Beta Song', artist: 'Zeta Artist', album: 'Pop', duration: 120 },
    { filePath: '/m/a.mp3', title: 'Alpha Song', artist: 'Gamma Artist', album: 'Rock', duration: 240 },
    { filePath: '/m/c.mp3', title: 'Charlie Song', artist: 'Beta Artist', album: 'Jazz', duration: 90 }
  ];

  test('Cycle sort state machine: asc -> desc -> none (reset to original order)', () => {
    const list = new TrackList({ queueManager: { getCurrentTrack: () => null } });
    list.setTracks(sampleTracks);

    // Initial order
    assert.deepStrictEqual(list.displayTracks.map(t => t.title), ['Beta Song', 'Alpha Song', 'Charlie Song']);
    assert.strictEqual(list.sortColumn, null);
    assert.strictEqual(list.sortDirection, 'none');

    // 1. Click 'title' -> ASC
    list._cycleSort('title');
    assert.strictEqual(list.sortColumn, 'title');
    assert.strictEqual(list.sortDirection, 'asc');
    assert.deepStrictEqual(list.displayTracks.map(t => t.title), ['Alpha Song', 'Beta Song', 'Charlie Song']);

    // 2. Click 'title' again -> DESC
    list._cycleSort('title');
    assert.strictEqual(list.sortColumn, 'title');
    assert.strictEqual(list.sortDirection, 'desc');
    assert.deepStrictEqual(list.displayTracks.map(t => t.title), ['Charlie Song', 'Beta Song', 'Alpha Song']);

    // 3. Click 'title' again -> NONE (reset to original)
    list._cycleSort('title');
    assert.strictEqual(list.sortColumn, null);
    assert.strictEqual(list.sortDirection, 'none');
    assert.deepStrictEqual(list.displayTracks.map(t => t.title), ['Beta Song', 'Alpha Song', 'Charlie Song']);
  });

  test('Sorting by duration and verifying original array immutability', () => {
    const originalCopy = [...sampleTracks];
    const list = new TrackList({ queueManager: { getCurrentTrack: () => null } });
    list.setTracks(sampleTracks);

    // Sort by duration ASC
    list._cycleSort('duration');
    assert.deepStrictEqual(list.displayTracks.map(t => t.duration), [90, 120, 240]);

    // Sort by duration DESC
    list._cycleSort('duration');
    assert.deepStrictEqual(list.displayTracks.map(t => t.duration), [240, 120, 90]);

    // Check original array was not mutated
    assert.deepStrictEqual(sampleTracks, originalCopy);
  });
});
