const { app, BrowserWindow, Menu, ipcMain, dialog, protocol, net, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const StorageManager = require('../db/storage');
const { parseAudioMetadata, findAdjacentLrc, parseLrc } = require('../metadata/tags');

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.ogg', '.m4a']);

let mainWindow = null;
let storage = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1150,
    height: 760,
    minWidth: 920,
    minHeight: 600,
    backgroundColor: '#090d16',
    title: 'JustPlay - Offline Music Player',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false // Allows playing local audio files directly
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, '../ui/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Ensure single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    storage = new StorageManager();
    registerIpcHandlers();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function registerIpcHandlers() {
  // Dialogs
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Selecionar Pasta de Músicas'
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle('dialog:openFiles', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Arquivos de Áudio', extensions: ['mp3', 'flac', 'wav', 'ogg', 'm4a'] }
      ],
      title: 'Selecionar Arquivos de Áudio'
    });
    if (result.canceled || result.filePaths.length === 0) {
      return [];
    }
    return result.filePaths;
  });

  // Folder Scanning
  ipcMain.handle('fs:scanFolder', async (_, folderPath) => {
    if (!folderPath || !fs.existsSync(folderPath)) return [];

    const audioFiles = [];
    const queue = [folderPath];

    while (queue.length > 0) {
      const currentDir = queue.shift();
      try {
        const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          if (entry.isDirectory()) {
            // Skip hidden directories
            if (!entry.name.startsWith('.')) {
              queue.push(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (AUDIO_EXTENSIONS.has(ext)) {
              audioFiles.push(fullPath);
            }
          }
        }
      } catch (err) {
        console.warn(`[Scanner] Error reading directory ${currentDir}:`, err.message);
      }
    }

    return audioFiles;
  });

  // Metadata Parsing
  ipcMain.handle('metadata:parse', async (_, filePath) => {
    return await parseAudioMetadata(filePath);
  });

  ipcMain.handle('metadata:parseBatch', async (_, filePaths) => {
    if (!Array.isArray(filePaths)) return [];
    const parsedTracks = [];
    const chunkSize = 8; // Process in chunks to avoid memory bottlenecks

    for (let i = 0; i < filePaths.length; i += chunkSize) {
      const chunk = filePaths.slice(i, i + chunkSize);
      const results = await Promise.all(
        chunk.map(async (fp) => {
          try {
            return await parseAudioMetadata(fp);
          } catch (e) {
            return {
              filePath: fp,
              title: path.parse(fp).name,
              artist: 'Artista Desconhecido',
              album: 'Álbum Desconhecido',
              duration: 0,
              coverDataUrl: null,
              lyrics: null
            };
          }
        })
      );
      parsedTracks.push(...results);
    }

    // Persist parsed tracks in DB
    storage.upsertTracksBatch(parsedTracks);
    return parsedTracks;
  });

  ipcMain.handle('metadata:getLyrics', async (_, filePath) => {
    const adjacentLrc = findAdjacentLrc(filePath);
    if (adjacentLrc) {
      return parseLrc(adjacentLrc);
    }
    const meta = await parseAudioMetadata(filePath);
    return meta.lyrics;
  });

  // DB / Storage Operations
  ipcMain.handle('db:getTracks', () => storage.getAllTracks());
  ipcMain.handle('db:getTopTracks', (_, limit) => storage.getTopTracks(limit));
  ipcMain.handle('db:getRecentTracks', (_, limit) => storage.getRecentTracks(limit));
  ipcMain.handle('db:upsertTrack', (_, track) => storage.upsertTrack(track));
  ipcMain.handle('db:upsertTracksBatch', (_, tracks) => storage.upsertTracksBatch(tracks));
  ipcMain.handle('db:incrementPlayCount', (_, filePath) => storage.incrementPlayCount(filePath));

  // Playlists
  ipcMain.handle('db:getPlaylists', (_, sortBy) => storage.getPlaylists(sortBy));
  ipcMain.handle('db:getPlaylistTracks', (_, playlistId) => storage.getPlaylistTracks(playlistId));
  ipcMain.handle('db:createPlaylist', (_, name) => storage.createPlaylist(name));
  ipcMain.handle('db:renamePlaylist', (_, id, newName) => storage.renamePlaylist(id, newName));
  ipcMain.handle('db:deletePlaylist', (_, id) => storage.deletePlaylist(id));
  ipcMain.handle('db:addTrackToPlaylist', (_, playlistId, trackPath) => storage.addTrackToPlaylist(playlistId, trackPath));
  ipcMain.handle('db:removeTrackFromPlaylist', (_, playlistId, index) => storage.removeTrackFromPlaylist(playlistId, index));
  ipcMain.handle('db:reorderPlaylistTracks', (_, playlistId, newTrackIds) => storage.reorderPlaylistTracks(playlistId, newTrackIds));
  ipcMain.handle('db:reorderPlaylists', (_, newOrderIds) => storage.reorderPlaylists(newOrderIds));

  // Settings
  ipcMain.handle('db:getSettings', () => storage.getSettings());
  ipcMain.handle('db:updateSettings', (_, newSettings) => storage.updateSettings(newSettings));

  // Image Dialog & Shell reveal
  ipcMain.handle('dialog:openImage', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Imagens', extensions: ['jpg', 'jpeg', 'png', 'webp'] }
      ],
      title: 'Selecionar Imagem de Plano de Fundo'
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle('shell:showItemInFolder', (_, filePath) => {
    if (filePath && fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
      return true;
    }
    return false;
  });

  // Favorites & Library Folders
  ipcMain.handle('db:toggleFavorite', (_, filePath) => storage.toggleFavorite(filePath));
  ipcMain.handle('db:getFavorites', () => storage.getFavorites());
  ipcMain.handle('db:addLibraryFolder', (_, folderPath) => storage.addLibraryFolder(folderPath));
  ipcMain.handle('db:removeLibraryFolder', (_, folderPath) => storage.removeLibraryFolder(folderPath));

  // Window Controls
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
}
