/**
 * PlayerBar component: manages bottom bar transport, scrubbing, volume and crossfade
 */
class PlayerBar {
  constructor(audioEngine, queueManager, options = {}) {
    this.audioEngine = audioEngine;
    this.queueManager = queueManager;
    this.onToggleQueue = options.onToggleQueue || (() => {});
    this.onToggleLyrics = options.onToggleLyrics || (() => {});

    this.isDraggingSeek = false;
    this.dom = {};
  }

  mount(containerElement) {
    containerElement.innerHTML = `
      <!-- Left: Track info -->
      <div class="player-track-info">
        <div class="player-cover" id="player-cover">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
        </div>
        <div class="player-metadata">
          <span class="player-title" id="player-title">Nenhuma faixa selecionada</span>
          <span class="player-artist" id="player-artist">JustPlay Offline</span>
        </div>
      </div>

      <!-- Center: Controls & Progress -->
      <div class="player-center">
        <div class="transport-controls">
          <button class="btn-icon" id="btn-shuffle" title="Aleatório">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
          </button>
          <button class="btn-icon" id="btn-prev" title="Anterior">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
          </button>
          <button class="play-btn" id="btn-play-pause" title="Reproduzir / Pausar">
            <svg id="icon-play" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            <svg id="icon-pause" style="display:none;" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
          </button>
          <button class="btn-icon" id="btn-next" title="Próxima">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
          </button>
          <button class="btn-icon" id="btn-repeat" title="Repetição">
            <svg id="icon-repeat-all" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
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

      <!-- Right: Crossfade, Volume & Drawers -->
      <div class="player-right">
        <div class="crossfade-control" title="Ajuste do tempo de transição (Crossfade)">
          <span id="crossfade-label">Fade: 3s</span>
          <input type="range" id="crossfade-slider" min="0" max="12" step="1" value="3">
        </div>

        <div class="volume-control">
          <button class="btn-icon" id="btn-mute" title="Mudo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          </button>
          <input type="range" id="volume-slider" min="0" max="1" step="0.01" value="0.8" title="Volume">
        </div>

        <button class="btn-icon" id="btn-lyrics" title="Letras">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        </button>
        <button class="btn-icon" id="btn-queue" title="Fila de Reprodução">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
        </button>
      </div>
    `;

    this._cacheDom();
    this._bindEvents();
    this._syncInitialState();
  }

  _cacheDom() {
    this.dom = {
      cover: document.getElementById('player-cover'),
      title: document.getElementById('player-title'),
      artist: document.getElementById('player-artist'),
      btnPlayPause: document.getElementById('btn-play-pause'),
      iconPlay: document.getElementById('icon-play'),
      iconPause: document.getElementById('icon-pause'),
      btnPrev: document.getElementById('btn-prev'),
      btnNext: document.getElementById('btn-next'),
      btnShuffle: document.getElementById('btn-shuffle'),
      btnRepeat: document.getElementById('btn-repeat'),
      iconRepeatAll: document.getElementById('icon-repeat-all'),
      labelRepeatOne: document.getElementById('label-repeat-one'),
      progressBar: document.getElementById('progress-bar'),
      progressFill: document.getElementById('progress-fill'),
      timeCurrent: document.getElementById('time-current'),
      timeDuration: document.getElementById('time-duration'),
      crossfadeSlider: document.getElementById('crossfade-slider'),
      crossfadeLabel: document.getElementById('crossfade-label'),
      volumeSlider: document.getElementById('volume-slider'),
      btnMute: document.getElementById('btn-mute'),
      btnLyrics: document.getElementById('btn-lyrics'),
      btnQueue: document.getElementById('btn-queue')
    };
  }

