/**
 * ConfigStorage: Manages and validates application preferences and user settings.
 */
class ConfigStorage {
  static DEFAULT_CONFIG = {
    theme: 'dark', // 'dark' | 'light' | 'system'
    accentColor: '#1ed760', // Default Spotify Green
    crossfadeSeconds: 3,
    volume: 0.8,
    repeatMode: 'repeat-all',
    shuffle: false,
    playlistSortBy: 'created',
    backgroundImage: null,
    backgroundDim: 0.4, // 0.0 to 0.9 overlay opacity
    musicFolders: [], // Array<{ id, path, enabled, trackCount, lastScanned }>
    libraryFolders: [], // Deprecated: kept in sync with musicFolders for backwards compatibility
    volumeNormalization: false,
    favorites: [],
    audioOutputSinkId: 'default'
  };

  static ACCENT_PRESETS = [
    { id: 'spotify', label: 'Verde Spotify', hex: '#1ed760', hover: '#1db954', subtle: 'rgba(30, 215, 96, 0.15)', contrast: '#000000' },
    { id: 'amber', label: 'Laranja Âmbar', hex: '#f59e0b', hover: '#d97706', subtle: 'rgba(245, 158, 11, 0.15)', contrast: '#1c1000' },
    { id: 'emerald', label: 'Verde Esmeralda', hex: '#10b981', hover: '#059669', subtle: 'rgba(16, 185, 129, 0.15)', contrast: '#ffffff' },
    { id: 'crimson', label: 'Carmesim Sóbrio', hex: '#e11d48', hover: '#be123c', subtle: 'rgba(225, 29, 72, 0.15)', contrast: '#ffffff' },
    { id: 'cyan', label: 'Ciano Puro', hex: '#06b6d4', hover: '#0891b2', subtle: 'rgba(6, 182, 212, 0.15)', contrast: '#04222a' }
  ];

  /**
   * Sanitizes and validates a partial settings object.
   * @param {Object} partial
   * @param {Object} current
   * @returns {Object}
   */
  static sanitize(partial = {}, current = ConfigStorage.DEFAULT_CONFIG) {
    const next = { ...current };

    if (['dark', 'light', 'system'].includes(partial.theme)) {
      next.theme = partial.theme;
    }

    if (typeof partial.accentColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(partial.accentColor)) {
      next.accentColor = partial.accentColor.toLowerCase();
    }

    if (typeof partial.crossfadeSeconds === 'number') {
      next.crossfadeSeconds = Math.max(0, Math.min(12, Math.round(partial.crossfadeSeconds * 2) / 2));
    }

    if (typeof partial.volume === 'number') {
      next.volume = Math.max(0, Math.min(1, partial.volume));
    }

    if (['sequential', 'repeat-all', 'repeat-one'].includes(partial.repeatMode)) {
      next.repeatMode = partial.repeatMode;
    }

    if (typeof partial.shuffle === 'boolean') {
      next.shuffle = partial.shuffle;
    }

    if (['created', 'name', 'manual'].includes(partial.playlistSortBy)) {
      next.playlistSortBy = partial.playlistSortBy;
    }

    if (partial.backgroundImage === null || typeof partial.backgroundImage === 'string') {
      next.backgroundImage = partial.backgroundImage;
    }

    if (typeof partial.backgroundDim === 'number') {
      next.backgroundDim = Math.max(0, Math.min(0.95, partial.backgroundDim));
    }

    // Music Folders management & migration from legacy libraryFolders / libraryPath
    let foldersToProcess = null;
    if (Array.isArray(partial.musicFolders)) {
      foldersToProcess = partial.musicFolders;
    } else if (Array.isArray(partial.libraryFolders)) {
      foldersToProcess = partial.libraryFolders.map(p => ({ path: p, enabled: true }));
    } else if (typeof partial.libraryPath === 'string' && partial.libraryPath.trim()) {
      foldersToProcess = [{ path: partial.libraryPath.trim(), enabled: true }];
    } else if (Array.isArray(current.musicFolders) && current.musicFolders.length > 0) {
      foldersToProcess = current.musicFolders;
    } else if (Array.isArray(current.libraryFolders) && current.libraryFolders.length > 0) {
      foldersToProcess = current.libraryFolders.map(p => ({ path: p, enabled: true }));
    }

    if (foldersToProcess) {
      const seenPaths = new Set();
      const sanitizedFolders = [];

      for (const item of foldersToProcess) {
        let folderPath = '';
        let enabled = true;
        let trackCount = 0;
        let lastScanned = null;
        let id = '';

        if (typeof item === 'string' && item.trim()) {
          folderPath = item.trim();
        } else if (item && typeof item === 'object') {
          if (typeof item.path === 'string' && item.path.trim()) {
            folderPath = item.path.trim();
          }
          if (typeof item.enabled === 'boolean') {
            enabled = item.enabled;
          }
          if (typeof item.trackCount === 'number' && item.trackCount >= 0) {
            trackCount = Math.floor(item.trackCount);
          }
          if (item.lastScanned) {
            lastScanned = item.lastScanned;
          }
          if (typeof item.id === 'string' && item.id.trim()) {
            id = item.id.trim();
          }
        }

        if (!folderPath) continue;

        const normalized = folderPath.length > 1 ? folderPath.replace(/[/\\]+$/, '') : folderPath;
        if (seenPaths.has(normalized)) continue;
        seenPaths.add(normalized);

        if (!id) {
          id = 'fld_' + Math.abs(ConfigStorage._hashString(normalized)).toString(36);
        }

        sanitizedFolders.push({
          id,
          path: normalized,
          enabled,
          trackCount,
          lastScanned
        });
      }

      next.musicFolders = sanitizedFolders;
      next.libraryFolders = sanitizedFolders.filter(f => f.enabled !== false).map(f => f.path);
    } else {
      next.musicFolders = [];
      next.libraryFolders = [];
    }

    if (typeof partial.volumeNormalization === 'boolean') {
      next.volumeNormalization = partial.volumeNormalization;
    }

    if (Array.isArray(partial.favorites)) {
      next.favorites = Array.from(new Set(partial.favorites.filter(p => typeof p === 'string' && p.trim())));
    }

    if (typeof partial.audioOutputSinkId === 'string' && partial.audioOutputSinkId.trim()) {
      next.audioOutputSinkId = partial.audioOutputSinkId.trim();
    }

    return next;
  }

  static _hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConfigStorage;
}
