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

  // Window Controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close')
});
