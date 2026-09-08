/**
 * NowPlayingView: Fullscreen/slide-up focus overlay with enlarged album art,
 * dynamic synchronized scrolling lyrics, enlarged scrubber, and transport controls.
 */
class NowPlayingView {
  constructor(appContext) {
    this.app = appContext;
    this.container = null;
    this.isOpen = false;
    this.isDraggingSeek = false;
    this.viewMode = 'auto'; // 'auto' | 'cover' | 'lyrics'
    this.lyricsData = null;
    this.currentLineIndex = -1;
    this.dom = {};
  }

  mount(containerElement) {
    this.container = containerElement;
    this.container.className = 'now-playing-overlay';
    this.container.id = 'now-playing-view';

    this.container.innerHTML = `
      <div class="np-header">
        <button class="btn-icon np-btn-close" id="np-btn-close" title="Recolher (Esc)">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
        <div class="np-header-title">
          <span>Tocando Agora</span>
        </div>
        <div class="np-header-actions">
          <button class="btn btn-secondary btn-sm" id="np-btn-toggle-mode" title="Alternar Capa / Letra">
            Letras / Capa
          </button>
        </div>
      </div>

      <div class="np-body">
        <!-- Enlarged Cover Art -->
        <div class="np-cover-container" id="np-cover-container">
          <div class="np-cover-wrapper" id="np-cover-wrapper">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
          </div>
        </div>

        <!-- Lyrics Section -->
        <div class="np-lyrics-container" id="np-lyrics-container" style="display: none;">
          <div class="np-lyrics-scroll" id="np-lyrics-scroll">
            <!-- Lyrics lines rendered dynamically -->
          </div>
        </div>
      </div>

      <div class="np-footer">
        <div class="np-meta-area">
          <div class="np-track-title" id="np-track-title">Nenhuma faixa selecionada</div>
          <div class="np-track-artist" id="np-track-artist">JustPlay Offline</div>
        </div>

        <div class="np-progress-area">
          <span class="np-time" id="np-time-current">0:00</span>
          <div class="slider-track np-slider-track" id="np-progress-bar">
            <div class="slider-fill" id="np-progress-fill" style="width: 0%;"></div>
          </div>
          <span class="np-time" id="np-time-duration">0:00</span>
        </div>

        <div class="np-controls-area">
          <div class="np-transport-group">
            <button class="btn-icon" id="np-btn-shuffle" title="Aleatório">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
            </button>
            <button class="btn-icon" id="np-btn-prev" title="Anterior">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
            </button>
            <button class="play-btn np-play-btn" id="np-btn-play-pause" title="Reproduzir / Pausar">
              <svg id="np-icon-play" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              <svg id="np-icon-pause" style="display:none;" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
            </button>
            <button class="btn-icon" id="np-btn-next" title="Próxima">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
            </button>
            <button class="btn-icon" id="np-btn-repeat" title="Repetição">
              <svg id="np-icon-repeat-all" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
              <span id="np-label-repeat-one" style="display:none; font-size: 11px; font-weight: bold;">1</span>
            </button>
          </div>

          <div class="np-volume-group">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            <input type="range" id="np-volume-slider" min="0" max="1" step="0.01" value="0.8">
          </div>
        </div>
      </div>
    `;

    this._cacheDom();
    this._bindEvents();
  }

  _cacheDom() {
    this.dom = {
      btnClose: this.container.querySelector('#np-btn-close'),
      btnToggleMode: this.container.querySelector('#np-btn-toggle-mode'),
      coverContainer: this.container.querySelector('#np-cover-container'),
      coverWrapper: this.container.querySelector('#np-cover-wrapper'),
      lyricsContainer: this.container.querySelector('#np-lyrics-container'),
      lyricsScroll: this.container.querySelector('#np-lyrics-scroll'),
      title: this.container.querySelector('#np-track-title'),
      artist: this.container.querySelector('#np-track-artist'),
      progressBar: this.container.querySelector('#np-progress-bar'),
      progressFill: this.container.querySelector('#np-progress-fill'),
      timeCurrent: this.container.querySelector('#np-time-current'),
      timeDuration: this.container.querySelector('#np-time-duration'),
      btnPlayPause: this.container.querySelector('#np-btn-play-pause'),
      iconPlay: this.container.querySelector('#np-icon-play'),
      iconPause: this.container.querySelector('#np-icon-pause'),
      btnPrev: this.container.querySelector('#np-btn-prev'),
      btnNext: this.container.querySelector('#np-btn-next'),
      btnShuffle: this.container.querySelector('#np-btn-shuffle'),
      btnRepeat: this.container.querySelector('#np-btn-repeat'),
      iconRepeatAll: this.container.querySelector('#np-icon-repeat-all'),
      labelRepeatOne: this.container.querySelector('#np-label-repeat-one'),
      volumeSlider: this.container.querySelector('#np-volume-slider')
    };
  }

