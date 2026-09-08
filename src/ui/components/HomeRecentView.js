/**
 * HomeRecentView: Modern Spotify-style central view with category filter pills,
 * 2x3 quick-access grid, recent albums/tracks cards row, and full TrackList table.
 * Strictly free of commercial advertisement banners.
 */
const _TrackListHome = typeof TrackList !== 'undefined'
  ? TrackList
  : (typeof require !== 'undefined' ? require('./TrackList') : null);

class HomeRecentView {
  constructor(appContext) {
    this.app = appContext;
    this.tracks = [];
    this.filteredTracks = [];
    this.playlists = [];
    this.container = null;
    this.searchTerm = '';
    this.activeCategory = 'all'; // 'all' | 'music' | 'playlists'

    this.trackList = new _TrackListHome(this.app, {
      showIndexColumn: true,
      onPlayTrack: (track, list, index) => {
        this.app.playTrackDirectly(track, list, index);
      }
    });
  }

  mount(containerElement) {
    this.container = containerElement;
    this.render();
    this.loadTracks();
    this.loadPlaylists();
  }

  async loadPlaylists() {
    try {
      if (typeof window !== 'undefined' && window.api?.getPlaylists) {
        const pls = await window.api.getPlaylists();
        this.playlists = Array.isArray(pls) ? pls : [];
        this._renderQuickGrid();
      }
    } catch (e) {
      console.warn('[HomeRecentView] Error loading playlists:', e);
    }
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="home-main-scroll">
        <!-- Category Filter Pills -->
        <div class="category-pills-bar">
          <button class="pill-chip ${this.activeCategory === 'all' ? 'active' : ''}" data-cat="all">Tudo</button>
          <button class="pill-chip ${this.activeCategory === 'music' ? 'active' : ''}" data-cat="music">Músicas</button>
          <button class="pill-chip ${this.activeCategory === 'playlists' ? 'active' : ''}" data-cat="playlists">Listas & Playlists</button>
        </div>

        <!-- 2x3 Quick Access Grid -->
        <div class="quick-access-grid" id="quick-access-grid">
          <!-- 6 quick cards rendered dynamically -->
        </div>

        <!-- Section: Cards Carousel / Grid -->
        <div class="home-section-header">
          <h2 class="home-section-title">Tocadas recentemente & Destaques</h2>
          <button class="home-show-all-btn" id="btn-show-all-recent">Mostrar tudo</button>
        </div>
        <div class="cards-carousel-row" id="cards-carousel-row">
          <!-- Vertical album/track cards rendered here -->
        </div>

        <!-- Section: Detailed Library Tracklist -->
        <div class="home-section-header" style="margin-top: 24px;">
          <div style="display: flex; align-items: baseline; gap: 12px;">
            <h2 class="home-section-title">Todas as Músicas da Biblioteca</h2>
            <span class="home-section-count" id="library-count-text">Carregando músicas...</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary btn-sm" id="btn-add-files" title="Adicionar arquivos avulsos">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
              Adicionar Arquivos
            </button>
            <button class="btn btn-primary btn-sm" id="btn-add-folder" title="Escanear pasta inteira">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
              Adicionar Pasta
            </button>
          </div>
        </div>

        <div class="view-body" id="library-body">
          <!-- TrackList injected here -->
        </div>
      </div>
    `;

    this._bindEvents();
    this._renderQuickGrid();
    this._renderCarouselCards();
  }

  _bindEvents() {
    // Category pills
    this.container.querySelectorAll('.pill-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeCategory = btn.dataset.cat;
        this.container.querySelectorAll('.pill-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.filterAndRender();
      });
    });

    // Add folder & Add files buttons
    const btnFolder = this.container.querySelector('#btn-add-folder');
    const btnFiles = this.container.querySelector('#btn-add-files');

    btnFolder?.addEventListener('click', async () => {
      const folder = await window.api.openFolderDialog();
      if (folder) {
        this.app.showToast('Escaneando pasta de músicas...');
        await window.api.addLibraryFolder(folder);
        const audioFiles = await window.api.scanFolder(folder);
        if (audioFiles.length > 0) {
          this.app.showToast(`Importando metadados de ${audioFiles.length} faixas...`);
          const parsed = await window.api.parseMetadataBatch(audioFiles);
          this.app.showToast(`${parsed.length} faixas adicionadas à biblioteca!`);
          await this.loadTracks();
        } else {
          this.app.showToast('Nenhum arquivo de áudio suportado encontrado na pasta.');
        }
      }
    });

    btnFiles?.addEventListener('click', async () => {
      const files = await window.api.openFilesDialog();
      if (files && files.length > 0) {
        this.app.showToast(`Processando ${files.length} arquivos...`);
        const parsed = await window.api.parseMetadataBatch(files);
        this.app.showToast(`${parsed.length} faixas adicionadas!`);
        await this.loadTracks();
      }
    });

    // Show all button
    this.container.querySelector('#btn-show-all-recent')?.addEventListener('click', () => {
      const body = this.container.querySelector('#library-body');
      body?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  _renderQuickGrid() {
    const grid = this.container?.querySelector('#quick-access-grid');
    if (!grid) return;

    const favCount = this.app.favoritesSet ? this.app.favoritesSet.size : 0;
    const cards = [];

    // Card 1: Liked Songs
    cards.push({
      id: 'liked',
      type: 'liked',
      title: 'Músicas Curtidas',
      subtitle: `${favCount} faixas curtidas`,
      coverHtml: `
        <div class="quick-card-cover-gradient">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </div>
      `,
      onPlay: async () => {
        const favPaths = Array.from(this.app.favoritesSet || []);
        const favTracks = this.tracks.filter(t => favPaths.includes(t.filePath));
        if (favTracks.length > 0) {
          this.app.setQueueAndPlay(favTracks, 0);
        } else {
          this.app.showToast('Nenhuma música curtida ainda.');
        }
      }
    });

    // Cards 2-6: Up to 5 user playlists or top albums
    this.playlists.slice(0, 5).forEach(pl => {
      const count = pl.trackIds ? pl.trackIds.length : 0;
      const initials = (pl.name || 'PL').slice(0, 2).toUpperCase();
      cards.push({
        id: pl.id,
        type: 'playlist',
        title: pl.name || 'Playlist',
        subtitle: `${count} faixas`,
        coverHtml: `
          <div class="quick-card-cover-pl">
            <span>${initials}</span>
          </div>
        `,
        onPlay: async () => {
          const plTracks = await window.api.getPlaylistTracks(pl.id);
          if (plTracks.length > 0) {
            this.app.setQueueAndPlay(plTracks, 0);
          } else {
            this.app.showToast('Esta playlist está vazia.');
          }
        }
      });
    });

    // If fewer than 6, fill with top albums or recent tracks
    if (cards.length < 6 && this.tracks.length > 0) {
      const albumsMap = new Map();
      this.tracks.forEach(t => {
        if (t.album && !albumsMap.has(t.album)) {
          albumsMap.set(t.album, t);
        }
      });

      for (const [albumName, sampleTrack] of albumsMap.entries()) {
        if (cards.length >= 6) break;
        const albumTracks = this.tracks.filter(t => t.album === albumName);
        cards.push({
          id: `album-${albumName}`,
          type: 'album',
          title: albumName,
          subtitle: `${albumTracks.length} faixas • ${sampleTrack.artist || 'Artista'}`,
          coverHtml: sampleTrack.coverDataUrl
            ? `<img src="${sampleTrack.coverDataUrl}" alt="${this._escapeHtml(albumName)}" class="quick-card-cover-img">`
            : `<div class="quick-card-cover-pl"><span>${albumName.slice(0, 2).toUpperCase()}</span></div>`,
          onPlay: () => {
            this.app.setQueueAndPlay(albumTracks, 0);
          }
        });
      }
    }

    let html = '';
    cards.forEach((c, idx) => {
      html += `
        <div class="quick-card" data-index="${idx}">
          <div class="quick-card-cover">
            ${c.coverHtml}
          </div>
          <span class="quick-card-title" title="${this._escapeHtml(c.title)}">${this._escapeHtml(c.title)}</span>
          <button class="quick-card-play-btn" title="Tocar ${this._escapeHtml(c.title)}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6 4 20 12 6 20 6 4"></polygon>
            </svg>
          </button>
        </div>
      `;
    });

    grid.innerHTML = html;

    grid.querySelectorAll('.quick-card').forEach(cardEl => {
      const idx = parseInt(cardEl.dataset.index, 10);
      const c = cards[idx];
      if (!c) return;

      cardEl.addEventListener('click', (e) => {
        if (c.onPlay) c.onPlay();
      });
    });
  }

  _renderCarouselCards() {
    const row = this.container?.querySelector('#cards-carousel-row');
    if (!row) return;

    if (this.tracks.length === 0) {
      row.innerHTML = `
        <div class="empty-state" style="padding: 24px 0; width: 100%;">
          <span style="font-size: 0.85rem; color: var(--text-muted);">Adicione pastas de música para ver lançamentos e álbuns aqui.</span>
        </div>
      `;
      return;
    }

    // Up to 8 unique items for the carousel
    const displayItems = this.tracks.slice(0, 8);
    let html = '';

    displayItems.forEach((track, idx) => {
      const cover = track.coverDataUrl
        ? `<img src="${track.coverDataUrl}" alt="Capa" class="card-item-cover-img" loading="lazy">`
        : `<div class="card-item-cover-fallback">
             <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
           </div>`;

      html += `
        <div class="card-vertical-item" data-index="${idx}" title="${this._escapeHtml(track.title)}">
          <div class="card-item-cover-wrap">
            ${cover}
            <button class="card-item-play-btn" title="Reproduzir">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
            </button>
          </div>
          <h4 class="card-item-title">${this._escapeHtml(track.title || 'Sem título')}</h4>
          <span class="card-item-subtitle">${this._escapeHtml(track.artist || 'Artista desconhecido')}</span>
        </div>
      `;
    });

    row.innerHTML = html;

    row.querySelectorAll('.card-vertical-item').forEach(el => {
      const idx = parseInt(el.dataset.index, 10);
      const track = displayItems[idx];
      el.addEventListener('click', () => {
        this.app.playTrackDirectly(track, displayItems, idx);
      });
    });
  }

  async loadTracks() {
    try {
      if (typeof window === 'undefined' || !window.api?.getRecentTracks) {
        if (!Array.isArray(this.tracks)) this.tracks = [];
        this._renderQuickGrid();
        this._renderCarouselCards();
        this.filterAndRender();
        return;
      }
      const res = await window.api.getRecentTracks(500);
      this.tracks = Array.isArray(res) ? res : [];

      if (this.tracks.length === 0) {
        const settings = await window.api.getSettings();
        const folders = settings?.libraryFolders || [];
        if (folders.length > 0) {
          let anyIndexed = false;
          for (const f of folders) {
            const audioFiles = await window.api.scanFolder(f);
            if (audioFiles && audioFiles.length > 0) {
              await window.api.parseMetadataBatch(audioFiles);
              anyIndexed = true;
            }
          }
          if (anyIndexed) {
            const refreshed = await window.api.getRecentTracks(500);
            this.tracks = Array.isArray(refreshed) ? refreshed : [];
          }
        }
      }
    } catch (err) {
      console.error('[HomeRecentView] Error loading tracks:', err);
      this.tracks = [];
    }

    this._renderQuickGrid();
    this._renderCarouselCards();
    this.filterAndRender();
  }

  filterAndRender() {
    if (!Array.isArray(this.tracks)) {
      this.tracks = [];
    }

    let list = [...this.tracks];

    // Filter by active category
    if (this.activeCategory === 'playlists') {
      // If user selected Playlists pill, route to playlists view or show message
      const body = this.container?.querySelector('#library-body');
      if (body) {
        body.innerHTML = `
          <div class="empty-state" style="padding: 40px 0;">
            <p>Selecione uma playlist no painel lateral esquerdo para inspecioná-la e reordená-la.</p>
          </div>
        `;
      }
      return;
    }

    // Filter by search term
    if (this.searchTerm) {
      list = list.filter(t =>
        (t.title && t.title.toLowerCase().includes(this.searchTerm)) ||
        (t.artist && t.artist.toLowerCase().includes(this.searchTerm)) ||
        (t.album && t.album.toLowerCase().includes(this.searchTerm))
      );
    }

    this.filteredTracks = list;

    const countText = this.container?.querySelector('#library-count-text');
    if (countText) {
      countText.textContent = `${this.filteredTracks.length} faixa${this.filteredTracks.length === 1 ? '' : 's'}`;
    }

    const body = this.container?.querySelector('#library-body');
    if (!body) return;

    this.trackList.setTracks(this.filteredTracks);
    this.trackList.render(body);
  }

  setSearchTerm(term) {
    this.searchTerm = (term || '').toLowerCase().trim();
    this.filterAndRender();
  }

  setActiveFilter(category) {
    this.activeCategory = category || 'all';
    this.container?.querySelectorAll('.pill-chip').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === this.activeCategory);
    });
    this.filterAndRender();
  }

  filterByFavorites() {
    if (!Array.isArray(this.tracks)) return;
    const favSet = this.app.favoritesSet || new Set();
    this.filteredTracks = this.tracks.filter(t => favSet.has(t.filePath));
    const countText = this.container?.querySelector('#library-count-text');
    if (countText) {
      countText.textContent = `${this.filteredTracks.length} favoritas`;
    }
    const body = this.container?.querySelector('#library-body');
    if (!body) return;
    this.trackList.setTracks(this.filteredTracks);
    this.trackList.render(body);
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
  module.exports = HomeRecentView;
}
