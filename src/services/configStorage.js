/**
 * ConfigStorage: Manages and validates application preferences and user settings.
 */
class ConfigStorage {
  static DEFAULT_CONFIG = {
    theme: 'dark', // 'dark' | 'light' | 'system'
    accentColor: '#38bdf8', // Default industrial steel blue
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

  static ACCENT_PRESETS = [
    { id: 'blue', label: 'Azul Aço', hex: '#38bdf8', hover: '#0ea5e9', subtle: 'rgba(56, 189, 248, 0.15)', contrast: '#031424' },
    { id: 'emerald', label: 'Verde Esmeralda', hex: '#10b981', hover: '#059669', subtle: 'rgba(16, 185, 129, 0.15)', contrast: '#022115' },
    { id: 'amber', label: 'Âmbar Quente', hex: '#f59e0b', hover: '#d97706', subtle: 'rgba(245, 158, 11, 0.15)', contrast: '#251500' },
    { id: 'teal', label: 'Teal Sóbrio', hex: '#14b8a6', hover: '#0d9488', subtle: 'rgba(20, 184, 166, 0.15)', contrast: '#01201c' },
    { id: 'zinc', label: 'Grafite Puro', hex: '#e4e4e7', hover: '#a1a1aa', subtle: 'rgba(228, 228, 231, 0.15)', contrast: '#18181b' }
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

    return next;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConfigStorage;
}