  _bindEvents() {
    this.dom.btnPlayPause.addEventListener('click', () => this.audioEngine.togglePlayPause());
    this.dom.btnNext.addEventListener('click', () => this.audioEngine.next());
    this.dom.btnPrev.addEventListener('click', () => this.audioEngine.previous());

    this.dom.btnShuffle.addEventListener('click', () => {
      const active = this.queueManager.toggleShuffle();
      this.dom.btnShuffle.classList.toggle('active', active);
    });

    this.dom.btnRepeat.addEventListener('click', () => {
      const mode = this.queueManager.toggleRepeatMode();
      this._updateRepeatUi(mode);
    });

    // Crossfade slider
    this.dom.crossfadeSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.dom.crossfadeLabel.textContent = `Fade: ${val}s`;
      this.audioEngine.setCrossfade(val);
    });

    // Volume slider
    this.dom.volumeSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.audioEngine.setVolume(val);
    });

    this.dom.btnMute.addEventListener('click', () => {
      if (this.audioEngine.volume > 0) {
        this.prevVolume = this.audioEngine.volume;
        this.audioEngine.setVolume(0);
        this.dom.volumeSlider.value = 0;
      } else {
        const restore = this.prevVolume || 0.8;
        this.audioEngine.setVolume(restore);
        this.dom.volumeSlider.value = restore;
      }
    });

    // Progress bar seeking
    const handleSeek = (e) => {
      const rect = this.dom.progressBar.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const pct = clickX / rect.width;
      const active = this.audioEngine.getActiveDeck();
      if (active?.audio && !isNaN(active.audio.duration)) {
        const targetSec = pct * active.audio.duration;
        this.audioEngine.seek(targetSec);
        this.dom.progressFill.style.width = `${pct * 100}%`;
        this.dom.timeCurrent.textContent = this._formatTime(targetSec);
      }
    };

    this.dom.progressBar.addEventListener('mousedown', (e) => {
      this.isDraggingSeek = true;
      handleSeek(e);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDraggingSeek) handleSeek(e);
    });

    window.addEventListener('mouseup', () => {
      this.isDraggingSeek = false;
    });

    // Drawers toggle
    this.dom.btnLyrics.addEventListener('click', () => this.onToggleLyrics());
    this.dom.btnQueue.addEventListener('click', () => this.onToggleQueue());

    // Audio Engine Listeners
    this.audioEngine.on('stateChange', ({ isPlaying, volume }) => {
      this.dom.iconPlay.style.display = isPlaying ? 'none' : 'block';
      this.dom.iconPause.style.display = isPlaying ? 'block' : 'none';
      this.dom.volumeSlider.value = volume;
    });

    this.audioEngine.on('timeupdate', ({ currentTime, duration, progress }) => {
      if (!this.isDraggingSeek) {
        this.dom.progressFill.style.width = `${(progress || 0) * 100}%`;
        this.dom.timeCurrent.textContent = this._formatTime(currentTime);
        this.dom.timeDuration.textContent = this._formatTime(duration);
      }
    });

    this.audioEngine.on('trackChange', ({ track }) => {
      this._updateTrackDisplay(track);
    });
  }

  _syncInitialState() {
    const fade = this.audioEngine.crossfadeSeconds;
    this.dom.crossfadeSlider.value = fade;
    this.dom.crossfadeLabel.textContent = `Fade: ${fade}s`;

    this.dom.volumeSlider.value = this.audioEngine.volume;
    this._updateRepeatUi(this.queueManager.repeatMode);
    this.dom.btnShuffle.classList.toggle('active', this.queueManager.shuffle);
  }

  _updateTrackDisplay(track) {
    if (!track) {
      this.dom.title.textContent = 'Nenhuma faixa selecionada';
      this.dom.artist.textContent = 'JustPlay Offline';
      this.dom.cover.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
      return;
    }

    this.dom.title.textContent = track.title || 'Sem título';
    this.dom.artist.textContent = track.artist || 'Artista desconhecido';

    if (track.coverDataUrl) {
      this.dom.cover.innerHTML = `<img src="${track.coverDataUrl}" alt="Capa">`;
    } else {
      this.dom.cover.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
    }
  }

  _updateRepeatUi(mode) {
    if (mode === 'repeat-one') {
      this.dom.btnRepeat.classList.add('active');
      this.dom.iconRepeatAll.style.display = 'none';
      this.dom.labelRepeatOne.style.display = 'inline';
    } else if (mode === 'repeat-all') {
      this.dom.btnRepeat.classList.add('active');
      this.dom.iconRepeatAll.style.display = 'inline';
      this.dom.labelRepeatOne.style.display = 'none';
    } else {
      this.dom.btnRepeat.classList.remove('active');
      this.dom.iconRepeatAll.style.display = 'inline';
      this.dom.labelRepeatOne.style.display = 'none';
    }
  }

  _formatTime(seconds) {
    if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlayerBar;
}
