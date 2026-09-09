/**
 * LibraryScanner: File scanning, path containment, and active-folder filtering.
 */
class LibraryScanner {
  static AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.ogg', '.opus', '.m4a', '.aac']);

  /**
   * Recursively scans a directory for supported audio files.
   * Traverses all nested subdirectories (e.g. "FLAC SONGS", "Gramado à noite vibes").
   * @param {string} folderPath
   * @param {Object} [fsOverride] Optional fs module for testing or dependency injection
   * @returns {Promise<string[]>} List of absolute file paths
   */
  static async scanDirectory(folderPath, fsOverride = null) {
    if (!folderPath) return [];

    let fsModule = fsOverride;
    if (!fsModule) {
      try {
        fsModule = require('fs');
      } catch (e) {
        return [];
      }
    }

    let pathModule;
    try {
      pathModule = require('path');
    } catch (e) {
      pathModule = {
        join: (...parts) => parts.join('/').replace(/\/+/g, '/'),
        extname: (p) => {
          const idx = p.lastIndexOf('.');
          return idx !== -1 ? p.slice(idx) : '';
        }
      };
    }

    try {
      const exists = await (fsModule.promises?.stat ? fsModule.promises.stat(folderPath).then(s => s.isDirectory()).catch(() => false) : fsModule.existsSync(folderPath));
      if (!exists) return [];
    } catch {
      return [];
    }

    const audioFiles = [];
    const queue = [folderPath];
    const visited = new Set();

    while (queue.length > 0) {
      const currentDir = queue.shift();
      if (visited.has(currentDir)) continue;
      visited.add(currentDir);

      try {
        const readdir = fsModule.promises?.readdir || ((dir, opts) => Promise.resolve(fsModule.readdirSync(dir, opts)));
        const entries = await readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          const name = entry.name || (typeof entry === 'string' ? entry : '');
          if (!name || name.startsWith('.')) continue; // Skip hidden files and directories

          const fullPath = pathModule.join(currentDir, name);
          let isDir = typeof entry.isDirectory === 'function' ? entry.isDirectory() : false;
          let isFile = typeof entry.isFile === 'function' ? entry.isFile() : false;

          // If entry is a symlink or string, resolve via stat
          if ((typeof entry.isSymbolicLink === 'function' && entry.isSymbolicLink()) || typeof entry === 'string') {
            try {
              const stat = await (fsModule.promises?.stat ? fsModule.promises.stat(fullPath) : Promise.resolve(fsModule.statSync(fullPath)));
              isDir = stat.isDirectory();
              isFile = stat.isFile();
            } catch {}
          }

          if (isDir) {
            queue.push(fullPath);
          } else if (isFile) {
            const ext = pathModule.extname(name).toLowerCase();
            if (LibraryScanner.AUDIO_EXTENSIONS.has(ext)) {
              audioFiles.push(fullPath);
            }
          }
        }
      } catch (err) {
        console.warn(`[LibraryScanner] Error reading directory ${currentDir}:`, err.message || err);
      }
    }

    return audioFiles;
  }

  /**
   * Checks if a file path resides inside a target folder directory hierarchy.
   * @param {string} filePath
   * @param {string} folderPath
   * @returns {boolean}
   */
  static isPathInFolder(filePath, folderPath) {
    if (!filePath || !folderPath) return false;

    // Normalize slashes
    const normFile = filePath.replace(/\\/g, '/');
    let normFolder = folderPath.replace(/\\/g, '/');
    if (!normFolder.endsWith('/')) {
      normFolder += '/';
    }

    return normFile.startsWith(normFolder);
  }

  /**
   * Filters a list of tracks so only tracks originating from enabled folders are retained.
   * - If musicFolders is non-empty, checks against folders where enabled !== false.
   * - If all configured folders are disabled, returns empty array [].
   * - If no musicFolders are configured, returns original tracks.
   * @param {Array<Object>} tracks
   * @param {Array<Object>} musicFolders
   * @returns {Array<Object>}
   */
  static filterTracksByActiveFolders(tracks, musicFolders) {
    if (!Array.isArray(tracks)) return [];
    if (!Array.isArray(musicFolders) || musicFolders.length === 0) {
      return tracks;
    }

    const enabledFolders = musicFolders
      .filter(f => f && f.enabled !== false && typeof f.path === 'string')
      .map(f => {
        let p = f.path.replace(/\\/g, '/');
        return p.endsWith('/') ? p : p + '/';
      });

    if (enabledFolders.length === 0) {
      // All folders disabled
      return [];
    }

    return tracks.filter(track => {
      const fp = (track?.filePath || '').replace(/\\/g, '/');
      return enabledFolders.some(f => fp.startsWith(f));
    });
  }

  /**
   * Counts how many tracks belong to a given folder path.
   * @param {string} folderPath
   * @param {Array<Object>} tracks
   * @returns {number}
   */
  static countTracksInFolder(folderPath, tracks) {
    if (!folderPath || !Array.isArray(tracks)) return 0;
    let count = 0;
    for (const t of tracks) {
      if (LibraryScanner.isPathInFolder(t?.filePath, folderPath)) {
        count++;
      }
    }
    return count;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LibraryScanner;
}
if (typeof window !== 'undefined') {
  window.LibraryScanner = LibraryScanner;
}
