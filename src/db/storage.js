const fs = require('fs');
const path = require('path');
const ConfigStorage = require('../services/configStorage');
const LibraryScanner = require('../services/libraryScanner');

class StorageManager {
  constructor(customDbPath = null) {
    this.dbPath = customDbPath || this._getDefaultDbPath();
    this.data = {
      tracks: {}, // id (filePath) -> { id, filePath, title, artist, album, duration, coverDataUrl, play_count, last_played_at, added_at }
      playlists: [], // Array<{ id, name, createdAt, trackIds: string[] }>
      playlistOrder: [], // Array of playlist IDs for manual ordering
      settings: ConfigStorage.sanitize({}, ConfigStorage.DEFAULT_CONFIG)
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
          settings: ConfigStorage.sanitize(parsed.settings || {}, this.data.settings)
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

  _filterActive(tracks) {
    const folders = this.data.settings?.musicFolders;
    if (Array.isArray(folders) && folders.length > 0) {
      return LibraryScanner.filterTracksByActiveFolders(tracks, folders);
    }
    return tracks;
  }

  getAllTracks(options = { activeOnly: true }) {
    const all = Object.values(this.data.tracks);
    return options?.activeOnly !== false ? this._filterActive(all) : all;
  }

  getTrack(filePath) {
    return this.data.tracks[filePath] || null;
  }

  /**
   * Returns top tracks ordered strictly by play_count DESC.
   */
  getTopTracks(limit = 50, options = { activeOnly: true }) {
    const all = Object.values(this.data.tracks);
    const pool = options?.activeOnly !== false ? this._filterActive(all) : all;
    return pool
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
  getRecentTracks(limit = 100, options = { activeOnly: true }) {
    const all = Object.values(this.data.tracks);
    const pool = options?.activeOnly !== false ? this._filterActive(all) : all;
    return pool
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

  // --- Music Folders (Granular Media Folders Manager) ---

  getMusicFolders() {
    return [...(this.data.settings.musicFolders || [])];
  }

  addMusicFolder(folderPath) {
    if (!folderPath || typeof folderPath !== 'string') return null;
    let normalized = path.normalize(folderPath.trim());
    if (normalized.length > 1) normalized = normalized.replace(/[/\\]+$/, '');

    if (!Array.isArray(this.data.settings.musicFolders)) {
      this.data.settings.musicFolders = [];
    }

    const existing = this.data.settings.musicFolders.find(f => {
      let p = path.normalize(f.path);
      if (p.length > 1) p = p.replace(/[/\\]+$/, '');
      return p === normalized;
    });

    if (existing) {
      existing.enabled = true;
      this._syncLibraryFolders();
      this.save();
      return existing;
    }

    const id = 'fld_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
    const newFolder = {
      id,
      path: normalized,
      enabled: true,
      trackCount: 0,
      lastScanned: null
    };

    this.data.settings.musicFolders.push(newFolder);
    this._syncLibraryFolders();
    this.save();
    return newFolder;
  }

  removeMusicFolder(folderIdOrPath) {
    if (!folderIdOrPath) return this.getMusicFolders();
    const folders = this.data.settings.musicFolders || [];
    let normTarget = typeof folderIdOrPath === 'string' ? path.normalize(folderIdOrPath.trim()) : '';
    if (normTarget.length > 1) normTarget = normTarget.replace(/[/\\]+$/, '');

    const target = folders.find(f => {
      if (f.id === folderIdOrPath) return true;
      let p = path.normalize(f.path);
      if (p.length > 1) p = p.replace(/[/\\]+$/, '');
      return p === normTarget;
    });

    if (!target) return this.getMusicFolders();

    // 1. Remove from folders list
    this.data.settings.musicFolders = folders.filter(f => f.id !== target.id);
    this._syncLibraryFolders();

    // 2. Purge associated tracks from DB (without touching physical files on disk)
    this.purgeTracksByFolder(target.path);

    this.save();
    return this.getMusicFolders();
  }

  toggleMusicFolder(folderId, enabled) {
    if (!folderId) return null;
    const folders = this.data.settings.musicFolders || [];
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return null;

    folder.enabled = typeof enabled === 'boolean' ? enabled : !folder.enabled;
    this._syncLibraryFolders();
    this.save();
    return folder;
  }

  updateFolderStats(folderIdOrPath, { trackCount, lastScanned = Date.now() } = {}) {
    const folders = this.data.settings.musicFolders || [];
    const folder = folders.find(
      f => f.id === folderIdOrPath || path.normalize(f.path) === path.normalize(folderIdOrPath)
    );
    if (!folder) return null;

    if (typeof trackCount === 'number') folder.trackCount = Math.floor(trackCount);
    if (lastScanned) folder.lastScanned = lastScanned;
    this.save();
    return folder;
  }

  purgeTracksByFolder(folderPath) {
    if (!folderPath) return 0;
    let normFolder = path.normalize(folderPath).replace(/\\/g, '/');
    if (!normFolder.endsWith('/')) normFolder += '/';

    let purgedCount = 0;
    const purgedTrackIds = new Set();

    for (const [id, track] of Object.entries(this.data.tracks)) {
      const trackNorm = path.normalize(track.filePath || id).replace(/\\/g, '/');
      if (trackNorm.startsWith(normFolder)) {
        delete this.data.tracks[id];
        purgedTrackIds.add(id);
        purgedCount++;
      }
    }

    if (purgedCount > 0 && Array.isArray(this.data.playlists)) {
      for (const pl of this.data.playlists) {
        if (Array.isArray(pl.trackIds)) {
          pl.trackIds = pl.trackIds.filter(tid => !purgedTrackIds.has(tid));
        }
      }
    }

    return purgedCount;
  }

  _syncLibraryFolders() {
    this.data.settings.libraryFolders = (this.data.settings.musicFolders || [])
      .filter(f => f.enabled !== false)
      .map(f => f.path);
  }

  // --- Legacy Library Folders Compatibility ---

  addLibraryFolder(folderPath) {
    this.addMusicFolder(folderPath);
    return this.data.settings.libraryFolders;
  }

  removeLibraryFolder(folderPath) {
    this.removeMusicFolder(folderPath);
    return this.data.settings.libraryFolders;
  }
}

module.exports = StorageManager;
