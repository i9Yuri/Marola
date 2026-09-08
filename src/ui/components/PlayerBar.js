/**
 * PlayerBar component: manages bottom bar transport, scrubbing, volume and auxiliary toggles
 * in a trifurcated Spotify desktop layout.
 */
class PlayerBar {
  constructor(audioEngine, queueManager, options = {}) {
    this.audioEngine = audioEngine;
    this.queueManager = queueManager;
    this.onToggleQueue = options.onToggleQueue || (() => {});
    this.onToggleLyrics = options.onToggleLyrics || (() => {});
    this.onOpenNowPlaying = options.onOpenNowPlaying || (() => {});
    this.onToggleRightSidebar = options.onToggleRightSidebar || (() => {});
    this.onToggleFavorite = options.onToggleFavorite || (() => {});

    this.isDraggingSeek = false;
    this.dom = {};
  }

  mount(containerElement) {
    this.container = containerElement;
    this.container.innerHTML = `
      <!-- Left: Track info with favorite heart -->
      <div class="player-track-info-area">
        <div class="player-track-info clickable" id="player-track-info-trigger" title="Clique para detalhes da faixa">
          <div class="player-cover" id="player-cover">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
          </div>
          <div class="player-metadata">
            <span class="player-title" id="player-title">Nenhuma faixa selecionada</span>
            <span class="player-artist" id="player-artist">JustPlay Offline</span>
          </div>
        </div>
        <button class="btn-icon btn-player-fav" id="player-btn-fav" title="Curtir">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </button>
      </div>

      <!-- Center: Controls & Progress -->
      <div class="player-center">
        <div class="transport-controls">
          <button class="btn-icon" id="btn-shuffle" title="Aleatório">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
          </button>
          <button class="btn-icon" id="btn-prev" title="Anterior">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
          </button>
          <button class="play-btn" id="btn-play-pause" title="Reproduzir / Pausar">
            <svg id="icon-play" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
            <svg id="icon-pause" style="display:none;" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>
          </button>
          <button class="btn-icon" id="btn-next" title="Próxima">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
          </button>
          <button class="btn-icon" id="btn-repeat" title="Repetição">
            <svg id="icon-repeat-all" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
            <span id="label-repeat-one" style="display:none; font-size: 11px; font-weight: bold;">1</span>
          </button>
        </div>

        <div class="progress-container">
          <span class="time-stamp" id="time-current">0:00</span>
          <div class="slider-track" id="progress-bar">
            <div class="slider-fill" id="progress-fill" style="width: 0%;"></div>
          </div>
          <span class="time-stamp" id="time-duration">0:00</span>
        </div>
      </div>

      <!-- Right: Auxiliary tools (Lyrics, Queue, Artist Sidebar, Volume, Fullscreen) -->
      <div class="player-right">
        <button class="btn-icon" id="btn-lyrics" title="Letras">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="22"></line>
          </svg>
        </button>
        <button class="btn-icon" id="btn-queue" title="Fila de Reprodução">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
        </button>
        <button class="btn-icon" id="btn-toggle-right-sidebar" title="Visão Tocando Agora & Artista">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2"></rect>
            <path d="M15 3v18"></path>
          </svg>
        </button>

        <!-- Audio Output Sink Selector -->
        <div class="audio-sink-wrapper">
          <button class="btn-icon" id="btn-audio-sink" title="Dispositivo de saída de áudio">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
          </button>
          <div class="audio-sink-popover" id="audio-sink-popover">
            <div class="audio-sink-header">Dispositivo de Saída</div>
            <div class="audio-sink-list" id="audio-sink-list">
              <!-- Dynamically populated output devices -->
            </div>
          </div>
        </div>

        <div class="volume-control">
          <button class="btn-icon" id="btn-mute" title="Mudo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          </button>
          <input type="range" id="volume-slider" min="0" max="1" step="0.01" value="0.8" title="Volume">
        </div>

        <button class="btn-icon" id="btn-fullscreen" title="Modo Foco / Tela Cheia">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
        </button>
      </div>
    `;

    this._cacheDom();
    this._bindEvents();
    this._syncInitialState();
  }

