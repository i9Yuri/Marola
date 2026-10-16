const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Dialogs
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),
  openFilesDialog: () => ipcRenderer.invoke('dialog:openFiles'),

  // File scanning & Metadata
  scanFolder: (folderPath) => ipcRenderer.invoke('fs:scanFolder', folderPath),
  parseMetadata: (filePath) => ipcRenderer.invoke('metadata:parse', filePath),
  parseMetadataBatch: (filePaths) => ipcRenderer.invoke('metadata:parseBatch', filePaths),
  getLyrics: (filePath) => ipcRenderer.invoke('metadata:getLyrics', filePath),

  // Database / Storage
  getTracks: () => ipcRenderer.invoke('db:getTracks'),
  getTopTracks: (limit) => ipcRenderer.invoke('db:getTopTracks', limit),
  getRecentTracks: (limit) => ipcRenderer.invoke('db:getRecentTracks', limit),
  upsertTrack: (track) => ipcRenderer.invoke('db:upsertTrack', track),
  upsertTracksBatch: (tracks) => ipcRenderer.invoke('db:upsertTracksBatch', tracks),
  incrementPlayCount: (filePath) => ipcRenderer.invoke('db:incrementPlayCount', filePath),
  getArtistStats: (artist) => ipcRenderer.invoke('db:getArtistStats', artist),
  getTopArtistsByTrackCount: (limit) => ipcRenderer.invoke('db:getTopArtistsByTrackCount', limit),
  getTopAlbumsByTrackCount: (limit) => ipcRenderer.invoke('db:getTopAlbumsByTrackCount', limit),

  // Playlists
  getPlaylists: (sortBy) => ipcRenderer.invoke('db:getPlaylists', sortBy),
  getPlaylistTracks: (playlistId) => ipcRenderer.invoke('db:getPlaylistTracks', playlistId),
  createPlaylist: (name) => ipcRenderer.invoke('db:createPlaylist', name),
  renamePlaylist: (id, newName) => ipcRenderer.invoke('db:renamePlaylist', id, newName),
  deletePlaylist: (id) => ipcRenderer.invoke('db:deletePlaylist', id),
  addTrackToPlaylist: (playlistId, trackPath) => ipcRenderer.invoke('db:addTrackToPlaylist', playlistId, trackPath),
  removeTrackFromPlaylist: (playlistId, index) => ipcRenderer.invoke('db:removeTrackFromPlaylist', playlistId, index),
  reorderPlaylistTracks: (playlistId, newTrackIds) => ipcRenderer.invoke('db:reorderPlaylistTracks', playlistId, newTrackIds),
  reorderPlaylists: (newOrderIds) => ipcRenderer.invoke('db:reorderPlaylists', newOrderIds),

  // Settings
  getSettings: () => ipcRenderer.invoke('db:getSettings'),
  updateSettings: (settings) => ipcRenderer.invoke('db:updateSettings', settings),

  // Image Dialog & Shell reveal
  openImageDialog: () => ipcRenderer.invoke('dialog:openImage'),
  showItemInFolder: (filePath) => ipcRenderer.invoke('shell:showItemInFolder', filePath),

  // Favorites & Library Folders
  toggleFavorite: (filePath) => ipcRenderer.invoke('db:toggleFavorite', filePath),
  getFavorites: () => ipcRenderer.invoke('db:getFavorites'),
  addLibraryFolder: (folderPath) => ipcRenderer.invoke('db:addLibraryFolder', folderPath),
  removeLibraryFolder: (folderPath) => ipcRenderer.invoke('db:removeLibraryFolder', folderPath),

  // Granular Music Folders Manager
  selectMusicFolder: () => ipcRenderer.invoke('dialog:select-music-folder'),
  scanMusicDirectory: (folderPath) => ipcRenderer.invoke('fs:scanMusicDirectory', folderPath),
  onScanProgress: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_, payload) => callback(payload);
    ipcRenderer.on('scan:progress', handler);
    return () => ipcRenderer.removeListener('scan:progress', handler);
  },
  onScanCompleted: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_, payload) => callback(payload);
    ipcRenderer.on('scan:completed', handler);
    return () => ipcRenderer.removeListener('scan:completed', handler);
  },
  getMusicFolders: () => ipcRenderer.invoke('folders:getAll'),
  addMusicFolder: (folderPath) => ipcRenderer.invoke('folders:add', folderPath),
  removeMusicFolder: (folderId) => ipcRenderer.invoke('folders:remove', folderId),
  toggleMusicFolder: (folderId, enabled) => ipcRenderer.invoke('folders:toggle', folderId, enabled),
  scanAllFolders: () => ipcRenderer.invoke('folders:scanAll'),

  // Window Controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close')
});
