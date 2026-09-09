/**
 * AllTracksView: Dedicated, high-performance virtualized library view.
 * Solves main-thread freezing by windowing/virtual-scrolling rows (only ~30 DOM nodes
 * rendered at any given time out of 800+ tracks), with 60 FPS scrolling and instant sorting.
 */
class AllTracksView {
  constructor(appContext) {
    this.app = appContext;
    this.container = null;
    this.tracks = []; // All library tracks
    this.displayTracks = []; // Filtered & sorted tracks
    this.searchTerm = '';

    // Sorting state
    this.sortColumn = null; // 'title' | 'artist' | 'album' | 'duration' | null
    this.sortDirection = 'none'; // 'asc' | 'desc' | 'none'

    // Virtualization settings
    this.rowHeight = 56;
    this.overscan = 8;
    this.scrollTop = 0;
    this.viewportHeight = 600;
    this._rafId = null;

    this._onScroll = this._onScroll.bind(this);
    this._onResize = this._onResize.bind(this);
  }

  mount(containerElement) {
    this.container = containerElement;
    this.container.className = 'all-tracks-view-container';
    this.container.style.display = 'none';
  }

  async loadTracks(tracks) {
    if (Array.isArray(tracks)) {
      this.tracks = [...tracks];
    } else if (typeof window !== 'undefined' && window.api?.getTracks) {
      try {
        this.tracks = await window.api.getTracks();
      } catch (e) {
        console.warn('[AllTracksView] Failed to load tracks:', e);
        this.tracks = [];
      }
    } else if (Array.isArray(this.app.views?.recent?.tracks)) {
      this.tracks = [...this.app.views.recent.tracks];
    }
    this._applyFilterAndSort();
    this.render();
  }

  setSearchTerm(term) {
    this.searchTerm = (term || '').trim();
    this._applyFilterAndSort();
    this._renderVirtualList();
    this._updateCountBadge();
  }

  _cycleSort(col) {
    if (this.sortColumn !== col) {
      this.sortColumn = col;
      this.sortDirection = 'asc';
    } else {
      if (this.sortDirection === 'asc') {
        this.sortDirection = 'desc';
      } else if (this.sortDirection === 'desc') {
        this.sortColumn = null;
        this.sortDirection = 'none';
      } else {
        this.sortDirection = 'asc';
      }
    }
    this._applyFilterAndSort();
    this._updateSortIndicators();
    this._renderVirtualList();
  }