  _cacheDom() {
    const q = (id) => (this.container?.querySelector ? this.container.querySelector('#' + id) : (typeof document !== 'undefined' ? document.getElementById(id) : null));
    this.dom = {
      trackInfoTrigger: q('player-track-info-trigger'),
      cover: q('player-cover'),
      title: q('player-title'),
      artist: q('player-artist'),
      btnFav: q('player-btn-fav'),
      btnPlayPause: q('btn-play-pause'),
      iconPlay: q('icon-play'),
      iconPause: q('icon-pause'),
      btnPrev: q('btn-prev'),
      btnNext: q('btn-next'),
      btnShuffle: q('btn-shuffle'),
      btnRepeat: q('btn-repeat'),
      iconRepeatAll: q('icon-repeat-all'),
      labelRepeatOne: q('label-repeat-one'),
      progressBar: q('progress-bar'),
      progressFill: q('progress-fill'),
      timeCurrent: q('time-current'),
      timeDuration: q('time-duration'),
      volumeSlider: q('volume-slider'),
      btnMute: q('btn-mute'),
      btnLyrics: q('btn-lyrics'),
      btnQueue: q('btn-queue'),
      btnRightSidebar: q('btn-toggle-right-sidebar'),
      btnFullscreen: q('btn-fullscreen'),
      btnAudioSink: q('btn-audio-sink'),
      audioSinkPopover: q('audio-sink-popover'),
      audioSinkList: q('audio-sink-list')
    };
  }

