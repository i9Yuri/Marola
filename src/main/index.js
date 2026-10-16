const { app, BrowserWindow, Menu, ipcMain, dialog, protocol, net, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const StorageManager = require('../db/storage');
const LibraryScanner = require('../services/libraryScanner');
const { parseAudioMetadata, findAdjacentLrc, parseLrc } = require('../metadata/tags');

const AUDIO_EXTENSIONS = LibraryScanner.AUDIO_EXTENSIONS;

let mainWindow = null;
let storage = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1150,
    height: 760,
    minWidth: 920,
    minHeight: 600,
    backgroundColor: '#090d16',
    title: 'Marola - Player de Música Offline',
    autoHideMenuBar: true,
    frame: false, // Frameless nativo para eliminar barra dupla no Linux
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false // Allows playing local audio files directly
    }
  });

  mainWindow.setMenuBarVisibility(false);

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer Console ${level}] ${message} at ${sourceId}:${line}`);
  });

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
      properties: ['openDirectory', 'dontAddToRecent'],
      title: 'Selecionar Pasta de Músicas'
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true, filePaths: [] };
    }
    const selected = path.normalize(path.resolve(result.filePaths[0]));
    try {
      await fs.promises.access(selected, fs.constants.R_OK);
      return { canceled: false, filePaths: [selected], folderPath: selected };
    } catch (e) {
      if (fs.existsSync(selected)) {
        return { canceled: false, filePaths: [selected], folderPath: selected };
      }
      console.warn('[Main] Selected folder does not have read permissions or does not exist:', selected);
      return { canceled: false, filePaths: [], folderPath: selected, error: 'Sem permissão de leitura' };
    }
  });

  ipcMain.handle('dialog:select-music-folder', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory', 'dontAddToRecent'],
        title: 'Selecionar Pasta de Músicas'
      });
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { canceled: true };
      }
      const selected = path.normalize(path.resolve(result.filePaths[0]));
      try {
        await fs.promises.access(selected, fs.constants.R_OK);
        return { canceled: false, folderPath: selected };
      } catch (e) {
        if (!fs.existsSync(selected)) {
          return { canceled: false, error: 'O diretório selecionado não existe.', folderPath: selected };
        }
        return { canceled: false, error: 'EACCES: Sem permissão de leitura para o diretório selecionado.', folderPath: selected };
      }
    } catch (err) {
      return { canceled: false, error: err.message };
    }
  });

  ipcMain.handle('dialog:openFiles', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Arquivos de Áudio', extensions: ['mp3', 'flac', 'wav', 'ogg', 'opus', 'm4a', 'aac'] }
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
    if (!folderPath) return [];
    try {
      return await LibraryScanner.scanDirectory(folderPath, fs);
    } catch (err) {
      console.warn(`[Main] Error scanning folder ${folderPath}:`, err);
      return [];
    }
  });

  // Orchestrated Recursive Music Directory Scanner with progress & batch DB storage
  ipcMain.handle('fs:scanMusicDirectory', async (_, folderPath) => {
    if (!folderPath) {
      return { success: false, count: 0, error: 'Caminho do diretório não informado' };
    }
    try {
      await fs.promises.access(folderPath, fs.constants.R_OK);
    } catch (err) {
      return { success: false, count: 0, error: `EACCES: Sem permissão de leitura em ${folderPath}` };
    }

    try {
      const audioFiles = await LibraryScanner.scanDirectory(folderPath, fs);
      if (!audioFiles || audioFiles.length === 0) {
        return { success: true, count: 0 };
      }

      const chunkSize = 16;
      let totalParsed = 0;
      for (let i = 0; i < audioFiles.length; i += chunkSize) {
        const chunk = audioFiles.slice(i, i + chunkSize);
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
        storage.upsertTracksBatch(results);
        totalParsed += results.length;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('scan:progress', { current: totalParsed, total: audioFiles.length });
        }
      }

      storage.addMusicFolder(folderPath);
      storage.updateFolderStats(folderPath, { trackCount: audioFiles.length, lastScanned: Date.now() });

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('scan:completed', { totalAdded: audioFiles.length });
      }

      return { success: true, count: audioFiles.length, folderPath };
    } catch (err) {
      console.warn(`[Main] Error in scanMusicDirectory ${folderPath}:`, err);
      return { success: false, count: 0, error: err.message };
    }
  });

  // Metadata Parsing
  ipcMain.handle('metadata:parse', async (_, filePath) => {
    return await parseAudioMetadata(filePath);
  });

  ipcMain.handle('metadata:parseBatch', async (_, filePaths) => {
    if (!Array.isArray(filePaths)) return [];
    const parsedTracks = [];
    const chunkSize = 16; // Process in chunks to maintain low memory pressure

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
      // Persist each chunk incrementally to prevent data loss on massive imports
      storage.upsertTracksBatch(results);
      parsedTracks.push(...results);
    }

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
  ipcMain.handle('db:getTopArtistsByTrackCount', (_, limit) => storage.getTopArtistsByTrackCount(limit));
  ipcMain.handle('db:getTopAlbumsByTrackCount', (_, limit) => storage.getTopAlbumsByTrackCount(limit));
  ipcMain.handle('db:upsertTrack', (_, track) => storage.upsertTrack(track));
  ipcMain.handle('db:upsertTracksBatch', (_, tracks) => storage.upsertTracksBatch(tracks));
  ipcMain.handle('db:incrementPlayCount', (_, filePath) => storage.incrementPlayCount(filePath));
  ipcMain.handle('db:getArtistStats', (_, artist) => storage.getArtistStats(artist));

  // Playlists
  ipcMain.handle('db:getPlaylists', (_, sortBy) => storage.getPlaylists(sortBy, true));
  ipcMain.handle('db:getPlaylistTracks', (_, playlistId) => storage.getPlaylistTracks(playlistId));
  ipcMain.handle('db:getTop100Playlist', () => storage.getTop100Playlist());
  ipcMain.handle('db:getAlbumsCatalog', () => storage.getAlbumsCatalog());
  ipcMain.handle('db:getArtistsCatalog', () => storage.getArtistsCatalog());
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

  // Granular Music Folders Manager
  ipcMain.handle('folders:getAll', () => storage.getMusicFolders());
  ipcMain.handle('folders:add', async (_, folderPath) => {
    if (!folderPath) return null;
    const normalized = path.normalize(path.resolve(folderPath));
    try {
      await fs.promises.access(normalized, fs.constants.R_OK);
    } catch (err) {
      console.warn('[Main] Cannot add folder without read permissions:', normalized);
      return null;
    }
    return storage.addMusicFolder(normalized);
  });
  ipcMain.handle('folders:remove', (_, folderId) => storage.removeMusicFolder(folderId));
  ipcMain.handle('folders:toggle', (_, folderId, enabled) => storage.toggleMusicFolder(folderId, enabled));
  ipcMain.handle('folders:updateStats', (_, folderId, stats) => storage.updateFolderStats(folderId, stats));
  ipcMain.handle('folders:scanAll', async () => {
    const folders = storage.getMusicFolders().filter(f => f.enabled !== false);
    let totalFound = 0;
    for (const f of folders) {
      try {
        const audioFiles = await LibraryScanner.scanDirectory(f.path, fs);
        if (audioFiles.length > 0) {
          const chunkSize = 8;
          const parsedTracks = [];
          for (let i = 0; i < audioFiles.length; i += chunkSize) {
            const chunk = audioFiles.slice(i, i + chunkSize);
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
          storage.upsertTracksBatch(parsedTracks);
          totalFound += audioFiles.length;
        }
        storage.updateFolderStats(f.id, { trackCount: audioFiles.length, lastScanned: Date.now() });
      } catch (err) {
        console.warn(`[Main] Error scanning folder ${f.path}:`, err);
      }
    }
    return { totalFound, folders: storage.getMusicFolders() };
  });

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
  ipcMain.handle('window:isMaximized', () => !!mainWindow?.isMaximized());
  ipcMain.handle('window:action', (_, action) => {
    if (!mainWindow) return;
    if (action === 'minimize') mainWindow.minimize();
    else if (action === 'maximize') {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
    } else if (action === 'close') {
      mainWindow.close();
    }
  });
}
