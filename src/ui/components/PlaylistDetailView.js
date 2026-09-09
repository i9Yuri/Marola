/**
 * PlaylistDetailView: High-fidelity Spotify desktop styled playlist view.
 * Features:
 * - Immersive Hero Header with large square cover, playlist tag, bold headline, author line & aggregate stats.
 * - Action Bar with prominent 56px Spotify Green play button, shuffle toggle, download icon, and sort selector.
 * - 5-column tracklist table (#, Título, Álbum, Data de adição, Duração) with hover play trigger and 56px strict height.
 */
const _PlaylistCoverServiceDetail = typeof PlaylistCoverService !== 'undefined'
  ? PlaylistCoverService
  : (typeof require !== 'undefined' ? require('../../services/playlistCoverService') : null);

const _TrackItemDetail = typeof TrackSwipeController !== 'undefined' && typeof renderSwipeRevealLayer !== 'undefined'
  ? { TrackSwipeController, renderSwipeRevealLayer }
  : (typeof require !== 'undefined' ? require('./TrackItem') : {});
const TrackSwipeControllerRef = _TrackItemDetail.TrackSwipeController || (typeof TrackSwipeController !== 'undefined' ? TrackSwipeController : null);
const renderSwipeRevealLayerRef = _TrackItemDetail.renderSwipeRevealLayer || (typeof renderSwipeRevealLayer !== 'undefined' ? renderSwipeRevealLayer : () => '');

class PlaylistDetailView {
  constructor(appContext) {
    this.app = appContext;
    this.container = null;
    this.playlist = null; // { id, name, type: 'playlist' | 'liked', trackIds, customCoverUrl }
    this.tracks = []; // Array of track objects
    this.sortedTracks = [];
    this.sortBy = 'default'; // 'default' | 'recent' | 'title' | 'artist' | 'album' | 'duration'
    this.userName = 'Yuri';
    this.ROW_HEIGHT = 56;
    this.OVERSCAN = 8;
    this.virtualStartIndex = 0;
    this.virtualEndIndex = 0;
    this._scrollRaf = null;
  }

  mount(containerElement) {
    this.container = containerElement;
    this.container.className = 'playlist-detail-view-container';
    this.container.style.display = 'none';
  }

  /**
   * Opens and renders a user playlist or Liked Songs.
   * @param {Object} playlist
   */
  async loadPlaylist(playlist) {
    if (!playlist) return;
    this.playlist = playlist;
    this.sortBy = 'default';

    if (playlist.type === 'liked' || playlist.id === 'liked') {
      await this._loadLikedSongs();
    } else if (playlist.type === 'album') {
      await this._loadAlbumTracks();
    } else {
      await this._loadPlaylistTracks();
    }

    this._applySort();
    this.render();
  }

  async _loadLikedSongs() {
    this.playlist = {
      id: 'liked',
      type: 'liked',
      name: 'Músicas Curtidas',
      isLikedSongs: true
    };

    let allTracks = [];
    if (typeof window !== 'undefined' && window.api?.getTracks) {
      try {
        allTracks = await window.api.getTracks();
      } catch (e) {
        allTracks = [];
      }
    } else if (Array.isArray(this.app.views?.recent?.tracks)) {
      allTracks = this.app.views.recent.tracks;
    }

    const favSet = this.app.favoritesSet || new Set();
    this.tracks = (allTracks || []).filter(t => favSet.has(t.filePath));
  }

  async _loadAlbumTracks() {
    if (Array.isArray(this.playlist.tracks) && this.playlist.tracks.length > 0) {
      this.tracks = [...this.playlist.tracks];
      return;
    }
    let allTracks = [];
    if (typeof window !== 'undefined' && window.api?.getTracks) {
      try {
        allTracks = await window.api.getTracks();
      } catch (e) {
        allTracks = [];
      }
    } else if (Array.isArray(this.app.views?.recent?.tracks)) {
      allTracks = this.app.views.recent.tracks;
    }
    const albumName = (this.playlist.name || '').trim().toLowerCase();
    this.tracks = (allTracks || []).filter(t => (t.album || '').trim().toLowerCase() === albumName);
  }

