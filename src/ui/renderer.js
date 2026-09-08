/**
 * Main application frontend coordinator
 */
document.addEventListener('DOMContentLoaded', async () => {
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
      queueManager.setQueue(trackList, startIndex);
      audioEngine.playTrack(track);
    },

    setQueueAndPlay(trackList, startIndex = 0) {
      queueManager.setQueue(trackList, startIndex);
      const track = queueManager.getCurrentTrack();
      if (track) audioEngine.playTrack(track);
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
      if (remoteSettings.backgroundImage) {
        app.applyBackground(remoteSettings.backgroundImage, remoteSettings.backgroundDim ?? 0.4);
      }
    }
  } catch (err) {
    console.warn('[Renderer] Failed to load remote settings/favorites:', err);
  }

  // Mount Views
  const recentViewContainer = document.getElementById('view-recent-container');
  const playlistsViewContainer = document.getElementById('view-playlists-container');
  const queueDrawerContainer = document.getElementById('queue-drawer-container');
  const lyricsDrawerContainer = document.getElementById('lyrics-drawer-container');
  const nowPlayingContainer = document.getElementById('now-playing-container');
  const settingsModalContainer = document.getElementById('settings-modal-container');
  const playerBarContainer = document.getElementById('player-bar');

  const homeRecentView = new HomeRecentView(app);
  const playlistsRankView = new PlaylistsRankView(app);
  const queueView = new QueueView(app);
  const lyricsView = new LyricsView(app);
  const nowPlayingView = new NowPlayingView(app);
  const settingsModal = new SettingsModal(app);

  app.views.recent = homeRecentView;
  app.views.playlists = playlistsRankView;
  app.views.queue = queueView;
  app.views.lyrics = lyricsView;
  app.views.nowPlaying = nowPlayingView;
  app.views.settings = settingsModal;

  homeRecentView.mount(recentViewContainer);
  playlistsRankView.mount(playlistsViewContainer);
  queueView.mount(queueDrawerContainer);
  lyricsView.mount(lyricsDrawerContainer);
  nowPlayingView.mount(nowPlayingContainer);
  settingsModal.mount(settingsModalContainer);

  const playerBar = new PlayerBar(audioEngine, queueManager, {
    onToggleQueue: () => queueView.toggle(),
    onToggleLyrics: () => lyricsView.toggle(),
    onOpenNowPlaying: () => nowPlayingView.open(),
    onOpenSettings: () => settingsModal.open()
  });
  playerBar.mount(playerBarContainer);

  // Settings button in sidebar
  const navBtnSettings = document.getElementById('nav-btn-settings');
  if (navBtnSettings) {
    navBtnSettings.addEventListener('click', () => {
      settingsModal.open();
    });
  }

  // Navigation menu handling
  const navItems = document.querySelectorAll('.nav-menu .nav-item[data-target]');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      const target = item.dataset.target;
      app.currentView = target;

      if (target === 'recent') {
        recentViewContainer.style.display = 'flex';
        playlistsViewContainer.style.display = 'none';
        homeRecentView.loadTracks();
      } else if (target === 'playlists') {
        recentViewContainer.style.display = 'none';
        playlistsViewContainer.style.display = 'flex';
        playlistsRankView.loadData();
      }
    });
  });

  // When play_count updates at 50% threshold, reload Top Tracks ranking if viewing it
  audioEngine.on('trackPlayedHalf', () => {
    if (app.currentView === 'playlists') {
      playlistsRankView.loadTopTracks();
    }
  });

  // Save settings when mode changes
  queueManager.on('modeChanged', ({ repeatMode, shuffle }) => {
    window.api.updateSettings({ repeatMode, shuffle });
  });
});
