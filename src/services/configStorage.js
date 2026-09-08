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
    libraryFolders: [],
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

    if (Array.isArray(partial.libraryFolders)) {
      next.libraryFolders = Array.from(new Set(partial.libraryFolders.filter(p => typeof p === 'string' && p.trim())));
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
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConfigStorage;
}
