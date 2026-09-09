/**
 * Main application frontend coordinator
 */
async function initApp() {
  // Initialize Managers
  const queueManager = new QueueManager();

  // Create a storage proxy that delegates to window.api
  const storageProxy = {
    getSettings: () => ({ crossfadeSeconds: 3, volume: 0.8 }),
    updateSettings: (s) => window.api.updateSettings(s),
    incrementPlayCount: (fp) => window.api.incrementPlayCount(fp)
  };

  const audioEngine = new AudioEngine(queueManager, storageProxy);

  // App Context to pass to child views
  const app = {
    audioEngine,
    queueManager,
    currentView: 'recent',
    views: {},
    favoritesSet: new Set(),

    isFavorite(filePath) {
      return this.favoritesSet.has(filePath);
    },

    syncFavorites(favsList) {
      this.favoritesSet = new Set(Array.isArray(favsList) ? favsList : []);
    },

    switchView(target) {
      this.currentView = target;
      const recentContainer = document.getElementById('view-recent-container');
      const playlistsContainer = document.getElementById('view-playlists-container');
      const playlistDetailContainer = document.getElementById('view-playlist-detail-container');

      if (target === 'recent') {
        if (recentContainer) recentContainer.style.display = 'flex';
        if (playlistsContainer) playlistsContainer.style.display = 'none';
        if (playlistDetailContainer) playlistDetailContainer.style.display = 'none';
        if (this.views.recent) this.views.recent.loadTracks();
      } else if (target === 'playlists') {
        if (recentContainer) recentContainer.style.display = 'none';
        if (playlistsContainer) playlistsContainer.style.display = 'flex';
        if (playlistDetailContainer) playlistDetailContainer.style.display = 'none';
        if (this.views.playlists) this.views.playlists.loadData();
      } else if (target === 'playlist-detail') {
        if (recentContainer) recentContainer.style.display = 'none';
        if (playlistsContainer) playlistsContainer.style.display = 'none';
        if (playlistDetailContainer) playlistDetailContainer.style.display = 'flex';
      }
    },

    async openPlaylist(playlist) {
      this.switchView('playlist-detail');
      if (this.views.playlistDetail) {
        await this.views.playlistDetail.loadPlaylist(playlist);
      }
    },

    async openLikedSongs() {
      this.switchView('playlist-detail');
      if (this.views.playlistDetail) {
        await this.views.playlistDetail.loadPlaylist({ id: 'liked', type: 'liked', name: 'Músicas Curtidas' });
      }
    },

    applyTheme(theme) {
      const root = document.documentElement;
      if (this._systemThemeListener) {
        this._systemThemeMatcher?.removeEventListener('change', this._systemThemeListener);
        this._systemThemeListener = null;
      }

      if (theme === 'light') {
        root.setAttribute('data-theme', 'light');
      } else if (theme === 'system') {
        this._systemThemeMatcher = window.matchMedia('(prefers-color-scheme: light)');
        const updateSys = (e) => {
          if (e.matches) {
            root.setAttribute('data-theme', 'light');
          } else {
            root.removeAttribute('data-theme');
          }
        };
        updateSys(this._systemThemeMatcher);
        this._systemThemeListener = updateSys;
        this._systemThemeMatcher.addEventListener('change', updateSys);
      } else {
        // default 'dark'
        root.removeAttribute('data-theme');
      }
    },

    applyAccentColor(hex) {
      if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return;
      const root = document.documentElement;
      root.style.setProperty('--accent', hex);
      root.style.setProperty('--accent-color', hex);

      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);

      const hoverHex = `rgb(${Math.max(0, Math.round(r * 0.85))}, ${Math.max(0, Math.round(g * 0.85))}, ${Math.max(0, Math.round(b * 0.85))})`;
      const subtleRgba = `rgba(${r}, ${g}, ${b}, 0.15)`;
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const contrastText = luminance > 0.6 ? '#090d16' : '#ffffff';

      root.style.setProperty('--accent-hover', hoverHex);
      root.style.setProperty('--accent-subtle', subtleRgba);
      root.style.setProperty('--accent-faded', subtleRgba);
      root.style.setProperty('--accent-contrast-text', contrastText);
    },

    applyBackground(imgPath, dim = 0.4) {
      const bgLayer = document.getElementById('app-bg-layer');
      const bgDimmer = document.getElementById('app-bg-dimmer');
      if (!bgLayer || !bgDimmer) return;

      if (imgPath) {
        document.body.classList.add('has-custom-bg');
        bgLayer.style.backgroundImage = `url("file://${imgPath}")`;
        bgDimmer.style.opacity = dim;
      } else {
        document.body.classList.remove('has-custom-bg');
        bgLayer.style.backgroundImage = 'none';
        bgDimmer.style.opacity = '0';
      }
    },

    showToast(message, duration = 3000) {
      const toast = document.getElementById('toast-notification');
      if (!toast) return;
      toast.textContent = message;
      toast.style.display = 'block';
      if (this._toastTimer) clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        toast.style.display = 'none';
      }, duration);
    },

    playTrackDirectly(track, trackList, startIndex = 0) {
      requestAnimationFrame(() => {
        queueManager.setQueue(trackList, startIndex);
        audioEngine.playTrack(track);
      });
    },

    setQueueAndPlay(trackList, startIndex = 0) {
      requestAnimationFrame(() => {
        queueManager.setQueue(trackList, startIndex);
        const track = queueManager.getCurrentTrack();
        if (track) audioEngine.playTrack(track);
      });
    },

    openPromptModal(title, initialValue, onConfirm) {
      const modal = document.getElementById('generic-modal');
      const modalTitle = document.getElementById('modal-title');
      const modalInput = document.getElementById('modal-input');
      const btnConfirm = document.getElementById('modal-btn-confirm');
      const btnCancel = document.getElementById('modal-btn-cancel');

      modalTitle.textContent = title;
      modalInput.value = initialValue || '';
      modal.classList.add('open');
      modalInput.focus();

      const cleanup = () => {
        modal.classList.remove('open');
        btnConfirm.onclick = null;
        btnCancel.onclick = null;
      };

      btnConfirm.onclick = () => {
        const val = modalInput.value.trim();
        cleanup();
        if (onConfirm) onConfirm(val);
      };

      btnCancel.onclick = () => {
        cleanup();
      };
    },

    openCreatePlaylistModal(onConfirm) {
      this.openPromptModal('Nova Playlist', '', onConfirm);
    },

    async openAddToPlaylistModal(track) {
      const modal = document.getElementById('playlist-picker-modal');
      const listEl = document.getElementById('playlist-picker-list');
      const btnClose = document.getElementById('playlist-picker-close');

      const playlists = await window.api.getPlaylists();
      if (!playlists || playlists.length === 0) {
        this.openCreatePlaylistModal(async (name) => {
          if (name) {
            const newPl = await window.api.createPlaylist(name);
            await window.api.addTrackToPlaylist(newPl.id, track.filePath);
            this.showToast(`Faixa adicionada à playlist "${name}"!`);
          }
        });
        return;
      }

      listEl.innerHTML = playlists.map(p => `
        <div class="playlist-item" data-id="${p.id}" style="cursor: pointer; padding: 10px;">
          <strong>${p.name}</strong>
          <span style="font-size: 0.78rem; color: var(--text-muted); margin-left: 8px;">(${p.trackIds?.length || 0} faixas)</span>
        </div>
      `).join('');

      modal.classList.add('open');

      const cleanup = () => {
        modal.classList.remove('open');
        btnClose.onclick = null;
      };

      btnClose.onclick = cleanup;

      listEl.querySelectorAll('.playlist-item').forEach(item => {
        item.onclick = async () => {
          const plId = item.dataset.id;
          const pl = playlists.find(p => p.id === plId);
          await window.api.addTrackToPlaylist(plId, track.filePath);
          cleanup();
          this.showToast(`Adicionada à playlist "${pl.name}"!`);
          if (this.currentView === 'playlists' && this.views.playlists) {
            this.views.playlists.loadPlaylists();
          }
        };
      });
    }
  };

  // Sync settings and favorites from main process
  try {
    const [remoteSettings, favs] = await Promise.all([
      window.api.getSettings(),
      window.api.getFavorites()
    ]);

    if (favs) {
      app.syncFavorites(favs);
    }

    if (remoteSettings) {
      storageProxy.getSettings = () => remoteSettings;
      if (remoteSettings.repeatMode) {
        queueManager.setRepeatMode(remoteSettings.repeatMode);
      }
      if (typeof remoteSettings.shuffle === 'boolean') {
        queueManager.setShuffle(remoteSettings.shuffle);
      }
      if (typeof remoteSettings.crossfadeSeconds === 'number') {
        audioEngine.setCrossfade(remoteSettings.crossfadeSeconds);
      }
      if (typeof remoteSettings.volume === 'number') {
        audioEngine.setVolume(remoteSettings.volume);
      }
      if (remoteSettings.theme) {
        app.applyTheme(remoteSettings.theme);
      }
      if (remoteSettings.accentColor) {
        app.applyAccentColor(remoteSettings.accentColor);
      }
      if (remoteSettings.backgroundImage) {
        app.applyBackground(remoteSettings.backgroundImage, remoteSettings.backgroundDim ?? 0.4);
      }
      if (remoteSettings.audioOutputSinkId) {
        audioEngine.setSinkId(remoteSettings.audioOutputSinkId).catch(err => {
          console.warn('[Renderer] Failed to set initial audio sink:', err);
        });
      }
    }
  } catch (err) {
    console.warn('[Renderer] Failed to load remote settings/favorites:', err);
  }

  // Mount Views defensively
  const topHeaderContainer = document.getElementById('top-header-container');
  const libraryRailContainer = document.getElementById('sidebar-rail-container');
  const sidebarRightContainer = document.getElementById('sidebar-right-container');
  const recentViewContainer = document.getElementById('view-recent-container');
  const playlistsViewContainer = document.getElementById('view-playlists-container');
  const playlistDetailContainer = document.getElementById('view-playlist-detail-container');
  const queueDrawerContainer = document.getElementById('queue-drawer-container');
  const lyricsDrawerContainer = document.getElementById('lyrics-drawer-container');
  const nowPlayingContainer = document.getElementById('now-playing-container');
  const settingsModalContainer = document.getElementById('settings-modal-container');
  const playerBarContainer = document.getElementById('player-bar');

  let topHeader = null;
  let libraryRail = null;
  let sidebarRight = null;
  let homeRecentView = null;
  let playlistsRankView = null;
  let playlistDetailView = null;
  let queueView = null;
  let lyricsView = null;
  let nowPlayingView = null;
  let settingsModal = null;
  let playerBar = null;

  try {
    homeRecentView = new HomeRecentView(app);
    app.views.recent = homeRecentView;
    if (recentViewContainer) homeRecentView.mount(recentViewContainer);
  } catch (e) {
    console.error('[Renderer] Error mounting HomeRecentView:', e);
  }

  try {
    playlistsRankView = new PlaylistsRankView(app);
    app.views.playlists = playlistsRankView;
    if (playlistsViewContainer) playlistsRankView.mount(playlistsViewContainer);
  } catch (e) {
    console.error('[Renderer] Error mounting PlaylistsRankView:', e);
  }

  try {
    playlistDetailView = new PlaylistDetailView(app);
    app.views.playlistDetail = playlistDetailView;
    if (playlistDetailContainer) playlistDetailView.mount(playlistDetailContainer);
  } catch (e) {
    console.error('[Renderer] Error mounting PlaylistDetailView:', e);
  }

  try {
    queueView = new QueueView(app);
    app.views.queue = queueView;
    if (queueDrawerContainer) queueView.mount(queueDrawerContainer);
  } catch (e) {
    console.error('[Renderer] Error mounting QueueView:', e);
  }

  try {
    lyricsView = new LyricsView(app);
    app.views.lyrics = lyricsView;
    if (lyricsDrawerContainer) lyricsView.mount(lyricsDrawerContainer);
  } catch (e) {
    console.error('[Renderer] Error mounting LyricsView:', e);
  }

  try {
    nowPlayingView = new NowPlayingView(app);
    app.views.nowPlaying = nowPlayingView;
    if (nowPlayingContainer) nowPlayingView.mount(nowPlayingContainer);
  } catch (e) {
    console.error('[Renderer] Error mounting NowPlayingView:', e);
  }

  try {
    settingsModal = new SettingsModal(app);
    app.views.settings = settingsModal;
    if (settingsModalContainer) settingsModal.mount(settingsModalContainer);
  } catch (e) {
    console.error('[Renderer] Error mounting SettingsModal:', e);
  }

  try {
    topHeader = new TopHeader(app, {
      onSearch: (term) => {
        if (app.currentView !== 'recent') {
          app.switchView('recent');
        }
        homeRecentView?.setSearchTerm(term);
      },
      onHomeClick: () => {
        app.switchView('recent');
        homeRecentView?.setSearchTerm('');
        homeRecentView?.setActiveFilter('all');
      },
      onBrowseFolder: async () => {
        const folder = await window.api.openFolderDialog();
        if (folder) {
          app.showToast('Escaneando pasta de músicas...');
          await window.api.addLibraryFolder(folder);
          const audioFiles = await window.api.scanFolder(folder);
          if (audioFiles.length > 0) {
            app.showToast(`Importando ${audioFiles.length} faixas...`);
            await window.api.parseMetadataBatch(audioFiles);
            app.showToast('Faixas adicionadas à biblioteca!');
            await homeRecentView?.loadTracks();
          }
        }
      },
      onOpenSettings: () => {
        settingsModal?.open();
      }
    });
    app.views.topHeader = topHeader;
    if (topHeaderContainer) topHeader.mount(topHeaderContainer);
  } catch (e) {
    console.error('[Renderer] Error mounting TopHeader:', e);
  }

  try {
    libraryRail = new LibraryRail(app, {
      onSelectLikedSongs: () => {
        app.openLikedSongs();
      },
      onSelectPlaylist: (playlistId) => {
        const pl = libraryRail?.playlists?.find(p => p.id === playlistId);
        if (pl) {
          app.openPlaylist(pl);
        } else {
          app.switchView('playlists');
          playlistsRankView?.selectPlaylist(playlistId);
        }
      },
      onCreatePlaylist: () => {
        app.openCreatePlaylistModal(async (name) => {
          if (name) {
            const newPl = await window.api.createPlaylist(name);
            app.showToast(`Playlist "${newPl.name}" criada!`);
            libraryRail?.loadPlaylists();
            if (app.currentView === 'playlists') {
              playlistsRankView?.loadPlaylists();
            }
          }
        });
      }
    });
    app.views.libraryRail = libraryRail;
    if (libraryRailContainer) libraryRail.mount(libraryRailContainer);
  } catch (e) {
    console.error('[Renderer] Error mounting LibraryRail:', e);
  }

  try {
    sidebarRight = new SidebarRight(app, audioEngine, queueManager, {
      onFilterByArtist: (artistName) => {
        app.switchView('recent');
        topHeader?.setSearchTerm(artistName);
        homeRecentView?.setSearchTerm(artistName);
      },
      onToggleFavorite: async (track) => {
        if (!track?.filePath) return;
        const isFav = app.isFavorite(track.filePath);
        if (isFav) {
          await window.api.removeFavorite(track.filePath);
          app.favoritesSet.delete(track.filePath);
        } else {
          await window.api.addFavorite(track.filePath);
          app.favoritesSet.add(track.filePath);
        }
        sidebarRight?.updateFavoriteState();
        playerBar?.updateFavoriteState();
        updateAllTrackLists();
      }
    });
    app.views.sidebarRight = sidebarRight;
    if (sidebarRightContainer) sidebarRight.mount(sidebarRightContainer);
  } catch (e) {
    console.error('[Renderer] Error mounting SidebarRight:', e);
  }

  try {
    playerBar = new PlayerBar(audioEngine, queueManager, {
      onToggleQueue: () => queueView?.toggle(),
      onToggleLyrics: () => lyricsView?.toggle(),
      onOpenNowPlaying: () => nowPlayingView?.open(),
      onOpenSettings: () => settingsModal?.open(),
      onToggleRightSidebar: () => sidebarRight?.toggle(),
      onToggleFavorite: async () => {
        const track = queueManager.getCurrentTrack();
        if (!track?.filePath) return;
        const isFav = app.isFavorite(track.filePath);
        if (isFav) {
          await window.api.removeFavorite(track.filePath);
          app.favoritesSet.delete(track.filePath);
        } else {
          await window.api.addFavorite(track.filePath);
          app.favoritesSet.add(track.filePath);
        }
        playerBar?.updateFavoriteState();
        sidebarRight?.updateFavoriteState();
        updateAllTrackLists();
      }
    });
    app.views.playerBar = playerBar;
    if (playerBarContainer) playerBar.mount(playerBarContainer);
  } catch (e) {
    console.error('[Renderer] Error mounting PlayerBar:', e);
  }

  // Settings button in sidebar (fallback)
  const navBtnSettings = document.getElementById('nav-btn-settings');
  if (navBtnSettings) {
    navBtnSettings.addEventListener('click', () => {
      if (settingsModal) {
        settingsModal.open();
      }
    });
  }

  // Navigation menu handling (fallback)
  const navItems = document.querySelectorAll('.nav-menu .nav-item[data-target]');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      app.switchView(item.dataset.target);
    });
  });

  // When play_count updates at 50% threshold, reload Top Tracks ranking if viewing it
  audioEngine.on('trackPlayedHalf', () => {
    if (app.currentView === 'playlists' && playlistsRankView) {
      playlistsRankView.loadTopTracks();
    }
  });

  // Synchronize playing equalizer animation and paused state across views
  const updateAllTrackLists = () => {
    if (homeRecentView?.trackList?.updatePlayingState) {
      homeRecentView.trackList.updatePlayingState();
    }
    if (playlistsRankView?.trackList?.updatePlayingState) {
      playlistsRankView.trackList.updatePlayingState();
    }
    if (playlistDetailView?.updatePlayingState) {
      playlistDetailView.updatePlayingState();
    }
  };

  queueManager.on('currentTrackChanged', (track) => {
    updateAllTrackLists();
    sidebarRight?.updateTrack(track);
    playerBar?.updateFavoriteState();
  });

  audioEngine.on('stateChange', ({ isPlaying }) => {
    document.querySelectorAll('.track-row.playing, .spotify-track-row.playing').forEach(row => {
      if (isPlaying) {
        row.classList.remove('paused');
      } else {
        row.classList.add('paused');
      }
    });
    if (playlistDetailView?.updatePlayingState) {
      playlistDetailView.updatePlayingState();
    }
  });

  // Save settings when mode changes
  queueManager.on('modeChanged', ({ repeatMode, shuffle }) => {
    window.api?.updateSettings({ repeatMode, shuffle });
  });

  console.log('[JustPlay] App initialized successfully.');
}

// Ensure startup triggers regardless of document readyState
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
