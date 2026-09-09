/**
 * SearchView: Dedicated Spotify desktop styled search results view.
 * Categorizes results into:
 * - Top Result ("Melhor resultado") with large preview and floating play button
 * - Tracks ("Músicas") list with quick play and like buttons
 * - Artists ("Artistas") with circular cards
 * - Albums ("Álbuns") with direct links to PlaylistDetailView in album context
 */
class SearchView {
  constructor(appContext) {
    this.app = appContext;
    this.container = null;
    this.query = '';
    this.tracks = []; // All library tracks to search over
  }

  mount(containerElement) {
    this.container = containerElement;
    this.container.className = 'search-view-container';
    this.container.style.display = 'none';
  }

  async setQuery(query, allTracks) {
    this.query = (query || '').trim();

    if (Array.isArray(allTracks)) {
      this.tracks = allTracks;
    } else if (typeof window !== 'undefined' && window.api?.getTracks) {
      try {
        this.tracks = await window.api.getTracks();
      } catch (e) {
        this.tracks = [];
      }
    } else if (Array.isArray(this.app.views?.recent?.tracks)) {
      this.tracks = this.app.views.recent.tracks;
    }

    this.render();
  }

  render() {
    if (!this.container) return;

    if (!this.query) {
      this.container.innerHTML = `
        <div class="search-empty-prompt">
          <div class="search-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <h2>O que você quer ouvir?</h2>
          <p>Busque por artistas, músicas ou álbuns na barra superior.</p>
        </div>
      `;
      return;
    }

    const normQuery = this.query
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    // 1. Filter matching tracks
    const matchedTracks = this.tracks.filter(t => {
      const title = (t.title || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const artist = (t.artist || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const album = (t.album || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      return title.includes(normQuery) || artist.includes(normQuery) || album.includes(normQuery);
    });

    // 2. Aggregate matching artists
    const artistMap = new Map();
    this.tracks.forEach(t => {
      const art = (t.artist || '').trim();
      if (!art || art.toLowerCase() === 'artista desconhecido' || art.toLowerCase() === 'unknown') return;
      const normArt = art.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      if (normArt.includes(normQuery)) {
        if (!artistMap.has(normArt)) {
          artistMap.set(normArt, { name: art, coverDataUrl: t.coverDataUrl, tracks: [] });
        }
        const entry = artistMap.get(normArt);
        entry.tracks.push(t);
        if (!entry.coverDataUrl && t.coverDataUrl) entry.coverDataUrl = t.coverDataUrl;
      }
    });
    const matchedArtists = Array.from(artistMap.values()).slice(0, 8);

    // 3. Aggregate matching albums
    const albumMap = new Map();
    this.tracks.forEach(t => {
      const alb = (t.album || '').trim();
      if (!alb || alb.toLowerCase() === 'álbum desconhecido' || alb.toLowerCase() === 'unknown') return;
      const normAlb = alb.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      if (normAlb.includes(normQuery)) {
        if (!albumMap.has(normAlb)) {
          albumMap.set(normAlb, { name: alb, artist: t.artist, year: t.year, coverDataUrl: t.coverDataUrl, tracks: [] });
        }
        const entry = albumMap.get(normAlb);
        entry.tracks.push(t);
        if (!entry.coverDataUrl && t.coverDataUrl) entry.coverDataUrl = t.coverDataUrl;
      }
    });
    const matchedAlbums = Array.from(albumMap.values()).slice(0, 8);

    if (matchedTracks.length === 0 && matchedArtists.length === 0 && matchedAlbums.length === 0) {
      this.container.innerHTML = `
        <div class="search-empty-prompt">
          <h2>Nenhum resultado encontrado para "${this._escapeHtml(this.query)}"</h2>
          <p>Verifique se a ortografia está correta ou use palavras-chave diferentes.</p>
        </div>
      `;
      return;
    }

    // Top Result: choose exact matching artist first if exists, else first track
    let topResult = null;
    let topResultType = 'track'; // 'track' | 'artist'

    const exactArtist = matchedArtists.find(a =>
      a.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === normQuery
    );

    if (exactArtist) {
      topResult = exactArtist;
      topResultType = 'artist';
    } else if (matchedTracks.length > 0) {
      topResult = matchedTracks[0];
      topResultType = 'track';
    } else if (matchedArtists.length > 0) {
      topResult = matchedArtists[0];
      topResultType = 'artist';
    } else {
      topResult = matchedAlbums[0];
      topResultType = 'album';
    }

    const currentTrack = this.app.queueManager?.getCurrentTrack();
    const isPlaying = Boolean(this.app.audioEngine?.isPlaying);
    const favSet = this.app.favoritesSet || new Set();

    // Render Top Section (Top Result + Top 4 Tracks side-by-side)
    let topResultHtml = '';
    if (topResult) {
      const isArt = topResultType === 'artist';
      const isAlb = topResultType === 'album';
      const coverUrl = topResult.coverDataUrl;
      const title = isArt ? topResult.name : (isAlb ? topResult.name : topResult.title);
      const subtitle = isArt
        ? `${topResult.tracks.length} músicas • Artista`
        : (isAlb ? `${topResult.artist || 'Vários Artistas'} • Álbum` : `${topResult.artist || 'Artista'}`);
      const tag = isArt ? 'Artista' : (isAlb ? 'Álbum' : 'Música');

      topResultHtml = `
        <div class="search-top-result-card" id="search-top-result-card">
          <div class="top-result-cover-wrap ${isArt ? 'is-artist' : ''}">
            ${coverUrl
              ? `<img src="${coverUrl}" alt="${this._escapeHtml(title)}" class="top-result-img ${isArt ? 'is-artist' : ''}">`
              : `<div class="top-result-fallback ${isArt ? 'is-artist' : ''}"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg></div>`
            }
            <button class="top-result-play-btn" id="btn-play-top-result" title="Tocar ${this._escapeHtml(title)}">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6 4 20 12 6 20 6 4"></polygon>
              </svg>
            </button>
          </div>
          <h2 class="top-result-title" title="${this._escapeHtml(title)}">${this._escapeHtml(title)}</h2>
          <div class="top-result-sub-wrap">
            <span class="top-result-tag">${tag}</span>
            <span class="top-result-sub">${this._escapeHtml(subtitle)}</span>
          </div>
        </div>
      `;
    }

    // Top Tracks (up to 4)
    const topTracksSlice = matchedTracks.slice(0, 4);
    let tracksListHtml = '';
    topTracksSlice.forEach((t, idx) => {
      const isCurrent = Boolean(currentTrack && currentTrack.filePath === t.filePath);
      const isFav = favSet.has(t.filePath);
      const dur = this._formatDuration(t.duration);
      const thumb = t.coverDataUrl
        ? `<img src="${t.coverDataUrl}" alt="Capa" class="search-track-thumb-img">`
        : `<div class="search-track-thumb-fallback"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg></div>`;

      tracksListHtml += `
        <div class="search-track-row ${isCurrent ? 'playing' : ''}" data-index="${idx}" data-filepath="${this._escapeHtml(t.filePath)}">
          <div class="search-track-left">
            <div class="search-track-thumb-wrap">
              ${thumb}
              <button class="search-track-play-btn" data-index="${idx}" title="Tocar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
              </button>
            </div>
            <div class="search-track-info">
              <span class="search-track-title ${isCurrent ? 'active-green' : ''}" title="${this._escapeHtml(t.title || '')}">${this._escapeHtml(t.title || 'Sem título')}</span>
              <span class="search-track-artist">${this._escapeHtml(t.artist || 'Artista Desconhecido')}</span>
            </div>
          </div>
          <div class="search-track-right">
            <button class="search-track-like-btn ${isFav ? 'active' : ''}" data-filepath="${this._escapeHtml(t.filePath)}" title="${isFav ? 'Descurtir' : 'Curtir'}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="${isFav ? '#1ed760' : 'none'}" stroke="${isFav ? '#1ed760' : 'currentColor'}" stroke-width="2">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </button>
            <span class="search-track-dur">${dur}</span>
          </div>
        </div>
      `;
    });

    // Artists Carousel HTML
    let artistsHtml = '';
    matchedArtists.forEach((art, idx) => {
      const avatar = art.coverDataUrl
        ? `<img src="${art.coverDataUrl}" alt="${this._escapeHtml(art.name)}" class="card-item-cover-img" loading="lazy">`
        : `<div class="card-item-cover-fallback"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div>`;

      artistsHtml += `
        <div class="card-vertical-item artist-item search-artist-card" data-index="${idx}" title="${this._escapeHtml(art.name)}">
          <div class="card-item-cover-wrap">
            ${avatar}
            <button class="card-item-play-btn" title="Tocar ${this._escapeHtml(art.name)}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
            </button>
          </div>
          <h4 class="card-item-title">${this._escapeHtml(art.name)}</h4>
          <span class="card-item-subtitle">Artista</span>
        </div>
      `;
    });

    // Albums Carousel HTML
    let albumsHtml = '';
    matchedAlbums.forEach((alb, idx) => {
      const cover = alb.coverDataUrl
        ? `<img src="${alb.coverDataUrl}" alt="${this._escapeHtml(alb.name)}" class="card-item-cover-img" loading="lazy">`
        : `<div class="card-item-cover-fallback"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="12" cy="12" r="4"></circle></svg></div>`;

      albumsHtml += `
        <div class="card-vertical-item search-album-card" data-index="${idx}" title="${this._escapeHtml(alb.name)}">
          <div class="card-item-cover-wrap">
            ${cover}
            <button class="card-item-play-btn" title="Tocar ${this._escapeHtml(alb.name)}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
            </button>
          </div>
          <h4 class="card-item-title">${this._escapeHtml(alb.name)}</h4>
          <span class="card-item-subtitle">${this._escapeHtml(alb.artist || 'Álbum')}</span>
        </div>
      `;
    });

    this.container.innerHTML = `
      <div class="search-results-scrollable">
        <!-- Top Split Section -->
        <div class="search-top-split-container">
          <div class="search-col-top-result">
            <h2 class="search-section-heading">Melhor resultado</h2>
            ${topResultHtml}
          </div>

          <div class="search-col-tracks">
            <h2 class="search-section-heading">Músicas</h2>
            <div class="search-tracks-list">
              ${tracksListHtml || '<p class="search-empty-text">Nenhuma música encontrada.</p>'}
            </div>
          </div>
        </div>

        <!-- Artists Section -->
        ${matchedArtists.length > 0 ? `
          <div class="search-section-block">
            <h2 class="search-section-heading">Artistas</h2>
            <div class="horizontal-carousel-row search-artists-carousel">
              ${artistsHtml}
            </div>
          </div>
        ` : ''}

        <!-- Albums Section -->
        ${matchedAlbums.length > 0 ? `
          <div class="search-section-block">
            <h2 class="search-section-heading">Álbuns</h2>
            <div class="horizontal-carousel-row search-albums-carousel">
              ${albumsHtml}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    // Bind events
    // 1. Top result card & play
    const topCard = this.container.querySelector('#search-top-result-card');
    topCard?.addEventListener('click', () => {
      if (topResultType === 'artist') {
        this.app.setQueueAndPlay(topResult.tracks, 0);
      } else if (topResultType === 'album') {
        if (this.app.openAlbum) {
          this.app.openAlbum(topResult);
        } else {
          this.app.setQueueAndPlay(topResult.tracks, 0);
        }
      } else {
        this.app.playTrackDirectly(topResult, matchedTracks, 0);
      }
    });

    const btnPlayTop = this.container.querySelector('#btn-play-top-result');
    btnPlayTop?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (topResultType === 'artist') {
        this.app.setQueueAndPlay(topResult.tracks, 0);
      } else if (topResultType === 'album') {
        this.app.setQueueAndPlay(topResult.tracks, 0);
      } else {
        this.app.playTrackDirectly(topResult, matchedTracks, 0);
      }
    });

    // 2. Track list events
    this.container.querySelectorAll('.search-track-row').forEach(rowEl => {
      const idx = parseInt(rowEl.dataset.index, 10);
      const track = topTracksSlice[idx];
      if (!track) return;

      rowEl.addEventListener('click', () => {
        this.app.playTrackDirectly(track, matchedTracks, idx);
      });

      const playBtn = rowEl.querySelector('.search-track-play-btn');
      playBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.playTrackDirectly(track, matchedTracks, idx);
      });

      const likeBtn = rowEl.querySelector('.search-track-like-btn');
      likeBtn?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (this.app.toggleFavorite) {
          await this.app.toggleFavorite(track.filePath);
          this.render();
        }
      });
    });

    // 3. Artist cards events
    this.container.querySelectorAll('.search-artist-card').forEach(cardEl => {
      const idx = parseInt(cardEl.dataset.index, 10);
      const art = matchedArtists[idx];
      if (!art) return;

      cardEl.addEventListener('click', (e) => {
        if (e.target.closest('.card-item-play-btn')) {
          e.stopPropagation();
          this.app.setQueueAndPlay(art.tracks, 0);
          return;
        }
        // Clicking card body filters search or plays
        this.app.setQueueAndPlay(art.tracks, 0);
      });
    });

    // 4. Album cards events
    this.container.querySelectorAll('.search-album-card').forEach(cardEl => {
      const idx = parseInt(cardEl.dataset.index, 10);
      const alb = matchedAlbums[idx];
      if (!alb) return;

      cardEl.addEventListener('click', (e) => {
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

  updatePlayingState() {
    if (!this.container || this.container.style.display === 'none') return;
    this.render();
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
  module.exports = SearchView;
}
if (typeof window !== 'undefined') {
  window.SearchView = SearchView;
}