  _bindEvents() {
    this.dom.btnPlayPause?.addEventListener('click', () => this.audioEngine.togglePlayPause());
    this.dom.btnNext?.addEventListener('click', () => this.audioEngine.next());
    this.dom.btnPrev?.addEventListener('click', () => this.audioEngine.previous());

    this.dom.btnShuffle?.addEventListener('click', () => {
      const active = this.queueManager.toggleShuffle();
      this.dom.btnShuffle?.classList.toggle('active', active);
    });

    this.dom.btnRepeat?.addEventListener('click', () => {
      const mode = this.queueManager.toggleRepeatMode();
      this._updateRepeatUi(mode);
    });

    // Track info click triggers Right Sidebar toggle
    this.dom.trackInfoTrigger?.addEventListener('click', () => this.onToggleRightSidebar());

    // Favorite toggle button
    this.dom.btnFav?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onToggleFavorite();
    });

    // Auxiliary buttons
    this.dom.btnLyrics?.addEventListener('click', () => this.onToggleLyrics());
    this.dom.btnQueue?.addEventListener('click', () => this.onToggleQueue());
    this.dom.btnRightSidebar?.addEventListener('click', () => this.onToggleRightSidebar());
    this.dom.btnFullscreen?.addEventListener('click', () => this.onOpenNowPlaying());

    // Audio Output Sink selector
    this.dom.btnAudioSink?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleAudioSinkPopover();
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('click', (e) => {
        if (this.dom.audioSinkPopover && !e.target.closest?.('.audio-sink-wrapper')) {
          this.dom.audioSinkPopover.classList.remove('open');
        }
      });
    }

    // Volume slider
    this.dom.volumeSlider?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.audioEngine.setVolume(val);
    });

    this.dom.btnMute?.addEventListener('click', () => {
      if (this.audioEngine.volume > 0) {
        this.prevVolume = this.audioEngine.volume;
        this.audioEngine.setVolume(0);
        if (this.dom.volumeSlider) this.dom.volumeSlider.value = 0;
      } else {
        const restore = this.prevVolume || 0.8;
        this.audioEngine.setVolume(restore);
        if (this.dom.volumeSlider) this.dom.volumeSlider.value = restore;
      }
    });

    // Progress bar seeking
    const handleSeek = (e) => {
      if (!this.dom.progressBar) return;
      const rect = this.dom.progressBar.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const pct = clickX / rect.width;
      const active = this.audioEngine.getActiveDeck();
      if (active?.audio && !isNaN(active.audio.duration)) {
        const targetSec = pct * active.audio.duration;
        this.audioEngine.seek(targetSec);
        if (this.dom.progressFill) this.dom.progressFill.style.width = `${pct * 100}%`;
        if (this.dom.timeCurrent) this.dom.timeCurrent.textContent = this._formatTime(targetSec);
      }
    };

    this.dom.progressBar?.addEventListener('mousedown', (e) => {
      this.isDraggingSeek = true;
      handleSeek(e);
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', (e) => {
        if (this.isDraggingSeek) handleSeek(e);
      });

      window.addEventListener('mouseup', () => {
        this.isDraggingSeek = false;
      });
    }

    // Audio Engine Listeners
    this.audioEngine.on('stateChange', ({ isPlaying, volume }) => {
      if (this.dom.iconPlay) this.dom.iconPlay.style.display = isPlaying ? 'none' : 'block';
      if (this.dom.iconPause) this.dom.iconPause.style.display = isPlaying ? 'block' : 'none';
      if (this.dom.volumeSlider) this.dom.volumeSlider.value = volume;
    });

    this.audioEngine.on('timeupdate', ({ currentTime, duration, progress }) => {
      if (!this.isDraggingSeek) {
        if (this.dom.progressFill) this.dom.progressFill.style.width = `${(progress || 0) * 100}%`;
        if (this.dom.timeCurrent) this.dom.timeCurrent.textContent = this._formatTime(currentTime);
        if (this.dom.timeDuration) this.dom.timeDuration.textContent = this._formatTime(duration);
      }
    });

    this.audioEngine.on('trackChange', ({ track }) => {
      this._updateTrackDisplay(track);
    });
  }

  _syncInitialState() {
    if (this.dom.volumeSlider) {
      this.dom.volumeSlider.value = this.audioEngine.volume;
    }
    this._updateRepeatUi(this.queueManager.repeatMode);
    if (this.dom.btnShuffle) {
      this.dom.btnShuffle.classList.toggle('active', this.queueManager.shuffle);
    }
  }

  _updateTrackDisplay(track) {
    if (!this.dom.title) return;
    if (!track) {
      this.dom.title.textContent = 'Nenhuma faixa selecionada';
      if (this.dom.artist) this.dom.artist.textContent = 'JustPlay Offline';
      if (this.dom.cover) this.dom.cover.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
      return;
    }

    this.dom.title.textContent = track.title || 'Sem título';
    if (this.dom.artist) this.dom.artist.textContent = track.artist || 'Artista desconhecido';
    if (this.dom.cover) {
      this.dom.cover.innerHTML = track.coverDataUrl
        ? `<img src="${track.coverDataUrl}" alt="Capa" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;">`
        : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
    }
  }

  syncFavoriteState(isFav) {
    if (!this.dom.btnFav) return;
    const svg = this.dom.btnFav.querySelector('svg');
    if (isFav) {
      this.dom.btnFav.classList.add('active');
      if (svg) svg.setAttribute('fill', 'var(--accent-color)');
    } else {
      this.dom.btnFav.classList.remove('active');
      if (svg) svg.setAttribute('fill', 'none');
    }
  }

  _updateRepeatUi(mode) {
    if (!this.dom.btnRepeat) return;
    if (mode === 'repeat-one') {
      this.dom.btnRepeat.classList.add('active');
      if (this.dom.iconRepeatAll) this.dom.iconRepeatAll.style.display = 'none';
      if (this.dom.labelRepeatOne) this.dom.labelRepeatOne.style.display = 'inline';
    } else if (mode === 'repeat-all') {
      this.dom.btnRepeat.classList.add('active');
      if (this.dom.iconRepeatAll) this.dom.iconRepeatAll.style.display = 'inline';
      if (this.dom.labelRepeatOne) this.dom.labelRepeatOne.style.display = 'none';
    } else {
      this.dom.btnRepeat.classList.remove('active');
      if (this.dom.iconRepeatAll) this.dom.iconRepeatAll.style.display = 'inline';
      if (this.dom.labelRepeatOne) this.dom.labelRepeatOne.style.display = 'none';
    }
  }

  _formatTime(seconds) {
    if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  async _toggleAudioSinkPopover() {
    if (!this.dom.audioSinkPopover) return;
    const isOpen = this.dom.audioSinkPopover.classList.toggle('open');
    if (isOpen) {
      await this._populateAudioOutputs();
    }
  }

  async _populateAudioOutputs() {
    if (!this.dom.audioSinkList) return;
    this.dom.audioSinkList.innerHTML = '<div style="padding: 8px 10px; font-size: 0.78rem; color: var(--text-muted);">Buscando dispositivos...</div>';

    let devices = [];
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
        const all = await navigator.mediaDevices.enumerateDevices();
        devices = all.filter(d => d.kind === 'audiooutput');
      }
    } catch (err) {
      console.warn('[PlayerBar] Error enumerating audio devices:', err);
    }

    if (!devices || devices.length === 0) {
      devices = [{ deviceId: 'default', label: 'Saída Padrão do Sistema' }];
    }

    const activeId = this.audioEngine?.sinkId || 'default';

    let html = '';
    devices.forEach((dev, idx) => {
      const devId = dev.deviceId || 'default';
      const isAct = devId === activeId;
      const label = dev.label || `Dispositivo de Saída ${idx + 1}`;
      html += `
        <button class="audio-sink-item ${isAct ? 'active' : ''}" data-device-id="${devId}" title="${this._escapeHtml(label)}">
          <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 210px;">${this._escapeHtml(label)}</span>
          ${isAct ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>` : ''}
        </button>
      `;
    });

    this.dom.audioSinkList.innerHTML = html;

    this.dom.audioSinkList.querySelectorAll('.audio-sink-item').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.deviceId;
        if (this.audioEngine?.setSinkId) {
          await this.audioEngine.setSinkId(id);
        }
        if (typeof window !== 'undefined' && window.api?.updateSettings) {
          await window.api.updateSettings({ audioOutputSinkId: id });
        }
        this.dom.audioSinkPopover?.classList.remove('open');
      });
    });
  }

  _escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlayerBar;
}