  _bindEvents() {
    this.dom.btnClose?.addEventListener('click', () => this.close());

    this.dom.btnToggleMode?.addEventListener('click', () => {
      if (!this.dom.lyricsContainer || !this.dom.coverContainer) return;
      if (this.dom.lyricsContainer.style.display === 'none') {
        this.dom.lyricsContainer.style.display = 'flex';
        this.dom.coverContainer.style.display = 'none';
        this.viewMode = 'lyrics';
      } else {
        this.dom.lyricsContainer.style.display = 'none';
        this.dom.coverContainer.style.display = 'flex';
        this.viewMode = 'cover';
      }
    });

    this.dom.btnPlayPause?.addEventListener('click', () => this.app.audioEngine.togglePlayPause());
    this.dom.btnNext?.addEventListener('click', () => this.app.audioEngine.next());
    this.dom.btnPrev?.addEventListener('click', () => this.app.audioEngine.previous());

    this.dom.btnShuffle?.addEventListener('click', () => {
      const active = this.app.queueManager.toggleShuffle();
      this.dom.btnShuffle?.classList.toggle('active', active);
    });

    this.dom.btnRepeat?.addEventListener('click', () => {
      const mode = this.app.queueManager.toggleRepeatMode();
      this._updateRepeatUi(mode);
    });

    this.dom.volumeSlider?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.app.audioEngine.setVolume(val);
    });

    // Seeking on expanded progress bar
    const handleSeek = (e) => {
      if (!this.dom.progressBar) return;
      const rect = this.dom.progressBar.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const pct = clickX / rect.width;
      const active = this.app.audioEngine.getActiveDeck();
      if (active?.audio && !isNaN(active.audio.duration)) {
        const targetSec = pct * active.audio.duration;
        this.app.audioEngine.seek(targetSec);
        if (this.dom.progressFill) this.dom.progressFill.style.width = `${pct * 100}%`;
        if (this.dom.timeCurrent) this.dom.timeCurrent.textContent = this._formatTime(targetSec);
      }
    };

    this.dom.progressBar?.addEventListener('mousedown', (e) => {
      this.isDraggingSeek = true;
      handleSeek(e);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDraggingSeek) handleSeek(e);
    });

    window.addEventListener('mouseup', () => {
      this.isDraggingSeek = false;
    });

    // Audio Engine Listeners
    this.app.audioEngine.on('stateChange', ({ isPlaying, volume }) => {
      this.dom.iconPlay.style.display = isPlaying ? 'none' : 'block';
      this.dom.iconPause.style.display = isPlaying ? 'block' : 'none';
      this.dom.volumeSlider.value = volume;
    });

    this.app.audioEngine.on('timeupdate', ({ currentTime, duration, progress }) => {
      if (!this.isDraggingSeek) {
        this.dom.progressFill.style.width = `${(progress || 0) * 100}%`;
        this.dom.timeCurrent.textContent = this._formatTime(currentTime);
        this.dom.timeDuration.textContent = this._formatTime(duration);
      }
      if (this.isOpen && this.lyricsData?.lines?.length) {
        this._updateActiveLyricLine(currentTime);
      }
    });

    this.app.audioEngine.on('trackChange', ({ track }) => {
      this._syncTrackInfo(track);
      if (this.isOpen) {
        this._loadLyrics(track);
      }
    });

    // Escape key to close Now Playing overlay
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  async open() {
    this.isOpen = true;
    this.container.classList.add('open');

    const track = this.app.queueManager.getCurrentTrack();
    this._syncTrackInfo(track);
    this._syncState();
    await this._loadLyrics(track);
  }

  close() {
    this.isOpen = false;
    this.container.classList.remove('open');
  }

  _syncState() {
    this.dom.volumeSlider.value = this.app.audioEngine.volume;
    this._updateRepeatUi(this.app.queueManager.repeatMode);
    this.dom.btnShuffle.classList.toggle('active', this.app.queueManager.shuffle);
  }

  _syncTrackInfo(track) {
    if (!track) {
      this.dom.title.textContent = 'Nenhuma faixa selecionada';
      this.dom.artist.textContent = 'JustPlay Offline';
      this.dom.coverWrapper.innerHTML = `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
      return;
    }

    this.dom.title.textContent = track.title || 'Sem título';
    this.dom.artist.textContent = `${track.artist || 'Artista desconhecido'} ${track.album ? '• ' + track.album : ''}`;

    if (track.coverDataUrl) {
      this.dom.coverWrapper.innerHTML = `<img src="${track.coverDataUrl}" alt="Capa Ampliada" class="np-large-cover-img">`;
    } else {
      this.dom.coverWrapper.innerHTML = `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
    }
  }

  async _loadLyrics(track) {
    if (!track) {
      this.lyricsData = null;
      this._renderLyrics();
      return;
    }

    try {
      this.lyricsData = await window.api.getLyrics(track.filePath);
      this._renderLyrics();
    } catch (e) {
      this.lyricsData = null;
      this._renderLyrics();
    }
  }

  _renderLyrics() {
    const scrollEl = this.dom.lyricsScroll;
    if (!scrollEl) return;

    const hasLyrics = this.lyricsData && (this.lyricsData.lines?.length > 0 || this.lyricsData.plain);

    if (hasLyrics) {
      // Default to showing lyrics if available and viewMode is auto
      if (this.viewMode === 'auto' || this.viewMode === 'lyrics') {
        this.dom.lyricsContainer.style.display = 'flex';
        this.dom.coverContainer.style.display = 'none';
      }
    } else {
      this.dom.lyricsContainer.style.display = 'none';
      this.dom.coverContainer.style.display = 'flex';
      scrollEl.innerHTML = '<div class="empty-state"><p>Nenhuma letra disponível para esta faixa</p></div>';
      return;
    }

    const hasSync = this.lyricsData.lines.some(l => l.time >= 0);

    if (hasSync) {
      let html = '';
      this.lyricsData.lines.forEach((line, idx) => {
        html += `<div class="np-lyric-line" id="np-line-${idx}" data-time="${line.time}">${this._escapeHtml(line.text || '...')}</div>`;
      });
      scrollEl.innerHTML = html;
      this.currentLineIndex = -1;
    } else {
      scrollEl.innerHTML = `
        <div style="white-space: pre-wrap; font-size: 1.15rem; line-height: 2; text-align: center; color: var(--text-secondary);">
          ${this._escapeHtml(this.lyricsData.plain || '')}
        </div>
      `;
    }
  }

  _updateActiveLyricLine(currentTime) {
    if (!this.lyricsData?.lines?.length) return;

    let targetIdx = -1;
    for (let i = 0; i < this.lyricsData.lines.length; i++) {
      if (this.lyricsData.lines[i].time <= currentTime) {
        targetIdx = i;
      } else {
        break;
      }
    }

    if (targetIdx !== this.currentLineIndex) {
      if (this.currentLineIndex !== -1) {
        const prevEl = this.dom.lyricsScroll.querySelector(`#np-line-${this.currentLineIndex}`);
        if (prevEl) prevEl.classList.remove('active');
      }

      this.currentLineIndex = targetIdx;

      if (targetIdx !== -1) {
        const curEl = this.dom.lyricsScroll.querySelector(`#np-line-${targetIdx}`);
        if (curEl) {
          curEl.classList.add('active');
          curEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
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

  _escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NowPlayingView;
}
