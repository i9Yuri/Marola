const fs = require('fs');
const path = require('path');

/**
 * Parses an .lrc formatted text content into structured timestamped lines
 * @param {string} lrcContent
 * @returns {{ lines: Array<{ time: number, text: string }>, plain: string }}
 */
function parseLrc(lrcContent) {
  if (!lrcContent || typeof lrcContent !== 'string') {
    return { lines: [], plain: '' };
  }

  const lines = [];
  const rawLines = lrcContent.split(/\r?\n/);
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for metadata tags like [ti:Title], [ar:Artist]
    if (/^\[(ti|ar|al|by|offset|length):.*\]$/i.test(trimmed)) {
      continue;
    }

    const matches = [...trimmed.matchAll(timeRegex)];
    if (matches.length > 0) {
      const text = trimmed.replace(timeRegex, '').trim();
      for (const match of matches) {
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const ms = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
        const totalSeconds = min * 60 + sec + ms / 1000;
        lines.push({ time: totalSeconds, text });
      }
    } else {
      // Un-timestamped line fallback
      lines.push({ time: -1, text: trimmed });
    }
  }

  // Sort chronologically if timestamps exist
  lines.sort((a, b) => {
    if (a.time === -1 && b.time === -1) return 0;
    if (a.time === -1) return 1;
    if (b.time === -1) return -1;
    return a.time - b.time;
  });

  const plain = lines.map(l => l.text).filter(Boolean).join('\n');
  return { lines, plain };
}

/**
 * Searches for an accompanying .lrc file in the same directory as the audio file
 * @param {string} audioFilePath
 * @returns {string|null}
 */
function findAdjacentLrc(audioFilePath) {
  try {
    const dir = path.dirname(audioFilePath);
    const parsed = path.parse(audioFilePath);
    const candidateLrc = path.join(dir, `${parsed.name}.lrc`);

    if (fs.existsSync(candidateLrc)) {
      return fs.readFileSync(candidateLrc, 'utf-8');
    }

    // Try case-insensitive matching in directory
    const files = fs.readdirSync(dir);
    const targetName = `${parsed.name}.lrc`.toLowerCase();
    const matched = files.find(f => f.toLowerCase() === targetName);
    if (matched) {
      return fs.readFileSync(path.join(dir, matched), 'utf-8');
    }
  } catch (err) {
    console.warn(`[Tags] Could not check adjacent LRC for ${audioFilePath}:`, err.message);
  }
  return null;
}

/**
 * Extracts metadata, album art, and lyrics from an audio file.
 * @param {string} filePath
 * @returns {Promise<{
 *   filePath: string,
 *   title: string,
 *   artist: string,
 *   album: string,
 *   duration: number,
 *   coverDataUrl: string|null,
 *   lyrics: { lines: Array<{ time: number, text: string }>, plain: string }|null
 * }>}
 */
async function parseAudioMetadata(filePath) {
  const baseName = path.parse(filePath).name;
  let metadata = null;

  try {
    const mm = await import('music-metadata');
    metadata = await mm.parseFile(filePath, { duration: true, skipCovers: false });
  } catch (err) {
    console.warn(`[Tags] music-metadata parse error on ${filePath}, using fallback:`, err.message);
  }

  const common = metadata?.common || {};
  const format = metadata?.format || {};

  const title = common.title?.trim() || baseName;
  const artist = common.artist?.trim() || (common.artists && common.artists.join(', ')) || 'Artista Desconhecido';
  const album = common.album?.trim() || 'Álbum Desconhecido';
  const duration = typeof format.duration === 'number' && !isNaN(format.duration) ? format.duration : 0;

  // Extract embedded cover
  let coverDataUrl = null;
  if (common.picture && common.picture.length > 0) {
    try {
      const pic = common.picture[0];
      const mime = pic.format || 'image/jpeg';
      const base64 = Buffer.from(pic.data).toString('base64');
      coverDataUrl = `data:${mime};base64,${base64}`;
    } catch (e) {
      console.warn(`[Tags] Failed to serialize cover art for ${filePath}:`, e.message);
    }
  }

  // Lyrics extraction: 1) Adjacent .lrc -> 2) Embedded USLT / lyrics tag
  let lyrics = null;
  const adjacentLrc = findAdjacentLrc(filePath);

  if (adjacentLrc) {
    lyrics = parseLrc(adjacentLrc);
  } else if (common.lyrics && common.lyrics.length > 0) {
    const rawLyrics = typeof common.lyrics[0] === 'string' ? common.lyrics[0] : common.lyrics[0]?.text;
    if (rawLyrics) {
      lyrics = parseLrc(rawLyrics);
    }
  }

  return {
    filePath,
    title,
    artist,
    album,
    duration,
    coverDataUrl,
    lyrics
  };
}

module.exports = {
  parseAudioMetadata,
  parseLrc,
  findAdjacentLrc
};