  async _loadPlaylistTracks() {
    let tracks = [];
    if (typeof window !== 'undefined' && window.api?.getPlaylistTracks) {
      try {
        tracks = await window.api.getPlaylistTracks(this.playlist.id);
      } catch (e) {
        console.warn('[PlaylistDetailView] Error loading playlist tracks:', e);
        tracks = [];
      }
    }
    this.tracks = Array.isArray(tracks) ? tracks : [];
  }

  _applySort() {
    const list = [...this.tracks];
    switch (this.sortBy) {
      case 'recent':
        list.sort((a, b) => (b.added_at || 0) - (a.added_at || 0));
        break;
      case 'title':
        list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'artist':
        list.sort((a, b) => (a.artist || '').localeCompare(b.artist || ''));
        break;
      case 'album':
        list.sort((a, b) => (a.album || '').localeCompare(b.album || ''));
        break;
      case 'duration':
        list.sort((a, b) => (b.duration || 0) - (a.duration || 0));
        break;
      case 'default':
      default:
        // Preserves playlist indexed sequence
        break;
    }
    this.sortedTracks = list;
  }

  render() {
    if (!this.container) return;

    const isLiked = this.playlist?.type === 'liked' || this.playlist?.id === 'liked';
    const isAlbum = this.playlist?.type === 'album';
    const totalTracks = this.sortedTracks.length;
    const durationAggregate = this._formatAggregateDuration(this.sortedTracks);
    const coverMarkup = this._getHeroCoverHtml(isLiked, isAlbum);

    const isShuffleActive = Boolean(this.app.queueManager?.shuffle);
    const isPlayingThis = this._isPlaylistPlaying();

    const tagText = isAlbum ? 'Álbum' : 'Playlist';
    const authorLineHtml = isAlbum
      ? `
        <span class="playlist-author-name" style="font-weight: 700;">${this._escapeHtml(this.playlist?.artist || 'Vários Artistas')}</span>
        ${this.playlist?.year ? `<span class="meta-bullet">•</span><span class="playlist-author-name">${this._escapeHtml(String(this.playlist.year))}</span>` : ''}
        <span class="meta-bullet">•</span>
        <span class="playlist-count-label">${totalTracks} música${totalTracks === 1 ? '' : 's'}</span>
        ${durationAggregate ? `<span class="meta-bullet">•</span><span class="playlist-duration-label">${durationAggregate}</span>` : ''}
      `
      : `
        <div class="playlist-author-avatar">
          <span>${this.userName.charAt(0).toUpperCase()}</span>
        </div>
        <span class="playlist-author-name">${this.userName}</span>
        <span class="meta-bullet">•</span>
        <span class="playlist-count-label">${totalTracks} música${totalTracks === 1 ? '' : 's'}</span>
        ${durationAggregate ? `<span class="meta-bullet">•</span><span class="playlist-duration-label">${durationAggregate}</span>` : ''}
      `;

    this.container.innerHTML = `
      <div class="playlist-detail-scrollable">
        <!-- Hero Header -->
        <div class="playlist-hero-header ${isLiked ? 'hero-liked-songs' : ''}">
          <div class="playlist-hero-content">
            <div class="playlist-hero-cover-wrap">
              ${coverMarkup}
            </div>
            <div class="playlist-hero-meta">
              <span class="playlist-badge-tag">${tagText}</span>
              <h1 class="playlist-title-headline" title="${this._escapeHtml(this.playlist?.name || 'Playlist')}">
                ${this._escapeHtml(this.playlist?.name || 'Playlist')}
              </h1>
              <div class="playlist-author-line">
                ${authorLineHtml}
              </div>
            </div>
          </div>
        </div>

        <!-- Action Bar -->
        <div class="playlist-action-bar">
          <div class="action-bar-left">
            <button class="btn-playlist-play-main ${isPlayingThis ? 'playing' : ''}" id="btn-playlist-play-main" title="${isPlayingThis ? 'Pausar playlist' : 'Tocar playlist'}">
              ${isPlayingThis ? `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16"></rect>
                  <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
              ` : `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="8 5 19 12 8 19"></polygon>
                </svg>
              `}
            </button>
            <button class="btn-playlist-action-icon btn-playlist-shuffle ${isShuffleActive ? 'active' : ''}" id="btn-playlist-shuffle" title="Modo Aleatório">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="16 3 21 3 21 8"></polyline>
                <line x1="4" y1="20" x2="21" y2="3"></line>
                <polyline points="21 16 21 21 16 21"></polyline>
                <line x1="15" y1="15" x2="21" y2="21"></line>
                <line x1="4" y1="4" x2="9" y2="9"></line>
              </svg>
            </button>
            <button class="btn-playlist-action-icon btn-playlist-download" id="btn-playlist-download" title="Disponível offline">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="8 12 12 16 16 12"></polyline>
                <line x1="12" y1="8" x2="12" y2="16"></line>
              </svg>
            </button>
          </div>

          <div class="action-bar-right">
            <div class="playlist-sort-dropdown-wrap">
              <label for="playlist-sort-select-detail" class="playlist-sort-label">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="12" x2="15" y2="12"></line>
                  <line x1="3" y1="18" x2="9" y2="18"></line>
                </svg>
                <span>Ordem:</span>
              </label>
              <select id="playlist-sort-select-detail" class="playlist-sort-select">
                <option value="default" ${this.sortBy === 'default' ? 'selected' : ''}>Ordem personalizada</option>
                <option value="recent" ${this.sortBy === 'recent' ? 'selected' : ''}>Adicionadas recentemente</option>
                <option value="title" ${this.sortBy === 'title' ? 'selected' : ''}>Título</option>
                <option value="artist" ${this.sortBy === 'artist' ? 'selected' : ''}>Artista</option>
                <option value="album" ${this.sortBy === 'album' ? 'selected' : ''}>Álbum</option>
                <option value="duration" ${this.sortBy === 'duration' ? 'selected' : ''}>Duração</option>
              </select>
            </div>
          </div>
        </div>

        <!-- 5-Column Tracklist Table Header & Body -->
        <div class="playlist-table-container">
          <div class="spotify-table-header">
            <div class="col-header col-idx">#</div>
            <div class="col-header col-title-head">Título</div>
            <div class="col-header col-album-head">Álbum</div>
            <div class="col-header col-date-head">Data de adição</div>
            <div class="col-header col-duration-head" title="Duração">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
          </div>

          <div class="spotify-table-body" id="playlist-table-rows">
            ${this._renderTableRows()}
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _getHeroCoverHtml(isLiked, isAlbum) {
    if (isLiked) {
      return `
        <div class="hero-cover-liked-gradient">
          <svg width="72" height="72" viewBox="0 0 24 24" fill="#ffffff">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </div>
      `;
    }

    if (isAlbum) {
      if (this.playlist?.coverDataUrl) {
        return `<img src="${this.playlist.coverDataUrl}" alt="Capa do álbum" class="hero-cover-img">`;
      }
      const trackWithCover = (this.tracks || []).find(t => t.coverDataUrl);
      if (trackWithCover) {
        return `<img src="${trackWithCover.coverDataUrl}" alt="Capa do álbum" class="hero-cover-img">`;
      }
    }

    if (this.playlist?.customCoverUrl) {
      return `<img src="${this.playlist.customCoverUrl}" alt="Capa da playlist" class="hero-cover-img">`;
    }

    if (_PlaylistCoverServiceDetail) {
      return _PlaylistCoverServiceDetail.getCoverHtml(this.playlist, this.tracks);
    }

    return `
      <div class="hero-cover-fallback">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M9 18V5l12-2v13"></path>
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="16" r="3"></circle>
        </svg>
      </div>
    `;
  }

  _renderTableContainer() {
    if (this.sortedTracks.length === 0) {
      return `
        <div class="playlist-empty-table-state">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 12px; opacity: 0.6;">
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
          </svg>
          <div style="font-size: 1.1rem; font-weight: 700; color: #ffffff;">Esta playlist está vazia</div>
          <div style="font-size: 0.85rem; color: #a7a7a7; margin-top: 4px;">Adicione faixas locais através da biblioteca ou da busca.</div>
        </div>
      `;
    }

    const totalHeight = this.sortedTracks.length * this.ROW_HEIGHT;
    this.virtualStartIndex = 0;
    this.virtualEndIndex = Math.min(this.sortedTracks.length, 30);
    const offsetY = 0;

    return `
      <div class="spotify-table-phantom" id="spotify-table-phantom" style="height: ${totalHeight}px; position: relative; width: 100%;">
        <div class="spotify-table-window" id="spotify-table-window" style="position: absolute; top: 0; left: 0; right: 0; transform: translateY(${offsetY}px); will-change: transform;">
          ${this._renderRowsSlice(this.virtualStartIndex, this.virtualEndIndex)}
        </div>
      </div>
    `;
  }

  _renderTableRows() {
    return this._renderTableContainer();
  }

  _renderRowsSlice(startIndex, endIndex) {
    const currentTrack = this.app.queueManager?.getCurrentTrack();
    const isPlaying = Boolean(this.app.audioEngine?.isPlaying);
    const slice = this.sortedTracks.slice(startIndex, endIndex);

    return slice.map((track, i) => {
      const realIdx = startIndex + i;
      const isCurrent = Boolean(currentTrack && currentTrack.filePath === track.filePath);
      const isFav = this.app.isFavorite ? this.app.isFavorite(track.filePath) : false;
      const durationStr = this._formatTrackDuration(track.duration);
      const dateAddedStr = this._formatDateAdded(track.added_at);

      const coverImg = track.coverDataUrl
        ? `<img src="${track.coverDataUrl}" alt="Capa" class="track-thumb-img" loading="lazy" decoding="async">`
        : `<div class="track-thumb-fallback"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div>`;

      return `
        <div class="track-virtual-item" data-index="${realIdx}">
          ${renderSwipeRevealLayerRef()}
          <div class="spotify-track-row ${isCurrent ? 'playing' : ''} ${isCurrent && !isPlaying ? 'paused' : ''}" data-index="${realIdx}" data-filepath="${this._escapeHtml(track.filePath)}">
            <!-- Col 1: Index / Play Button -->
            <div class="col-cell col-idx">
              <span class="row-num-text ${isCurrent ? 'active-green' : ''}">${realIdx + 1}</span>
              <button class="row-play-trigger" title="Tocar ${this._escapeHtml(track.title || '')}" data-index="${realIdx}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="6 4 20 12 6 20 6 4"></polygon>
                </svg>
              </button>
              ${isCurrent ? `
                <div class="row-eq-bars">
                  <span class="eq-bar"></span>
                  <span class="eq-bar"></span>
                  <span class="eq-bar"></span>
                  <span class="eq-bar"></span>
                </div>
              ` : ''}
            </div>

            <!-- Col 2: Title & Artist with Thumbnail -->
            <div class="col-cell col-title-cell">
              <div class="track-thumb-container">
                ${coverImg}
              </div>
              <div class="track-text-meta">
                <span class="track-primary-title ${isCurrent ? 'active-green' : ''}" title="${this._escapeHtml(track.title || '')}">
                  ${this._escapeHtml(track.title || 'Sem título')}
                </span>
                <span class="track-secondary-artist" title="${this._escapeHtml(track.artist || '')}">
                  ${this._escapeHtml(track.artist || 'Artista desconhecido')}
                </span>
              </div>
            </div>

            <!-- Col 3: Album -->
            <div class="col-cell col-album-cell" title="${this._escapeHtml(track.album || '')}">
              <span>${this._escapeHtml(track.album || '—')}</span>
            </div>

            <!-- Col 4: Date Added -->
            <div class="col-cell col-date-cell">
              <span>${dateAddedStr}</span>
            </div>

            <!-- Col 5: Duration & Spotify Checkmark Badge -->
            <div class="col-cell col-duration-cell">
              <button class="btn-row-fav spotify-badge-btn ${isFav ? 'active' : ''}" title="${isFav ? 'Salvo em Músicas Curtidas' : 'Salvar em Músicas Curtidas'}" data-filepath="${this._escapeHtml(track.filePath)}">
                ${isFav ? `
                  <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="#1ed760"/><path d="M11.5 5.5L6.8 10.5L4.5 8.2" stroke="#000000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
                ` : `
                  <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7.25" stroke="#a7a7a7" stroke-width="1.5" fill="none"/><path d="M8 5v6M5 8h6" stroke="#a7a7a7" stroke-width="1.5" stroke-linecap="round"/></svg>
                `}
              </button>
              <span class="row-duration-text">${durationStr}</span>
              <button class="btn-row-more" title="Mais opções" data-index="${realIdx}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="2"></circle>
                  <circle cx="19" cy="12" r="2"></circle>
                  <circle cx="5" cy="12" r="2"></circle>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  _onScrollVirtual() {
    const scrollContainer = this.container?.querySelector ? this.container.querySelector('.playlist-detail-scrollable') : null;
    const tableBody = this.container?.querySelector ? this.container.querySelector('#playlist-table-rows') : null;
    const windowEl = this.container?.querySelector ? this.container.querySelector('#spotify-table-window') : null;
    if (!scrollContainer || !tableBody || !windowEl || this.sortedTracks.length === 0) return;

    const tableOffsetTop = tableBody.offsetTop || 0;
    const scrollTop = Math.max(0, scrollContainer.scrollTop - tableOffsetTop);
    const viewportHeight = scrollContainer.clientHeight || 800;

    const startIndex = Math.max(0, Math.floor(scrollTop / this.ROW_HEIGHT) - this.OVERSCAN);
    const endIndex = Math.min(this.sortedTracks.length, Math.ceil((scrollTop + viewportHeight) / this.ROW_HEIGHT) + this.OVERSCAN);

    if (startIndex !== this.virtualStartIndex || endIndex !== this.virtualEndIndex) {
      this.virtualStartIndex = startIndex;
      this.virtualEndIndex = endIndex;
      const offsetY = startIndex * this.ROW_HEIGHT;
      windowEl.style.transform = `translateY(${offsetY}px)`;
      windowEl.innerHTML = this._renderRowsSlice(startIndex, endIndex);
    }
  }

  _bindEvents() {
    const btnPlayMain = this.container?.querySelector ? this.container.querySelector('#btn-playlist-play-main') : null;
    const btnShuffle = this.container?.querySelector ? this.container.querySelector('#btn-playlist-shuffle') : null;
    const sortSelect = this.container?.querySelector ? this.container.querySelector('#playlist-sort-select-detail') : null;
    const scrollContainer = this.container?.querySelector ? this.container.querySelector('.playlist-detail-scrollable') : null;
    const rowsContainer = this.container?.querySelector ? this.container.querySelector('#playlist-table-rows') : null;

    // Attach passive scroll listener for 60fps windowing
    scrollContainer?.addEventListener('scroll', () => {
      if (this._scrollRaf) cancelAnimationFrame(this._scrollRaf);
      this._scrollRaf = requestAnimationFrame(() => this._onScrollVirtual());
    }, { passive: true });

    // Big play button: toggle play/pause for this playlist
    btnPlayMain?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.sortedTracks.length === 0) return;

      if (this._isPlaylistPlaying()) {
        this.app.audioEngine?.pause();
      } else {
        this.app.setQueueAndPlay(this.sortedTracks, 0);
      }
      this._updatePlayButtonState();
    });

    // Shuffle toggle button
    btnShuffle?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.app.queueManager) {
        const nextShuffle = !this.app.queueManager.shuffle;
        this.app.queueManager.setShuffle(nextShuffle);
        btnShuffle.classList.toggle('active', nextShuffle);
        this.app.showToast(nextShuffle ? 'Modo aleatório ativado' : 'Modo aleatório desativado');
      }
    });

    // Sort select change
    sortSelect?.addEventListener('change', (e) => {
      this.sortBy = e.target.value;
      this._applySort();
      const rowsEl = this.container?.querySelector ? this.container.querySelector('#playlist-table-rows') : null;
      if (rowsEl) {
        rowsEl.innerHTML = this._renderTableContainer();
        this._onScrollVirtual();
      }
    });

    if (rowsContainer) {
      this._bindTableDelegation(rowsContainer);
    }
  }

  _bindTableDelegation(rowsContainer) {
    if (!rowsContainer) return;

    // 1. Delegated Double-Click: play track
    rowsContainer.addEventListener('dblclick', (e) => {
      const row = e.target.closest('.spotify-track-row');
      if (!row || row._justSwiped) return;
      const idx = parseInt(row.dataset.index, 10);
      const track = this.sortedTracks[idx];
      if (track) {
        this.app.playTrackDirectly(track, this.sortedTracks, idx);
      }
    });

    // 2. Delegated Click: triggers, favorites, menus
    rowsContainer.addEventListener('click', async (e) => {
      const row = e.target.closest('.spotify-track-row');
      if (row && row._justSwiped) return;

      // Click on row play trigger button
      const playBtn = e.target.closest('.row-play-trigger');
      if (playBtn) {
        e.stopPropagation();
        const idx = parseInt(playBtn.dataset.index, 10);
        const track = this.sortedTracks[idx];
        if (track) {
          this.app.playTrackDirectly(track, this.sortedTracks, idx);
        }
        return;
      }

      // Click on favorite button
      const favBtn = e.target.closest('.btn-row-fav');
      if (favBtn) {
        e.stopPropagation();
        const row = favBtn.closest('.spotify-track-row');
        const idx = parseInt(row?.dataset.index, 10);
        const track = this.sortedTracks[idx];
        if (track) {
          await this._handleToggleFavorite(favBtn, track);
        }
        return;
      }

      // Click on more options menu
      const moreBtn = e.target.closest('.btn-row-more');
      if (moreBtn) {
        e.stopPropagation();
        const idx = parseInt(moreBtn.dataset.index, 10);
        const track = this.sortedTracks[idx];
        if (track) {
          this._openContextMenu(track, e.clientX, e.clientY);
        }
        return;
      }
    });

    // 3. Swipe-to-action gesture controller
    if (this._swipeController) {
      this._swipeController.detach();
      this._swipeController = null;
    }
    if (TrackSwipeControllerRef) {
      this._swipeController = new TrackSwipeControllerRef({
        container: rowsContainer,
        getTrackByIndex: (idx) => this.sortedTracks[idx],
        onPlayNext: (track) => {
          if (typeof this.app.queueManager?.addTrackPlayNext === 'function') {
            this.app.queueManager.addTrackPlayNext(track);
          } else {
            this.app.queueManager?.addTrack(track);
          }
          this.app.showToast(`Tocar a seguir: ${track.title || 'Faixa'}`);
        }
      });
    }
  }

  async _handleToggleFavorite(favBtn, track) {
    if (this.app.toggleFavorite) {
      const isNowFav = await this.app.toggleFavorite(track.filePath);
      favBtn.classList.toggle('active', isNowFav);
      favBtn.title = isNowFav ? 'Salvo em Músicas Curtidas' : 'Salvar em Músicas Curtidas';
      favBtn.innerHTML = isNowFav
        ? `<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="#1ed760"/><path d="M11.5 5.5L6.8 10.5L4.5 8.2" stroke="#000000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`
        : `<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7.25" stroke="#a7a7a7" stroke-width="1.5" fill="none"/><path d="M8 5v6M5 8h6" stroke="#a7a7a7" stroke-width="1.5" stroke-linecap="round"/></svg>`;

      if (this.playlist?.isLikedSongs && !isNowFav) {
        this.tracks = this.tracks.filter(t => t.filePath !== track.filePath);
        this._applySort();
        const rowsEl = this.container?.querySelector ? this.container.querySelector('#playlist-table-rows') : null;
        if (rowsEl) {
          rowsEl.innerHTML = this._renderTableContainer();
          this._onScrollVirtual();
        }
      }
    } else if (typeof window !== 'undefined' && window.api?.toggleFavorite) {
      const res = await window.api.toggleFavorite(track.filePath);
      if (this.app.syncFavorites) {
        this.app.syncFavorites(res.favorites);
      }
      favBtn.classList.toggle('active', res.isFavorite);
      favBtn.title = res.isFavorite ? 'Salvo em Músicas Curtidas' : 'Salvar em Músicas Curtidas';
      favBtn.innerHTML = res.isFavorite
        ? `<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="#1ed760"/><path d="M11.5 5.5L6.8 10.5L4.5 8.2" stroke="#000000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`
        : `<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7.25" stroke="#a7a7a7" stroke-width="1.5" fill="none"/><path d="M8 5v6M5 8h6" stroke="#a7a7a7" stroke-width="1.5" stroke-linecap="round"/></svg>`;

      if (this.playlist?.isLikedSongs && !res.isFavorite) {
        this.tracks = this.tracks.filter(t => t.filePath !== track.filePath);
        this._applySort();
        const rowsEl = this.container?.querySelector ? this.container.querySelector('#playlist-table-rows') : null;
        if (rowsEl) {
          rowsEl.innerHTML = this._renderTableContainer();
          this._onScrollVirtual();
        }
      }
    }
  }

  _bindRowEvents() {
    // Retained for backwards-compatibility; events are handled by _bindTableDelegation
  }

  _openContextMenu(track, x, y) {
    const old = document.getElementById('playlist-context-menu');
    if (old) old.remove();

    const menu = document.createElement('div');
    menu.id = 'playlist-context-menu';
    menu.className = 'track-context-menu';
    menu.style.left = `${Math.min(x, window.innerWidth - 180)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - 150)}px`;

    menu.innerHTML = `
      <div class="menu-item" id="ctx-play-next">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>
        Tocar a seguir
      </div>
      <div class="menu-item" id="ctx-add-queue">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        Adicionar à fila
      </div>
      <div class="menu-item" id="ctx-add-playlist">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path></svg>
        Adicionar a outra playlist
      </div>
      ${!this.playlist?.isLikedSongs ? `
        <div class="menu-item menu-item-danger" id="ctx-remove-pl">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          Remover desta playlist
        </div>
      ` : ''}
    `;

    document.body.appendChild(menu);

    const cleanup = () => menu.remove();
    setTimeout(() => {
      window.addEventListener('click', cleanup, { once: true });
    }, 10);

    menu.querySelector('#ctx-play-next')?.addEventListener('click', () => {
      this.app.queueManager?.addTrackPlayNext(track);
      this.app.showToast('Faixa adicionada para tocar a seguir');
    });

    menu.querySelector('#ctx-add-queue')?.addEventListener('click', () => {
      this.app.queueManager?.addTrack(track);
      this.app.showToast('Faixa adicionada à fila');
    });

    menu.querySelector('#ctx-add-playlist')?.addEventListener('click', () => {
      if (this.app.openAddToPlaylistModal) {
        this.app.openAddToPlaylistModal(track);
      }
    });

    menu.querySelector('#ctx-remove-pl')?.addEventListener('click', async () => {
      if (!this.playlist?.id || this.playlist.isLikedSongs) return;
      const idx = this.tracks.findIndex(t => t.filePath === track.filePath);
      if (idx !== -1 && window.api?.removeTrackFromPlaylist) {
        await window.api.removeTrackFromPlaylist(this.playlist.id, idx);
        this.tracks.splice(idx, 1);
        this._applySort();
        const rowsEl = this.container.querySelector('#playlist-table-rows');
        if (rowsEl) rowsEl.innerHTML = this._renderTableRows();
        this._bindRowEvents();
        this.app.showToast('Faixa removida da playlist');
      }
    });
  }

  _isPlaylistPlaying() {
    if (!this.app.audioEngine?.isPlaying) return false;
    const current = this.app.queueManager?.getCurrentTrack();
    if (!current) return false;
    return this.sortedTracks.some(t => t.filePath === current.filePath);
  }

  _updatePlayButtonState() {
    const btn = this.container?.querySelector('#btn-playlist-play-main');
    if (!btn) return;
    const isPlayingThis = this._isPlaylistPlaying();
    btn.classList.toggle('playing', isPlayingThis);
    btn.setAttribute('title', isPlayingThis ? 'Pausar playlist' : 'Tocar playlist');
    btn.innerHTML = isPlayingThis ? `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="4" width="4" height="16"></rect>
        <rect x="14" y="4" width="4" height="16"></rect>
      </svg>
    ` : `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="8 5 19 12 8 19"></polygon>
      </svg>
    `;
  }

  updatePlayingState() {
    if (!this.container) return;
    this._updatePlayButtonState();

    const currentTrack = this.app.queueManager?.getCurrentTrack();
    const isPlaying = Boolean(this.app.audioEngine?.isPlaying);

    this.container.querySelectorAll('.spotify-track-row').forEach(row => {
      const filePath = row.dataset.filepath;
      const isCurrent = Boolean(currentTrack && currentTrack.filePath === filePath);

      row.classList.toggle('playing', isCurrent);
      row.classList.toggle('paused', isCurrent && !isPlaying);

      const titleEl = row.querySelector('.track-primary-title');
      const numText = row.querySelector('.row-num-text');
      if (titleEl) titleEl.classList.toggle('active-green', isCurrent);
      if (numText) numText.classList.toggle('active-green', isCurrent);

      const idxCell = row.querySelector('.col-idx');
      let eqBars = row.querySelector('.row-eq-bars');

      if (isCurrent && isPlaying) {
        if (!eqBars && idxCell) {
          eqBars = document.createElement('div');
          eqBars.className = 'row-eq-bars';
          eqBars.innerHTML = `
            <span class="eq-bar"></span>
            <span class="eq-bar"></span>
            <span class="eq-bar"></span>
            <span class="eq-bar"></span>
          `;
          idxCell.appendChild(eqBars);
        }
      } else {
        if (eqBars) eqBars.remove();
      }
    });
  }

  _formatAggregateDuration(tracks) {
    if (!Array.isArray(tracks) || tracks.length === 0) return '';
    const totalSec = tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
    if (totalSec <= 0) return '';

    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = Math.floor(totalSec % 60);

    if (hours > 0) {
      return `${hours} hr ${minutes} min`;
    }
    if (minutes > 0) {
      return `${minutes} min ${seconds} s`;
    }
    return `${seconds} s`;
  }

  _formatTrackDuration(duration) {
    if (!duration || isNaN(duration) || duration <= 0) return '0:00';
    const mins = Math.floor(duration / 60);
    const secs = Math.floor(duration % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  _formatDateAdded(timestamp) {
    if (!timestamp) return '—';
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Hoje';
      if (diffDays === 1) return 'Ontem';
      if (diffDays < 7) return `há ${diffDays} dias`;
      if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `há ${weeks} semana${weeks === 1 ? '' : 's'}`;
      }

      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return '—';
    }
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
  module.exports = PlaylistDetailView;
}
if (typeof window !== 'undefined') {
  window.PlaylistDetailView = PlaylistDetailView;
}
