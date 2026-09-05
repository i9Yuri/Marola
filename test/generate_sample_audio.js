const fs = require('fs');
const path = require('path');

/**
 * Creates a valid PCM 16-bit mono WAV buffer containing a synthesized sine wave tone.
 * @param {number} frequency Frequency in Hz
 * @param {number} durationSeconds Duration in seconds
 * @param {number} sampleRate Sample rate (e.g. 44100)
 */
function createSineWavBuffer(frequency, durationSeconds, sampleRate = 44100) {
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const dataSize = numSamples * 2; // 16-bit = 2 bytes per sample
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // "fmt " sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // SubChunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(1, 22); // NumChannels (1 = Mono)
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  buffer.writeUInt16LE(2, 32); // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // "data" sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write PCM sine wave samples
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t);
    // Scale to 16-bit signed integer (-32768 to 32767)
    const intSample = Math.floor(sample * 30000);
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  return buffer;
}

function generateSamples(outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Track 1: 440 Hz (Note A4), 6 seconds
  const track1Path = path.join(outputDir, 'Track_A_440Hz.wav');
  fs.writeFileSync(track1Path, createSineWavBuffer(440, 6));

  // Accompanying LRC for Track 1
  const lrc1Path = path.join(outputDir, 'Track_A_440Hz.lrc');
  const lrc1Content = `[ti:Senoide 440Hz]
[ar:Gerador JustPlay]
[al:Testes de Áudio]
[00:00.50]Início do tom de teste em 440 Hertz
[00:02.00]Tom constante e estável no canal A
[00:03.50]Preparando transição de crossfade
[00:05.00]Deck A finalizando com atenuação suave
`;
  fs.writeFileSync(lrc1Path, lrc1Content, 'utf-8');

  // Track 2: 880 Hz (Note A5), 6 seconds
  const track2Path = path.join(outputDir, 'Track_B_880Hz.wav');
  fs.writeFileSync(track2Path, createSineWavBuffer(880, 6));

  // Accompanying LRC for Track 2
  const lrc2Path = path.join(outputDir, 'Track_B_880Hz.lrc');
  const lrc2Content = `[ti:Senoide 880Hz]
[ar:Gerador JustPlay]
[al:Testes de Áudio]
[00:00.50]Canal B ativo com frequência elevada de 880 Hertz
[00:02.50]Metade da faixa atingida para registro de estatística
[00:04.50]Finalização da faixa de teste
`;
  fs.writeFileSync(lrc2Path, lrc2Content, 'utf-8');

  console.log(`[Samples] Gerados com sucesso em ${outputDir}:`);
  console.log(` - ${track1Path}`);
  console.log(` - ${lrc1Path}`);
  console.log(` - ${track2Path}`);
  console.log(` - ${lrc2Path}`);
}

if (require.main === module) {
  const sampleDir = path.join(__dirname, '../sample_music');
  generateSamples(sampleDir);
}

module.exports = { createSineWavBuffer, generateSamples };
