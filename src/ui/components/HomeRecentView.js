/**
 * HomeRecentView: Modern Spotify-style central view with category filter pills,
 * 2x3 quick-access grid, recent albums/tracks cards row, and full TrackList table.
 * Strictly free of commercial advertisement banners.
 */
const _TrackListHome = typeof TrackList !== 'undefined'
  ? TrackList
  : (typeof require !== 'undefined' ? require('./TrackList') : null);

const _PlaylistCoverServiceHome = typeof PlaylistCoverService !== 'undefined'
  ? PlaylistCoverService
  : (typeof require !== 'undefined' ? require('../../services/playlistCoverService') : null);

class HomeRecentView {
  constructor(appContext) {
    this.app = appContext;
    this.tracks = [];
    this.filteredTracks = [];
    this.playlists = [];
    this.container = null;
    this.searchTerm = '';
    this.activeCategory = 'all'; // 'all' | 'music' | 'artists' | 'albums' | 'playlists'
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
          <button class="pill-chip ${this.activeCategory === 'artists' ? 'active' : ''}" data-cat="artists">Artistas</button>
          <button class="pill-chip ${this.activeCategory === 'albums' ? 'active' : ''}" data-cat="albums">Álbuns</button>
          <button class="pill-chip ${this.activeCategory === 'playlists' ? 'active' : ''}" data-cat="playlists">Listas & Playlists</button>
        </div>

        <!-- 2x4 Quick Access Grid -->
        <div class="quick-access-grid" id="quick-access-grid">
          <!-- Up to 8 quick cards rendered dynamically -->
        </div>

        <!-- Section 1: Músicas Mais Ouvidas (Ranked Carousel) -->
        <div class="home-section-container" id="section-top-tracks">
          <div class="home-section-header">
            <h2 class="home-section-title">Músicas Mais Ouvidas</h2>
          </div>
          <div class="horizontal-carousel-row" id="top-tracks-carousel">
            <!-- Top tracks cards rendered here -->
          </div>
        </div>

        <!-- Section 2: Artistas em Destaque (Circular Avatar Carousel) -->
        <div class="home-section-container" id="section-artists">
          <div class="home-section-header">
            <h2 class="home-section-title">Artistas em Destaque</h2>
          </div>
          <div class="horizontal-carousel-row" id="artists-carousel">
            <!-- Circular artist cards rendered here -->
          </div>
        </div>

        <!-- Section 3: Álbuns (Square Cover Carousel) -->
        <div class="home-section-container" id="section-albums">
          <div class="home-section-header">
            <h2 class="home-section-title">Álbuns</h2>
          </div>
          <div class="horizontal-carousel-row" id="albums-carousel">
            <!-- Album cards rendered here -->
          </div>
        </div>

        <!-- Section 4: Cards Carousel / Grid -->
        <div class="home-section-container" id="section-recent-carousel">
          <div class="home-section-header">
            <h2 class="home-section-title">Tocadas recentemente & Destaques</h2>
            <button class="home-show-all-btn" id="btn-show-all-recent">Mostrar tudo</button>
          </div>
          <div class="horizontal-carousel-row" id="cards-carousel-row">
            <!-- Vertical album/track cards rendered here -->
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
    this._renderQuickGrid();
    this._renderTopTracksCarousel();
    this._renderArtistsCarousel();
    this._renderAlbumsCarousel();
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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </div>
      `,
      onNavigate: () => {
        if (this.app.openLikedSongs) {
          this.app.openLikedSongs();
        }
      },
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

    // Card 2: Todas as Músicas da Biblioteca
    cards.push({
      id: 'all-tracks',
      type: 'all-tracks',
      title: 'Todas as Músicas',
      subtitle: `${this.tracks.length} músicas`,
      coverHtml: `
        <div class="quick-card-cover-all-tracks">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
          </svg>
        </div>
      `,
      onNavigate: () => {
        if (this.app.openAllTracks) {
          this.app.openAllTracks();
        }
      },
      onPlay: () => {
        if (this.tracks.length > 0) {
          this.app.setQueueAndPlay(this.tracks, 0);
        } else {
          this.app.showToast('Nenhuma música encontrada.');
        }
      }
    });

    // Cards: User playlists (up to 6 to fill 2x4 grid)
    this.playlists.slice(0, 6).forEach(pl => {
      const count = pl.trackIds ? pl.trackIds.length : 0;
      const initials = (pl.name || 'PL').slice(0, 2).toUpperCase();
      cards.push({
        id: pl.id,
        type: 'playlist',
        title: pl.name || 'Playlist',
        subtitle: `${count} faixas`,
        coverHtml: `
          <div class="quick-card-cover-pl" id="qc-cover-pl-${pl.id}">
            <span>${initials}</span>
          </div>
        `,
        onNavigate: () => {
          if (this.app.openPlaylist) {
            this.app.openPlaylist(pl);
          } else {
            this.app.switchView('playlists');
            this.app.views?.playlists?.selectPlaylist(pl.id);
          }
        },
        onPlay: async () => {
          if (typeof window !== 'undefined' && window.api?.getPlaylistTracks) {
            const plTracks = await window.api.getPlaylistTracks(pl.id);
            if (plTracks.length > 0) {
              this.app.setQueueAndPlay(plTracks, 0);
            } else {
              this.app.showToast('Esta playlist está vazia.');
            }
          }
        }
      });
    });

    // If fewer than 8, fill with top albums
    if (cards.length < 8 && this.tracks.length > 0) {
      const albumsMap = new Map();
      this.tracks.forEach(t => {
        if (t.album && !albumsMap.has(t.album)) {
          albumsMap.set(t.album, t);
        }
      });

      for (const [albumName, sampleTrack] of albumsMap.entries()) {
        if (cards.length >= 8) break;
        const albumTracks = this.tracks.filter(t => t.album === albumName);
        cards.push({
          id: `album-${albumName}`,
          type: 'album',
          title: albumName,
          subtitle: `${albumTracks.length} faixas • ${sampleTrack.artist || 'Artista'}`,
          coverHtml: sampleTrack.coverDataUrl
            ? `<img src="${sampleTrack.coverDataUrl}" alt="${this._escapeHtml(albumName)}" class="quick-card-cover-img">`
            : `<div class="quick-card-cover-pl"><span>${albumName.slice(0, 2).toUpperCase()}</span></div>`,
          onNavigate: () => {
            if (this.app.openAlbum) {
              this.app.openAlbum({
                name: albumName,
                artist: sampleTrack.artist,
                year: sampleTrack.year,
                tracks: albumTracks,
                coverDataUrl: sampleTrack.coverDataUrl
              });
            } else {
              this.app.setQueueAndPlay(albumTracks, 0);
            }
          },
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
          <div class="quick-card-cover" id="quick-card-cover-${idx}">
            ${c.coverHtml}
          </div>
          <span class="quick-card-title" title="${this._escapeHtml(c.title)}">${this._escapeHtml(c.title)}</span>
          <button class="quick-card-play-btn" data-index="${idx}" title="Tocar ${this._escapeHtml(c.title)}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6 4 20 12 6 20 6 4"></polygon>
            </svg>
          </button>
        </div>
      `;
    });

    grid.innerHTML = html;

    // Asynchronously update playlist covers in quick cards with dynamic mosaic
    this.playlists.slice(0, 7).forEach(async (pl) => {
      if (typeof window !== 'undefined' && window.api?.getPlaylistTracks) {
        try {
          const tracks = await window.api.getPlaylistTracks(pl.id);
          const coverEl = grid.querySelector(`#qc-cover-pl-${pl.id}`);
          if (coverEl && tracks && tracks.length > 0 && _PlaylistCoverServiceHome) {
            coverEl.innerHTML = _PlaylistCoverServiceHome.getCoverHtml(pl, tracks);
          }
        } catch (e) {}
      }
    });

    // Wire navigation vs direct play
    grid.querySelectorAll('.quick-card').forEach(cardEl => {
      const idx = parseInt(cardEl.dataset.index, 10);
      const c = cards[idx];
      if (!c) return;

      // Card body click: Navigate to playlist/album
      cardEl.addEventListener('click', () => {
        if (c.onNavigate) c.onNavigate();
      });

      // Play button click: Start playback immediately without navigating
      const playBtn = cardEl.querySelector('.quick-card-play-btn');
      playBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (c.onPlay) c.onPlay();
      });
    });
  }

  _renderTopTracksCarousel() {
    const row = this.container?.querySelector('#top-tracks-carousel');
    const sec = this.container?.querySelector('#section-top-tracks');
    if (!row) return;

    // Filter tracks with play count > 0 sorted DESC
    const top = this.tracks
      .filter(t => (t.play_count || 0) > 0)
      .sort((a, b) => (b.play_count || 0) - (a.play_count || 0))
      .slice(0, 10);

    if (top.length === 0) {
      if (sec) sec.style.display = 'none';
      return;
    }
    if (sec) sec.style.display = 'block';

    let html = '';
    top.forEach((track, idx) => {
      const cover = track.coverDataUrl
        ? `<img src="${track.coverDataUrl}" alt="Capa" class="card-item-cover-img" loading="lazy">`
        : `<div class="card-item-cover-fallback">
             <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
           </div>`;

      html += `
        <div class="card-vertical-item" data-index="${idx}" title="${this._escapeHtml(track.title)}">
          <div class="card-rank-badge ${idx === 0 ? 'top-1' : ''}">#${idx + 1}</div>
          <div class="card-item-cover-wrap">
            ${cover}
            <button class="card-item-play-btn" title="Reproduzir">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
            </button>
          </div>
          <h4 class="card-item-title">${this._escapeHtml(track.title || 'Sem título')}</h4>
          <span class="card-item-subtitle">${track.play_count || 0} reproduç${(track.play_count === 1) ? 'ão' : 'ões'}</span>
        </div>
      `;
    });

    row.innerHTML = html;

    row.querySelectorAll('.card-vertical-item').forEach(el => {
      const idx = parseInt(el.dataset.index, 10);
      const track = top[idx];
      el.addEventListener('click', () => {
        this.app.playTrackDirectly(track, top, idx);
      });
    });
  }

  _renderArtistsCarousel() {
    const row = this.container?.querySelector('#artists-carousel');
    const sec = this.container?.querySelector('#section-artists');
    if (!row) return;

    // Group unique artists
    const artistMap = new Map();
    this.tracks.forEach(t => {
      const name = (t.artist || '').trim();
      if (!name || name.toLowerCase() === 'artista desconhecido' || name.toLowerCase() === 'unknown artist' || name.toLowerCase() === 'unknown') return;
      const key = name.toLowerCase();
      if (!artistMap.has(key)) {
        artistMap.set(key, { name, tracks: [], coverDataUrl: t.coverDataUrl });
      }
      const entry = artistMap.get(key);
      entry.tracks.push(t);
      if (!entry.coverDataUrl && t.coverDataUrl) {
        entry.coverDataUrl = t.coverDataUrl;
      }
    });

    const artists = Array.from(artistMap.values())
      .map(entry => ({
        ...entry,
        trackCount: entry.tracks.length
      }))
      .sort((a, b) => b.trackCount - a.trackCount)
      .slice(0, 10);

    if (artists.length === 0) {
      if (sec) sec.style.display = 'none';
      return;
    }
    if (sec) sec.style.display = 'block';

    let html = '';
    artists.forEach((art, idx) => {
      const avatar = art.coverDataUrl
        ? `<img src="${art.coverDataUrl}" alt="${this._escapeHtml(art.name)}" class="card-item-cover-img" loading="lazy">`
        : `<div class="card-item-cover-fallback">
             <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
           </div>`;

      const countLabel = `${art.trackCount} música${art.trackCount === 1 ? '' : 's'}`;

      html += `
        <div class="card-vertical-item artist-item" data-index="${idx}" title="${this._escapeHtml(art.name)} (${countLabel})">
          <div class="card-item-cover-wrap">
            ${avatar}
            <button class="card-item-play-btn" title="Tocar ${this._escapeHtml(art.name)}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
            </button>
          </div>
          <h4 class="card-item-title">${this._escapeHtml(art.name)}</h4>
          <span class="card-item-subtitle">${countLabel}</span>
        </div>
      `;
    });

    row.innerHTML = html;

    row.querySelectorAll('.card-vertical-item').forEach(el => {
      const idx = parseInt(el.dataset.index, 10);
      const art = artists[idx];
      if (!art) return;

      el.addEventListener('click', (e) => {
        // If play button clicked directly, play all tracks by this artist
        if (e.target.closest('.card-item-play-btn')) {
          e.stopPropagation();
          this.app.setQueueAndPlay(art.tracks, 0);
          return;
        }
        // Clicking card body filters library search by artist
        if (this.app.views?.topHeader) {
          this.app.views.topHeader.setSearchTerm(art.name);
        }
        this.setSearchTerm(art.name);
      });
    });
  }

  async _renderAlbumsCarousel() {
    const row = this.container?.querySelector('#albums-carousel');
    const sec = this.container?.querySelector('#section-albums');
    if (!row) return;

    let albums = [];
    if (typeof window !== 'undefined' && window.api?.getTopAlbumsByTrackCount) {
      try {
        albums = await window.api.getTopAlbumsByTrackCount(20);
      } catch (e) {
        albums = [];
      }
    }

    if (!albums || albums.length === 0) {
      const albumMap = new Map();
      let unknownEntry = null;

      const isUnknownAlbumName = (name) => {
        if (!name) return true;
        const lower = name.trim().toLowerCase();
        return (
          lower === '' ||
          lower === 'álbum desconhecido' ||
          lower === 'album desconhecido' ||
          lower === 'unknown album' ||
          lower === 'unknown'
        );
      };

      this.tracks.forEach(t => {
        const raw = (t.album || '').replace(/\s+/g, ' ').trim();
        const isUnknown = isUnknownAlbumName(raw);
        const name = isUnknown ? 'Álbum Desconhecido' : raw;
        const key = name.toLowerCase();

        if (!albumMap.has(key)) {
          albumMap.set(key, {
            name,
            artist: t.artist || 'Vários Artistas',
            year: t.year || null,
            tracks: [],
            coverDataUrl: t.coverDataUrl,
            isUnknown
          });
        }
        const entry = albumMap.get(key);
        entry.tracks.push(t);
        if (!entry.coverDataUrl && t.coverDataUrl) {
          entry.coverDataUrl = t.coverDataUrl;
        }
        if (!entry.year && t.year) {
          entry.year = t.year;
        }
      });

      const known = [];
      for (const entry of albumMap.values()) {
        if (entry.isUnknown) {
          unknownEntry = entry;
        } else {
          known.push(entry);
        }
      }

      known.sort((a, b) => {
        if (b.tracks.length !== a.tracks.length) {
          return b.tracks.length - a.tracks.length;
        }
        return a.name.localeCompare(b.name);
      });

      albums = known.slice(0, unknownEntry ? 19 : 20);
      if (unknownEntry) {
        albums.push(unknownEntry);
      }
    }

    if (albums.length === 0) {
      if (sec) sec.style.display = 'none';
      return;
    }
    if (sec) sec.style.display = 'block';

    let html = '';
    albums.forEach((alb, idx) => {
      const trackCount = alb.trackCount || alb.tracks?.length || 0;
      const cover = alb.coverDataUrl
        ? `<img src="${alb.coverDataUrl}" alt="${this._escapeHtml(alb.name)}" class="card-item-cover-img" loading="lazy">`
        : `<div class="card-item-cover-fallback">
             <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
           </div>`;

      html += `
        <div class="card-vertical-item album-item" data-index="${idx}" title="${this._escapeHtml(alb.name)}">
          <div class="card-item-cover-wrap">
            ${cover}
            <button class="card-item-play-btn" title="Tocar ${this._escapeHtml(alb.name)}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
            </button>
          </div>
          <h4 class="card-item-title">${this._escapeHtml(alb.name)}</h4>
          <span class="card-item-subtitle">${this._escapeHtml(alb.artist || 'Vários')} • ${trackCount} faixa${trackCount === 1 ? '' : 's'}</span>
        </div>
      `;
    });

    row.innerHTML = html;

    row.querySelectorAll('.card-vertical-item').forEach(el => {
      const idx = parseInt(el.dataset.index, 10);
      const alb = albums[idx];
      if (!alb) return;

      el.addEventListener('click', (e) => {
        if (e.target.closest('.card-item-play-btn')) {
          e.stopPropagation();
          this.app.setQueueAndPlay(alb.tracks, 0);
          return;
        }
        if (this.app.openAlbum) {
          this.app.openAlbum(alb);
        } else {
          this.app.setQueueAndPlay(alb.tracks, 0);
        }
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
        this._renderTopTracksCarousel();
        this._renderArtistsCarousel();
        this._renderAlbumsCarousel();
        this._renderCarouselCards();
        this.filterAndRender();
        return;
      }
      const res = await window.api.getRecentTracks(500);
      this.tracks = Array.isArray(res) ? res : [];

      const settings = await window.api.getSettings();
      if (typeof LibraryScanner !== 'undefined' && settings?.musicFolders?.length > 0) {
        this.tracks = LibraryScanner.filterTracksByActiveFolders(this.tracks, settings.musicFolders);
      }

      if (this.tracks.length === 0) {
        const musicFolders = settings?.musicFolders || [];
        const activeFolders = musicFolders.length > 0
          ? musicFolders.filter(f => f.enabled !== false).map(f => f.path)
          : (settings?.libraryFolders || []);

        if (activeFolders.length > 0) {
          let anyIndexed = false;
          for (const f of activeFolders) {
            const audioFiles = await window.api.scanFolder(f);
            if (audioFiles && audioFiles.length > 0) {
              await window.api.parseMetadataBatch(audioFiles);
              anyIndexed = true;
            }
          }
          if (anyIndexed) {
            const refreshed = await window.api.getRecentTracks(500);
            this.tracks = Array.isArray(refreshed) ? refreshed : [];
            if (typeof LibraryScanner !== 'undefined' && settings?.musicFolders?.length > 0) {
              this.tracks = LibraryScanner.filterTracksByActiveFolders(this.tracks, settings.musicFolders);
            }
          }
        }
      }
    } catch (err) {
      console.error('[HomeRecentView] Error loading tracks:', err);
      this.tracks = [];
    }

    this._renderQuickGrid();
    this._renderTopTracksCarousel();
    this._renderArtistsCarousel();
    this._renderAlbumsCarousel();
    this._renderCarouselCards();
    this.filterAndRender();
  }

  filterAndRender() {
    if (!Array.isArray(this.tracks)) {
      this.tracks = [];
    }

    let list = [...this.tracks];

    const secTop = this.container?.querySelector('#section-top-tracks');
    const secArtists = this.container?.querySelector('#section-artists');
    const secAlbums = this.container?.querySelector('#section-albums');
    const secRecent = this.container?.querySelector('#section-recent-carousel');
    const secQuick = this.container?.querySelector('#quick-access-grid');

    // Control section visibility according to category chip
    if (this.activeCategory === 'music') {
      if (secTop) secTop.style.display = 'block';
      if (secArtists) secArtists.style.display = 'none';
      if (secAlbums) secAlbums.style.display = 'block';
      if (secRecent) secRecent.style.display = 'block';
      if (secQuick) secQuick.style.display = 'grid';
    } else if (this.activeCategory === 'artists') {
      if (secTop) secTop.style.display = 'none';
      if (secArtists) secArtists.style.display = 'block';
      if (secAlbums) secAlbums.style.display = 'none';
      if (secRecent) secRecent.style.display = 'none';
      if (secQuick) secQuick.style.display = 'none';
    } else if (this.activeCategory === 'albums') {
      if (secTop) secTop.style.display = 'none';
      if (secArtists) secArtists.style.display = 'none';
      if (secAlbums) secAlbums.style.display = 'block';
      if (secRecent) secRecent.style.display = 'none';
      if (secQuick) secQuick.style.display = 'none';
    } else if (this.activeCategory === 'playlists') {
      if (secTop) secTop.style.display = 'none';
      if (secArtists) secArtists.style.display = 'none';
      if (secAlbums) secAlbums.style.display = 'none';
      if (secRecent) secRecent.style.display = 'none';
      if (secQuick) secQuick.style.display = 'grid';
    } else {
      // 'all'
      if (secTop) secTop.style.display = 'block';
      if (secArtists) secArtists.style.display = 'block';
      if (secAlbums) secAlbums.style.display = 'block';
      if (secRecent) secRecent.style.display = 'block';
      if (secQuick) secQuick.style.display = 'grid';
    }
  }

  setSearchTerm(term) {
    this.searchTerm = (term || '').toLowerCase().trim();
    if (this.searchTerm && this.app.openSearch) {
      this.app.openSearch(this.searchTerm);
    }
  }

  setActiveFilter(category) {
    this.activeCategory = category || 'all';
    this.container?.querySelectorAll('.pill-chip').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === this.activeCategory);
    });
    this.filterAndRender();
  }

  filterByFavorites() {
    if (this.app.openLikedSongs) {
      this.app.openLikedSongs();
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
  module.exports = HomeRecentView;
}
