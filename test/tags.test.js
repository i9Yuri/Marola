const { test, describe } = require('node:test');
const assert = require('node:assert');
const { parseLrc } = require('../src/metadata/tags');

describe('Metadata & LRC parsing', () => {
  test('parseLrc parses timestamped lyrics into ordered seconds', () => {
    const lrc = `
[ti:Sample Song]
[ar:Sample Artist]
[00:04.50]Primeira linha da música
[00:10.20]Segunda linha sincronizada
[01:05.00]Refrão após um minuto
`;
    const result = parseLrc(lrc);
    assert.strictEqual(result.lines.length, 3);
    assert.strictEqual(result.lines[0].time, 4.5);
    assert.strictEqual(result.lines[0].text, 'Primeira linha da música');
    assert.strictEqual(result.lines[1].time, 10.2);
    assert.strictEqual(result.lines[1].text, 'Segunda linha sincronizada');
    assert.strictEqual(result.lines[2].time, 65.0);
    assert.strictEqual(result.lines[2].text, 'Refrão após um minuto');
  });

  test('parseLrc handles unsynced plain lyrics', () => {
    const plain = `Linha sem timestamp 1\nLinha sem timestamp 2`;
    const result = parseLrc(plain);
    assert.strictEqual(result.lines.length, 2);
    assert.strictEqual(result.lines[0].text, 'Linha sem timestamp 1');
    assert.strictEqual(result.plain, 'Linha sem timestamp 1\nLinha sem timestamp 2');
  });

  test('parseAudioMetadata parses .opus Vorbis metadata and duration', async () => {
    const { parseAudioMetadata } = require('../src/metadata/tags');
    const path = require('path');
    const opusFile = path.join(__dirname, '../sample_music/Track_C_Opus.opus');

    const meta = await parseAudioMetadata(opusFile);
    assert.strictEqual(meta.filePath, opusFile);
    assert.strictEqual(meta.title, 'Test Opus Track');
    assert.strictEqual(meta.artist, 'Opus Artist');
    assert.strictEqual(meta.album, 'Opus Test Album');
    assert.ok(meta.duration >= 0.9 && meta.duration <= 1.2, `Expected ~1s duration, got ${meta.duration}`);
  });
});
