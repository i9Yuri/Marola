const fs = require('fs');
const path = require('path');
const ConfigStorage = require('../services/configStorage');

class StorageManager {
  constructor(customDbPath = null) {
    this.dbPath = customDbPath || this._getDefaultDbPath();
    this.data = {
      tracks: {}, // id (filePath) -> { id, filePath, title, artist, album, duration, coverDataUrl, play_count, last_played_at, added_at }
      playlists: [], // Array<{ id, name, createdAt, trackIds: string[] }>
      playlistOrder: [], // Array of playlist IDs for manual ordering
      settings: { ...ConfigStorage.DEFAULT_CONFIG }
    };
    this.init();
  }

  _getDefaultDbPath() {
    try {
      const { app } = require('electron');
      if (app && typeof app.getPath === 'function') {
        const userDir = app.getPath('userData');
        if (!fs.existsSync(userDir)) {
          fs.mkdirSync(userDir, { recursive: true });
        }
        return path.join(userDir, 'justplay_db.json');
      }
    } catch (e) {
      // Running in standard node/test environment
    }
    const fallbackDir = path.join(process.cwd(), '.data');
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true });
    }
    return path.join(fallbackDir, 'justplay_db.json');
  }

  init() {
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          tracks: parsed.tracks || {},
          playlists: parsed.playlists || [],
          playlistOrder: parsed.playlistOrder || (parsed.playlists ? parsed.playlists.map(p => p.id) : []),
          settings: { ...this.data.settings, ...(parsed.settings || {}) }
        };
      } else {
        this.save();
      }
    } catch (err) {
      console.error('[Storage] Error loading DB, initializing fresh:', err.message);
      this.save();
    }
  }

  save() {
    try {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpPath = `${this.dbPath}.${Date.now()}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.dbPath);
    } catch (err) {
      console.error('[Storage] Error saving DB:', err.message);
    }
  }

  // --- Track & Metrics Operations ---

  /**
   * Saves or updates track metadata. Preserves existing play_count and last_played_at.
   */
  upsertTrack(track) {
    if (!track || !track.filePath) return null;
    const id = track.filePath;
    const existing = this.data.tracks[id] || {};

    this.data.tracks[id] = {
      id,
      filePath: track.filePath,
      title: track.title || existing.title || path.parse(track.filePath).name,
      artist: track.artist || existing.artist || 'Artista Desconhecido',
      album: track.album || existing.album || 'Álbum Desconhecido',
      duration: track.duration || existing.duration || 0,
      coverDataUrl: track.coverDataUrl !== undefined ? track.coverDataUrl : (existing.coverDataUrl || null),
      play_count: typeof existing.play_count === 'number' ? existing.play_count : 0,
      last_played_at: existing.last_played_at || null,
      added_at: existing.added_at || Date.now()
    };

    this.save();
    return this.data.tracks[id];
  }

  /**
   * Bulk upserts tracks without saving on every iteration.
   */
  upsertTracksBatch(tracks) {
    if (!Array.isArray(tracks)) return [];
    const results = [];
    for (const track of tracks) {
      if (!track || !track.filePath) continue;
      const id = track.filePath;
      const existing = this.data.tracks[id] || {};

      this.data.tracks[id] = {
        id,
        filePath: track.filePath,
        title: track.title || existing.title || path.parse(track.filePath).name,
        artist: track.artist || existing.artist || 'Artista Desconhecido',
        album: track.album || existing.album || 'Álbum Desconhecido',
        duration: track.duration || existing.duration || 0,
        coverDataUrl: track.coverDataUrl !== undefined ? track.coverDataUrl : (existing.coverDataUrl || null),
        play_count: typeof existing.play_count === 'number' ? existing.play_count : 0,
        last_played_at: existing.last_played_at || null,
        added_at: existing.added_at || Date.now()
      };
      results.push(this.data.tracks[id]);
    }
    this.save();
    return results;
  }

  /**
   * Registers a playback completion (when >= 50% played or finished).
   * Increments play_count and sets last_played_at to now.
   */
  incrementPlayCount(filePath) {
    if (!filePath) return null;
    const track = this.data.tracks[filePath];
    if (!track) {
      // Track not yet registered, register now
      this.upsertTrack({ filePath });
    }

    if (this.data.tracks[filePath]) {
      this.data.tracks[filePath].play_count = (this.data.tracks[filePath].play_count || 0) + 1;
      this.data.tracks[filePath].last_played_at = Date.now();
      this.save();
      return this.data.tracks[filePath];
    }
    return null;
  }

  getAllTracks() {
    return Object.values(this.data.tracks);
  }

  getTrack(filePath) {
    return this.data.tracks[filePath] || null;
  }

  /**
   * Returns top tracks ordered strictly by play_count DESC.
   */
  getTopTracks(limit = 50) {
    return Object.values(this.data.tracks)
      .filter(t => (t.play_count || 0) > 0)
      .sort((a, b) => {
        if (b.play_count !== a.play_count) {
          return b.play_count - a.play_count;
        }
        return (b.last_played_at || 0) - (a.last_played_at || 0);
      })
      .slice(0, limit);
  }

  /**
   * Returns recent tracks ordered by last_played_at or added_at DESC.
   */
  getRecentTracks(limit = 100) {
    return Object.values(this.data.tracks)
      .sort((a, b) => {
        const timeA = a.last_played_at || a.added_at || 0;
        const timeB = b.last_played_at || b.added_at || 0;
        return timeB - timeA;
      })
      .slice(0, limit);
  }

  // --- Playlist CRUD & Ordering ---

  createPlaylist(name) {
    const id = 'pl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const newPlaylist = {
      id,
      name: name?.trim() || 'Nova Playlist',
      createdAt: Date.now(),
      trackIds: []
    };
    this.data.playlists.push(newPlaylist);
    this.data.playlistOrder.push(id);
    this.save();
    return newPlaylist;
  }

  renamePlaylist(id, newName) {
    const pl = this.data.playlists.find(p => p.id === id);
    if (!pl) return null;
    pl.name = newName?.trim() || pl.name;
    this.save();
    return pl;
  }

  deletePlaylist(id) {
    const index = this.data.playlists.findIndex(p => p.id === id);
    if (index === -1) return false;
    this.data.playlists.splice(index, 1);
    this.data.playlistOrder = this.data.playlistOrder.filter(plId => plId !== id);
    this.save();
    return true;
  }

  addTrackToPlaylist(playlistId, trackFilePath) {
    const pl = this.data.playlists.find(p => p.id === playlistId);
    if (!pl) return null;
    if (!pl.trackIds.includes(trackFilePath)) {
      pl.trackIds.push(trackFilePath);
      this.save();
    }
    return pl;
  }

  removeTrackFromPlaylist(playlistId, trackIndex) {
    const pl = this.data.playlists.find(p => p.id === playlistId);
    if (!pl) return null;
    if (trackIndex >= 0 && trackIndex < pl.trackIds.length) {
      pl.trackIds.splice(trackIndex, 1);
      this.save();
    }
    return pl;
  }

  reorderPlaylistTracks(playlistId, newTrackIds) {
    const pl = this.data.playlists.find(p => p.id === playlistId);
    if (!pl || !Array.isArray(newTrackIds)) return null;
    pl.trackIds = newTrackIds;
    this.save();
    return pl;
  }

  reorderPlaylists(newOrderIds) {
    if (!Array.isArray(newOrderIds)) return;
    this.data.playlistOrder = newOrderIds;
    this.data.settings.playlistSortBy = 'manual';
    this.save();
  }

  getPlaylists(sortBy = null) {
    const mode = sortBy || this.data.settings.playlistSortBy || 'created';
    const list = [...this.data.playlists];

    if (mode === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    } else if (mode === 'created') {
      list.sort((a, b) => a.createdAt - b.createdAt);
    } else if (mode === 'manual') {
      const orderMap = new Map(this.data.playlistOrder.map((id, index) => [id, index]));
      list.sort((a, b) => {
        const orderA = orderMap.has(a.id) ? orderMap.get(a.id) : 9999;
        const orderB = orderMap.has(b.id) ? orderMap.get(b.id) : 9999;
        return orderA - orderB;
      });
    }

    return list;
  }

  getPlaylistTracks(playlistId) {
    const pl = this.data.playlists.find(p => p.id === playlistId);
    if (!pl) return [];
    return pl.trackIds.map(id => this.data.tracks[id]).filter(Boolean);
  }

  // --- Settings & Preferences ---

  getSettings() {
    return { ...this.data.settings };
  }

  updateSettings(newSettings) {
    this.data.settings = ConfigStorage.sanitize(newSettings, this.data.settings);
    this.save();
    return this.data.settings;
  }

  // --- Favorites ---

  toggleFavorite(filePath) {
    if (!filePath) return { isFavorite: false, favorites: this.getFavorites() };
    const favs = new Set(this.data.settings.favorites || []);
    let isFav = false;
    if (favs.has(filePath)) {
      favs.delete(filePath);
      isFav = false;
    } else {
      favs.add(filePath);
      isFav = true;
    }
    this.data.settings.favorites = Array.from(favs);
    this.save();
    return { filePath, isFavorite: isFav, favorites: this.data.settings.favorites };
  }

  isFavorite(filePath) {
    if (!filePath || !this.data.settings.favorites) return false;
    return this.data.settings.favorites.includes(filePath);
  }

  getFavorites() {
    return [...(this.data.settings.favorites || [])];
  }

  // --- Library Folders ---

  addLibraryFolder(folderPath) {
    if (!folderPath) return this.data.settings.libraryFolders || [];
    const folders = new Set(this.data.settings.libraryFolders || []);
    folders.add(folderPath);
    this.data.settings.libraryFolders = Array.from(folders);
    this.save();
    return this.data.settings.libraryFolders;
  }

  removeLibraryFolder(folderPath) {
    if (!folderPath || !this.data.settings.libraryFolders) return [];
    this.data.settings.libraryFolders = this.data.settings.libraryFolders.filter(f => f !== folderPath);
    this.save();
    return this.data.settings.libraryFolders;
  }
}

module.exports = StorageManager;
