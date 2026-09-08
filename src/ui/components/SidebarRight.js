/**
 * SidebarRight: Collapsible right sidebar panel (~320px) displaying
 * current track details, enlarged artwork, and "About the artist" insights with local play metrics.
 */
class SidebarRight {
  constructor(appContext, options = {}) {
    this.app = appContext;
    this.options = {
      onClose: options.onClose || (() => {}),
      onFilterByArtist: options.onFilterByArtist || (() => {})
    };
    this.container = null;
    this.isOpen = true;
    this.currentTrack = null;
    this.artistPlays = 0;
    this.artistTrackCount = 0;
  }

  mount(containerElement) {
    this.container = containerElement;
    this.render();

    // Listen to track changes from audio engine
    this.app.audioEngine?.on('trackChange', ({ track }) => {
      this.updateTrack(track);
    });

    // Initial sync
    const curr = this.app.queueManager?.getCurrentTrack();
    if (curr) {
      this.updateTrack(curr);
    }
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <aside class="sidebar-right-panel ${this.isOpen ? 'open' : 'collapsed'}" id="sidebar-right-panel">
        <div class="sidebar-right-header">
          <h3 id="sr-header-title">Tocando Agora</h3>
          <button class="btn-icon" id="sr-btn-close" title="Recolher painel">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="sidebar-right-content" id="sr-content">
          <!-- Artwork & Track Info -->
          <div class="sr-cover-card">
            <div class="sr-cover-wrapper" id="sr-cover-wrapper">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>
              </svg>
            </div>
            <div class="sr-track-meta">
              <div class="sr-track-text">
                <h2 class="sr-track-title" id="sr-track-title">Nenhuma faixa tocando</h2>
                <span class="sr-track-artist" id="sr-track-artist">JustPlay Offline</span>
              </div>
              <button class="btn-icon sr-btn-fav" id="sr-btn-fav" title="Favoritar / Curtir">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- About the Artist Card -->
          <div class="sr-artist-card" id="sr-artist-card">
            <div class="sr-artist-banner" id="sr-artist-banner">
              <div class="sr-artist-badge">
                <span class="sr-verified-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </span>
                <span>Artista da Biblioteca</span>
              </div>
              <h3 class="sr-artist-name" id="sr-artist-name">Artista</h3>
            </div>

            <div class="sr-artist-details">
              <div class="sr-artist-metrics">
                <strong id="sr-artist-plays">0 reproduções locais</strong>
                <span id="sr-artist-track-count">Nesta máquina</span>
              </div>
              <button class="btn btn-secondary btn-sm sr-btn-filter-artist" id="sr-btn-filter-artist">
                Ver todas as faixas
              </button>
            </div>
          </div>

          <!-- Technical Specs & Codec Tags -->
          <div class="sr-specs-card">
            <h4>Ficha Técnica do Áudio</h4>
            <div class="sr-specs-grid" id="sr-specs-grid">
              <div class="sr-spec-item">
                <span>Formato</span>
                <strong id="sr-spec-format">—</strong>
              </div>
              <div class="sr-spec-item">
                <span>Duração</span>
                <strong id="sr-spec-duration">—</strong>
              </div>
              <div class="sr-spec-item">
                <span>Álbum</span>
                <strong id="sr-spec-album">—</strong>
              </div>
              <div class="sr-spec-item">
                <span>Local</span>
                <button class="sr-link-btn" id="sr-btn-reveal-file">Abrir no disco</button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const btnClose = this.container.querySelector('#sr-btn-close');
    const btnFav = this.container.querySelector('#sr-btn-fav');
    const btnFilterArtist = this.container.querySelector('#sr-btn-filter-artist');
    const btnReveal = this.container.querySelector('#sr-btn-reveal-file');

    btnClose?.addEventListener('click', () => {
      this.close();
      this.options.onClose();
    });

    btnFav?.addEventListener('click', async () => {
      if (!this.currentTrack?.filePath) return;
      const res = await window.api.toggleFavorite(this.currentTrack.filePath);
      if (this.app.syncFavorites) {
        this.app.syncFavorites(res.favorites);
      }
      this._updateFavoriteUi(res.isFavorite);
      this.app.showToast(res.isFavorite ? 'Adicionada aos Curtidos!' : 'Removida dos Curtidos!');
    });

    btnFilterArtist?.addEventListener('click', () => {
      if (this.currentTrack?.artist) {
        this.options.onFilterByArtist(this.currentTrack.artist);
      }
    });

    btnReveal?.addEventListener('click', async () => {
      if (this.currentTrack?.filePath) {
        await window.api.showItemInFolder(this.currentTrack.filePath);
      }
    });
  }