  _applyFilterAndSort() {
    let list = [...this.tracks];

    if (this.searchTerm) {
      const normQuery = this.searchTerm
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

      list = list.filter(t => {
        const title = (t.title || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const artist = (t.artist || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const album = (t.album || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        return title.includes(normQuery) || artist.includes(normQuery) || album.includes(normQuery);
      });
    }

    if (this.sortColumn && this.sortDirection !== 'none') {
      const col = this.sortColumn;
      const dir = this.sortDirection === 'asc' ? 1 : -1;

      list.sort((a, b) => {
        let valA = a[col];
        let valB = b[col];

        if (col === 'duration') {
          valA = typeof valA === 'number' ? valA : 0;
          valB = typeof valB === 'number' ? valB : 0;
          return (valA - valB) * dir;
        }

        const strA = (valA || '').toString().toLowerCase();
        const strB = (valB || '').toString().toLowerCase();
        return strA.localeCompare(strB, undefined, { sensitivity: 'base' }) * dir;
      });
    }

    this.displayTracks = list;
  }

  render() {
    if (!this.container) return;

    const total = this.displayTracks.length;

    this.container.innerHTML = `
      <div class="all-tracks-layout">
        <!-- Header -->
        <div class="all-tracks-header">
          <div class="all-tracks-header-info">
            <span class="all-tracks-tag">Biblioteca</span>
            <h1 class="all-tracks-title">Todas as Músicas</h1>
            <span class="all-tracks-count" id="all-tracks-count-label">${total} música${total === 1 ? '' : 's'}</span>
          </div>

          <div class="all-tracks-header-actions">
            <div class="all-tracks-search-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input type="text" class="all-tracks-search-input" id="all-tracks-filter-input" placeholder="Filtrar nesta lista..." value="${this._escapeHtml(this.searchTerm)}">
            </div>

            <button class="btn btn-secondary btn-sm" id="btn-alltracks-add-files" title="Adicionar arquivos avulsos">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <line x1="9" y1="15" x2="15" y2="15"></line>
              </svg>
              Adicionar Arquivos
            </button>

            <button class="btn btn-secondary btn-sm" id="btn-alltracks-add-folder" title="Escanear pasta inteira">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                <line x1="12" y1="11" x2="12" y2="17"></line>
                <line x1="9" y1="14" x2="15" y2="14"></line>
              </svg>
              Adicionar Pasta
            </button>

            <button class="btn btn-primary btn-sm" id="btn-alltracks-play-all" title="Reproduzir todas as músicas da biblioteca">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6 4 20 12 6 20 6 4"></polygon>
              </svg>
              Tocar Tudo
            </button>
          </div>
        </div>

        <!-- Table View with Sticky Header -->
        <div class="all-tracks-table-container">
          <div class="all-tracks-table-head">
            <div class="at-col at-col-idx">#</div>
            <div class="at-col at-col-title sortable" data-col="title">
              <span>Título</span>
              <span class="sort-indicator" id="sort-ind-title"></span>
            </div>
            <div class="at-col at-col-artist sortable" data-col="artist">
              <span>Artista</span>
              <span class="sort-indicator" id="sort-ind-artist"></span>
            </div>
            <div class="at-col at-col-album sortable" data-col="album">
              <span>Álbum</span>
              <span class="sort-indicator" id="sort-ind-album"></span>
            </div>
            <div class="at-col at-col-duration sortable" data-col="duration" title="Duração">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span class="sort-indicator" id="sort-ind-duration"></span>
            </div>
            <div class="at-col at-col-actions"></div>
          </div>

          <!-- Virtual Scroll Body -->
          <div class="all-tracks-scroll-body" id="all-tracks-scroll-body">
            <div class="at-virtual-phantom" id="at-virtual-phantom"></div>
            <div class="at-virtual-content" id="at-virtual-content">
              <!-- Rendered window rows -->
            </div>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
    this._updateSortIndicators();
    this._renderVirtualList();
  }

  _bindEvents() {
    const scrollBody = this.container.querySelector('#all-tracks-scroll-body');
    if (scrollBody) {
      scrollBody.removeEventListener('scroll', this._onScroll);
      scrollBody.addEventListener('scroll', this._onScroll, { passive: true });
    }

    window.removeEventListener('resize', this._onResize);
    window.addEventListener('resize', this._onResize, { passive: true });

    // Sort headers
    this.container.querySelectorAll('.all-tracks-table-head .sortable').forEach(el => {
      el.addEventListener('click', () => {
        const col = el.dataset.col;
        if (col) this._cycleSort(col);
      });
    });

    // Filter input
    const filterInput = this.container.querySelector('#all-tracks-filter-input');
    filterInput?.addEventListener('input', (e) => {
      this.setSearchTerm(e.target.value);
    });

    // Action buttons
    const btnPlayAll = this.container.querySelector('#btn-alltracks-play-all');
    btnPlayAll?.addEventListener('click', () => {
      if (this.displayTracks.length > 0) {
        this.app.setQueueAndPlay(this.displayTracks, 0);
      } else {
        this.app.showToast('Nenhuma música para tocar.');
      }
    });

    const btnAddFolder = this.container.querySelector('#btn-alltracks-add-folder');
    btnAddFolder?.addEventListener('click', async () => {
      if (typeof window !== 'undefined' && window.api?.openFolderDialog) {
        const folder = await window.api.openFolderDialog();
        if (folder) {
          this.app.showToast('Escaneando pasta de músicas...');
          await window.api.addLibraryFolder(folder);
          const audioFiles = await window.api.scanFolder(folder);
          if (audioFiles.length > 0) {
            this.app.showToast(`Importando metadados de ${audioFiles.length} faixas...`);
            await window.api.parseMetadataBatch(audioFiles);
            this.app.showToast(`${audioFiles.length} faixas processadas!`);
            await this.loadTracks();
          } else {
            this.app.showToast('Nenhum arquivo de áudio encontrado.');
          }
        }
      }
    });

    const btnAddFiles = this.container.querySelector('#btn-alltracks-add-files');
    btnAddFiles?.addEventListener('click', async () => {
      if (typeof window !== 'undefined' && window.api?.openFilesDialog) {
        const files = await window.api.openFilesDialog();
        if (files && files.length > 0) {
          this.app.showToast(`Processando ${files.length} arquivos...`);
          await window.api.parseMetadataBatch(files);
          this.app.showToast(`${files.length} arquivos adicionados!`);
          await this.loadTracks();
        }
      }
    });
  }

  _onScroll() {
    if (this._rafId) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      this._renderVirtualList();
    });
  }

  _onResize() {
    this._renderVirtualList();
  }

  _updateCountBadge() {
    const lbl = this.container?.querySelector('#all-tracks-count-label');
    if (lbl) {
      const total = this.displayTracks.length;
      lbl.textContent = `${total} música${total === 1 ? '' : 's'}`;
    }
  }

  _updateSortIndicators() {
    ['title', 'artist', 'album', 'duration'].forEach(col => {
      const ind = this.container?.querySelector(`#sort-ind-${col}`);
      if (!ind) return;
      if (this.sortColumn === col) {
        ind.textContent = this.sortDirection === 'asc' ? '▲' : (this.sortDirection === 'desc' ? '▼' : '');
      } else {
        ind.textContent = '';
      }
    });
  }

  _renderVirtualList() {
    const scrollBody = this.container?.querySelector('#all-tracks-scroll-body');
    const phantom = this.container?.querySelector('#at-virtual-phantom');
    const content = this.container?.querySelector('#at-virtual-content');

    if (!scrollBody || !phantom || !content) return;

    const total = this.displayTracks.length;
    const totalHeight = total * this.rowHeight;
    phantom.style.height = `${totalHeight}px`;

    if (total === 0) {
      content.style.transform = 'translateY(0px)';
      content.innerHTML = `
        <div class="all-tracks-empty-state">
          <p>Nenhuma música encontrada.</p>
        </div>
      `;
      return;
    }

    const scrollTop = scrollBody.scrollTop;
    const viewportHeight = scrollBody.clientHeight || this.viewportHeight;

    const startIndex = Math.max(0, Math.floor(scrollTop / this.rowHeight) - this.overscan);
    const endIndex = Math.min(total, Math.ceil((scrollTop + viewportHeight) / this.rowHeight) + this.overscan);

    const offsetY = startIndex * this.rowHeight;
    content.style.transform = `translateY(${offsetY}px)`;

    const currentTrack = this.app.queueManager?.getCurrentTrack();
    const isPlaying = Boolean(this.app.audioEngine?.isPlaying);
    const favSet = this.app.favoritesSet || new Set();

    let rowsHtml = '';
    for (let i = startIndex; i < endIndex; i++) {
      const track = this.displayTracks[i];
      const isCurrent = Boolean(currentTrack && track && currentTrack.filePath === track.filePath);
      const isFav = favSet.has(track.filePath);
      const durationStr = this._formatDuration(track.duration);

      const thumb = track.coverDataUrl
        ? `<img src="${track.coverDataUrl}" alt="Capa" class="at-thumb-img" loading="lazy">`
        : `<div class="at-thumb-fallback"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg></div>`;

      rowsHtml += `
        <div class="at-row ${isCurrent ? 'playing' : ''} ${isCurrent && !isPlaying ? 'paused' : ''}" data-index="${i}" data-filepath="${this._escapeHtml(track.filePath)}">
          <div class="at-col at-col-idx">
            <span class="at-idx-text ${isCurrent ? 'active-green' : ''}">${i + 1}</span>
            <button class="at-play-btn" data-index="${i}" title="Tocar ${this._escapeHtml(track.title || 'Música')}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6 4 20 12 6 20 6 4"></polygon>
              </svg>
            </button>
            ${isCurrent && isPlaying ? `
              <div class="at-eq-bars">
                <span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span>
              </div>
            ` : ''}
          </div>

          <div class="at-col at-col-title">
            <div class="at-thumb">${thumb}</div>
            <div class="at-title-wrap">
              <span class="at-track-name ${isCurrent ? 'active-green' : ''}" title="${this._escapeHtml(track.title || '')}">${this._escapeHtml(track.title || 'Sem título')}</span>
              <span class="at-track-sub">${this._escapeHtml(track.artist || 'Artista Desconhecido')}</span>
            </div>
          </div>

          <div class="at-col at-col-artist" title="${this._escapeHtml(track.artist || '')}">
            <span class="at-text-truncate">${this._escapeHtml(track.artist || 'Artista Desconhecido')}</span>
          </div>

          <div class="at-col at-col-album" title="${this._escapeHtml(track.album || '')}">
            <span class="at-text-truncate">${this._escapeHtml(track.album || 'Álbum Desconhecido')}</span>
          </div>

          <div class="at-col at-col-duration">
            <span>${durationStr}</span>
          </div>

          <div class="at-col at-col-actions">
            <button class="at-action-btn at-btn-like ${isFav ? 'active' : ''}" data-filepath="${this._escapeHtml(track.filePath)}" title="${isFav ? 'Descurtir' : 'Curtir'}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="${isFav ? '#1ed760' : 'none'}" stroke="${isFav ? '#1ed760' : 'currentColor'}" stroke-width="2">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </button>
            <button class="at-action-btn at-btn-more" data-index="${i}" title="Mais opções">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="2"></circle>
                <circle cx="19" cy="12" r="2"></circle>
                <circle cx="5" cy="12" r="2"></circle>
              </svg>
            </button>
          </div>
        </div>
      `;
    }

    content.innerHTML = rowsHtml;

    // Attach row events
    content.querySelectorAll('.at-row').forEach(rowEl => {
      const idx = parseInt(rowEl.dataset.index, 10);
      const track = this.displayTracks[idx];
      if (!track) return;

      // Double-click row: play directly
      rowEl.addEventListener('dblclick', () => {
        this.app.playTrackDirectly(track, this.displayTracks, idx);
      });

      // Play button on row hover
      const playBtn = rowEl.querySelector('.at-play-btn');
      playBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.playTrackDirectly(track, this.displayTracks, idx);
      });

      // Like button
      const likeBtn = rowEl.querySelector('.at-btn-like');
      likeBtn?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (this.app.toggleFavorite) {
          await this.app.toggleFavorite(track.filePath);
          this._renderVirtualList();
        }
      });

      // More actions menu
      const moreBtn = rowEl.querySelector('.at-btn-more');
      moreBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.app.showContextMenu) {
          this.app.showContextMenu(e, track);
        }
      });
    });
  }

  updatePlayingState() {
    if (!this.container || this.container.style.display === 'none') return;
    this._renderVirtualList();
  }

  _formatDuration(seconds) {
    if (!seconds || isNaN(seconds) || seconds <= 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
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
  module.exports = AllTracksView;
}
if (typeof window !== 'undefined') {
  window.AllTracksView = AllTracksView;
}
