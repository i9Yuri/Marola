const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const QueueManager = require('../src/audio/queue-manager');
const StorageManager = require('../src/db/storage');
const AudioEngine = require('../src/audio/audio-engine');
const path = require('path');
const fs = require('fs');

describe('AudioEngine Unit Tests', () => {
  let q, storage, engine;
  const tempDb = path.join(__dirname, 'temp_engine_db.json');

  beforeEach(() => {
    if (fs.existsSync(tempDb)) fs.unlinkSync(tempDb);
    storage = new StorageManager(tempDb);
    q = new QueueManager();
    engine = new AudioEngine(q, storage);
  });

  test('AudioEngine initialization and initial settings', () => {
    assert.strictEqual(engine.activeDeckId, 'A');
    assert.strictEqual(engine.isCrossfading, false);
    assert.strictEqual(engine.crossfadeSeconds, 3);
    assert.strictEqual(engine.volume, 0.8);
  });

  test('Setting crossfade bounds within 0s to 12s', () => {
    engine.setCrossfade(8);
    assert.strictEqual(engine.crossfadeSeconds, 8);
    assert.strictEqual(storage.getSettings().crossfadeSeconds, 8);

    engine.setCrossfade(25); // Should clamp to 12
    assert.strictEqual(engine.crossfadeSeconds, 12);

    engine.setCrossfade(-5); // Should clamp to 0
    assert.strictEqual(engine.crossfadeSeconds, 0);
  });

  test('Setting volume bounds within 0.0 to 1.0', () => {
    engine.setVolume(0.5);
    assert.strictEqual(engine.volume, 0.5);

    engine.setVolume(1.5);
    assert.strictEqual(engine.volume, 1.0);

    engine.setVolume(-0.2);
    assert.strictEqual(engine.volume, 0.0);
  });

  test('Deck swapping logic on crossfade completion', () => {
    // Mock decks for testing role flip
    engine.deckA = { id: 'A', audio: { pause() {}, currentTime: 0 }, gainNode: { gain: { setValueAtTime() {} } }, track: null };
    engine.deckB = { id: 'B', audio: { pause() {}, currentTime: 0 }, gainNode: { gain: { setValueAtTime() {} } }, track: null };
    engine.activeDeckId = 'A';
    engine.isCrossfading = true;

    // Simulate deck A ending while crossfading
    engine._handleDeckEnded('A');

    // Deck B should now be the active deck
    assert.strictEqual(engine.activeDeckId, 'B');
    assert.strictEqual(engine.isCrossfading, false);
  });
});
