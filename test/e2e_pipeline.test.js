const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const { parseAudioMetadata } = require('../src/metadata/tags');
const StorageManager = require('../src/db/storage');
const QueueManager = require('../src/audio/queue-manager');

describe('Full Pipeline Integration Test', () => {
  const tempDb = path.join(__dirname, 'e2e_test_db.json');
  const sampleA = path.join(__dirname, '../sample_music/Track_A_440Hz.wav');
  const sampleB = path.join(__dirname, '../sample_music/Track_B_880Hz.wav');

  let storage;
  let queue;

  before(() => {
    if (fs.existsSync(tempDb)) fs.unlinkSync(tempDb);
    storage = new StorageManager(tempDb);
    queue = new QueueManager();
  });

  after(() => {
    if (fs.existsSync(tempDb)) fs.unlinkSync(tempDb);
  });

  test('Metadata extraction with adjacent LRC parsing', async () => {
    const metaA = await parseAudioMetadata(sampleA);
    assert.strictEqual(metaA.filePath, sampleA);
    assert.ok(metaA.duration > 5.5 && metaA.duration < 6.5, `Expected ~6s duration, got ${metaA.duration}`);
    assert.ok(metaA.lyrics !== null, 'Expected adjacent .lrc to be parsed');
    assert.strictEqual(metaA.lyrics.lines.length, 4);
    assert.strictEqual(metaA.lyrics.lines[0].text, 'Início do tom de teste em 440 Hertz');

    const metaB = await parseAudioMetadata(sampleB);
    assert.strictEqual(metaB.filePath, sampleB);
    assert.ok(metaB.lyrics !== null);
    assert.strictEqual(metaB.lyrics.lines.length, 3);
  });

  test('Queue population, repeat modes and navigation', async () => {
    const metaA = await parseAudioMetadata(sampleA);
    const metaB = await parseAudioMetadata(sampleB);

    queue.setQueue([metaA, metaB], 0);
    assert.strictEqual(queue.queue.length, 2);
    assert.strictEqual(queue.getCurrentTrack().filePath, sampleA);

    // Advance next
    const next = queue.advanceNext();
    assert.strictEqual(next.filePath, sampleB);

    // With repeat-all, advances back to A
    queue.setRepeatMode('repeat-all');
    const wrap = queue.advanceNext();
    assert.strictEqual(wrap.filePath, sampleA);
  });

  test('Storage persistence, play count metric at 50% and Top Tracks ranking', async () => {
    const metaA = await parseAudioMetadata(sampleA);
    const metaB = await parseAudioMetadata(sampleB);

    storage.upsertTracksBatch([metaA, metaB]);

    // Simulate track B played twice (50% progress milestone reached)
    storage.incrementPlayCount(sampleB);
    storage.incrementPlayCount(sampleB);

    // Simulate track A played once
    storage.incrementPlayCount(sampleA);

    const topTracks = storage.getTopTracks(10);
    assert.strictEqual(topTracks.length, 2);
    assert.strictEqual(topTracks[0].filePath, sampleB);
    assert.strictEqual(topTracks[0].play_count, 2);
    assert.strictEqual(topTracks[1].filePath, sampleA);
    assert.strictEqual(topTracks[1].play_count, 1);

    // Verify reloaded storage from file preserves metrics
    const storageReloaded = new StorageManager(tempDb);
    const topReloaded = storageReloaded.getTopTracks(10);
    assert.strictEqual(topReloaded[0].filePath, sampleB);
    assert.strictEqual(topReloaded[0].play_count, 2);
  });

  test('Playlist lifecycle and track associations', async () => {
    const pl = storage.createPlaylist('Favoritas Senoides');
    assert.strictEqual(pl.name, 'Favoritas Senoides');

    storage.addTrackToPlaylist(pl.id, sampleA);
    storage.addTrackToPlaylist(pl.id, sampleB);

    const plTracks = storage.getPlaylistTracks(pl.id);
    assert.strictEqual(plTracks.length, 2);
    assert.strictEqual(plTracks[0].filePath, sampleA);
    assert.strictEqual(plTracks[1].filePath, sampleB);

    // Reorder tracks inside playlist
    storage.reorderPlaylistTracks(pl.id, [sampleB, sampleA]);
    const reordered = storage.getPlaylistTracks(pl.id);
    assert.strictEqual(reordered[0].filePath, sampleB);
    assert.strictEqual(reordered[1].filePath, sampleA);
  });
});