  async updateTrack(track) {
    this.currentTrack = track;
    if (!this.container) return;

    const titleEl = this.container.querySelector('#sr-track-title');
    const artistEl = this.container.querySelector('#sr-track-artist');
    const coverWrapper = this.container.querySelector('#sr-cover-wrapper');
    const artistNameEl = this.container.querySelector('#sr-artist-name');
    const formatEl = this.container.querySelector('#sr-spec-format');
    const durationEl = this.container.querySelector('#sr-spec-duration');
    const albumEl = this.container.querySelector('#sr-spec-album');
    const artistPlaysEl = this.container.querySelector('#sr-artist-plays');
    const artistTracksEl = this.container.querySelector('#sr-artist-track-count');

    if (!track) {
      if (titleEl) titleEl.textContent = 'Nenhuma faixa tocando';
      if (artistEl) artistEl.textContent = 'JustPlay Offline';
      if (coverWrapper) {
        coverWrapper.innerHTML = `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
      }
      return;
    }

    if (titleEl) titleEl.textContent = track.title || 'Sem título';
    if (artistEl) artistEl.textContent = track.artist || 'Artista desconhecido';
    if (artistNameEl) artistNameEl.textContent = track.artist || 'Artista desconhecido';

    // Cover
    if (coverWrapper) {
      if (track.coverDataUrl) {
        coverWrapper.innerHTML = `<img src="${track.coverDataUrl}" alt="Capa" class="sr-cover-img">`;
      } else {
        coverWrapper.innerHTML = `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
      }
    }

    // Favorite state
    const isFav = this.app.isFavorite ? this.app.isFavorite(track.filePath) : false;
    this._updateFavoriteUi(isFav);

    // Specs
    const ext = (track.filePath || '').split('.').pop().toUpperCase();
    if (formatEl) formatEl.textContent = ext ? `.${ext}` : 'ÁUDIO';
    if (durationEl) durationEl.textContent = this._formatTime(track.duration);
    if (albumEl) albumEl.textContent = track.album || '—';

    // Compute artist stats across library
    try {
      const stats = await this.computeArtistStats(track.artist);
      if (artistPlaysEl) {
        artistPlaysEl.textContent = `${stats.totalPlays} reproduç${stats.totalPlays === 1 ? 'ão local' : 'ões locais'}`;
      }
      if (artistTracksEl) {
        artistTracksEl.textContent = `${stats.trackCount} faixa${stats.trackCount === 1 ? '' : 's'} na biblioteca`;
      }
    } catch (e) {
      console.warn('[SidebarRight] Error calculating artist metrics:', e);
    }
  }

  async computeArtistStats(artistName) {
    if (!artistName) return { totalPlays: 0, trackCount: 0 };
    try {
      if (typeof window !== 'undefined' && window.api?.getTracks) {
        const allTracks = await window.api.getTracks();
        const artistTracks = (allTracks || []).filter(t => (t.artist || '').toLowerCase() === artistName.toLowerCase());
        const totalPlays = artistTracks.reduce((acc, cur) => acc + (cur.play_count || 0), 0);
        return { totalPlays, trackCount: artistTracks.length };
      }
    } catch (e) {
      console.warn('[SidebarRight] Error calculating artist metrics:', e);
    }
    return { totalPlays: 0, trackCount: 0 };
  }

  _updateFavoriteUi(isFav) {
    const btnFav = this.container?.querySelector('#sr-btn-fav');
    if (!btnFav) return;
    const svg = btnFav.querySelector('svg');
    if (isFav) {
      btnFav.classList.add('active');
      if (svg) svg.setAttribute('fill', 'var(--accent-color)');
    } else {
      btnFav.classList.remove('active');
      if (svg) svg.setAttribute('fill', 'none');
    }
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this._syncOpenClass();
  }

  open() {
    this.isOpen = true;
    this._syncOpenClass();
  }

  close() {
    this.isOpen = false;
    this._syncOpenClass();
  }

  _syncOpenClass() {
    const panel = this.container?.querySelector ? this.container.querySelector('#sidebar-right-panel') : null;
    if (panel) {
      panel.classList.toggle('open', this.isOpen);
      panel.classList.toggle('collapsed', !this.isOpen);
    }
    if (typeof document !== 'undefined') {
      const appBody = document.getElementById('app-body-grid');
      if (appBody) {
        appBody.classList.toggle('right-collapsed', !this.isOpen);
      }
    }
  }

  _formatTime(seconds) {
    if (!seconds || isNaN(seconds) || seconds < 0) return '—';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SidebarRight;
}
