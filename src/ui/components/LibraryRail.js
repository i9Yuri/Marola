const _PlaylistCoverServiceRail = typeof PlaylistCoverService !== 'undefined'
  ? PlaylistCoverService
  : (typeof require !== 'undefined' ? require('../../services/playlistCoverService') : null);

class LibraryRail {
  constructor(appContext, options = {}) {
    this.app = appContext;
    this.options = {
      onSelectLikedSongs: options.onSelectLikedSongs || (() => {}),
      onSelectPlaylist: options.onSelectPlaylist || (() => {}),
      onCreatePlaylist: options.onCreatePlaylist || (() => {}),
      onOpenLibrary: options.onOpenLibrary || (() => {})
    };
    this.container = null;
    this.playlists = [];
    this.activeId = 'library'; // 'library' | 'liked' | playlistId
    this.activeItemId = 'library';
  }

  mount(containerElement) {
    this.container = containerElement;
    this.render();
    this.loadPlaylists();
  }

  async loadPlaylists() {
    try {
      if (typeof window !== 'undefined' && window.api?.getPlaylists) {
        const pls = await window.api.getPlaylists();
        this.playlists = Array.isArray(pls) ? pls : [];
        this._renderItems();
      }
    } catch (e) {
      console.warn('[LibraryRail] Failed to load playlists:', e);
    }
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <aside class="library-rail-container">
        <div class="rail-header">
          <button class="rail-icon-btn ${this.activeId === 'library' ? 'active' : ''}" id="rail-btn-library" title="Sua Biblioteca">
            <!-- Three vertical books/shelf icon -->
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              <line x1="8" y1="6" x2="16" y2="6"></line>
              <line x1="8" y1="10" x2="16" y2="10"></line>
            </svg>
          </button>
          <button class="rail-icon-btn" id="rail-btn-create" title="Criar playlist / Adicionar músicas">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>

        <div class="rail-items-scroll" id="rail-items-scroll">
          <!-- Liked songs & Playlists injected here -->
        </div>
      </aside>
    `;

    this._bindEvents();
    this._renderItems();
  }

  _bindEvents() {
    const btnLib = this.container.querySelector('#rail-btn-library');
    const btnCreate = this.container.querySelector('#rail-btn-create');

    btnLib?.addEventListener('click', () => {
      this.activeId = 'library';
      this.options.onOpenLibrary();
      this._updateActiveStyles();
    });

    btnCreate?.addEventListener('click', () => {
      this.options.onCreatePlaylist();
    });
  }

  _renderItems() {
    const scrollEl = this.container?.querySelector('#rail-items-scroll');
    if (!scrollEl) return;

    let html = `
      <!-- Liked Songs Square -->
      <div class="rail-thumb-item ${this.activeId === 'liked' ? 'active' : ''}" data-id="liked" title="Músicas Curtidas">
        <div class="rail-thumb-liked">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </div>
      </div>
    `;

    this.playlists.forEach(pl => {
      const isPlActive = this.activeId === pl.id;
      const initials = (pl.name || 'PL').slice(0, 2).toUpperCase();
      const count = pl.trackIds?.length || 0;
      const tooltip = `${this._escapeHtml(pl.name)} (${count} faixa${count === 1 ? '' : 's'})`;

      html += `
        <div class="rail-thumb-item ${isPlActive ? 'active' : ''}" data-id="${pl.id}" title="${tooltip}">
          <div class="rail-thumb-pl" id="rail-thumb-pl-${pl.id}">
            <span>${initials}</span>
          </div>
        </div>
      `;
    });

    scrollEl.innerHTML = html;

    // Asynchronously update thumbnails with dynamic covers
    this.playlists.forEach(async (pl) => {
      if (typeof window !== 'undefined' && window.api?.getPlaylistTracks) {
        try {
          const tracks = await window.api.getPlaylistTracks(pl.id);
          const thumbEl = scrollEl.querySelector(`#rail-thumb-pl-${pl.id}`);
          if (thumbEl && tracks && tracks.length > 0 && _PlaylistCoverServiceRail) {
            thumbEl.innerHTML = _PlaylistCoverServiceRail.getCoverHtml(pl, tracks);
          }
        } catch (e) {}
      }
    });

    // Attach click handlers
    scrollEl.querySelectorAll('.rail-thumb-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        this.activeId = id;
        this._updateActiveStyles();

        if (id === 'liked') {
          this.options.onSelectLikedSongs();
        } else {
          const pl = this.playlists.find(p => p.id === id);
          if (pl) this.options.onSelectPlaylist(pl);
        }
      });
    });
  }

  _updateActiveStyles() {
    if (!this.container) return;
    const btnLib = this.container.querySelector('#rail-btn-library');
    if (btnLib) btnLib.classList.toggle('active', this.activeId === 'library');

    this.container.querySelectorAll('.rail-thumb-item').forEach(item => {
      item.classList.toggle('active', item.dataset.id === this.activeId);
    });
  }

  setActive(id) {
    this.activeId = id;
    this.activeItemId = id;
    this._updateActiveStyles();
  }

  setActiveItem(id) {
    this.setActive(id);
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
  module.exports = LibraryRail;
}
