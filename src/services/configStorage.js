/**
 * ConfigStorage: Manages and validates application preferences and user settings.
 */
class ConfigStorage {
  static DEFAULT_CONFIG = {
    theme: 'dark', // 'dark' | 'light' | 'system'
    crossfadeSeconds: 3,
    volume: 0.8,
    repeatMode: 'repeat-all',
    shuffle: false,
    playlistSortBy: 'created',
    backgroundImage: null,
    backgroundDim: 0.4, // 0.0 to 0.9 overlay opacity
    libraryFolders: [],
    volumeNormalization: false,
    favorites: []
  };

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

    if (Array.isArray(partial.libraryFolders)) {
      next.libraryFolders = Array.from(new Set(partial.libraryFolders.filter(p => typeof p === 'string' && p.trim())));
    }

    if (typeof partial.volumeNormalization === 'boolean') {
      next.volumeNormalization = partial.volumeNormalization;
    }

    if (Array.isArray(partial.favorites)) {
      next.favorites = Array.from(new Set(partial.favorites.filter(p => typeof p === 'string' && p.trim())));
    }

    return next;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConfigStorage;
}
