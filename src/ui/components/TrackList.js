/**
 * TrackList: Reusable table component with row-click to play, 3-state column sorting,
 * and contextual 3-dots actions menu.
 */
class TrackList {
  constructor(appContext, options = {}) {
    this.app = appContext;
    this.options = {
      showIndexColumn: options.showIndexColumn || false,
      isPlaylist: options.isPlaylist || false,
      playlistId: options.playlistId || null,
      onPlayTrack: options.onPlayTrack || ((track, list, index) => {
        this.app.playTrackDirectly(track, list, index);
      }),
      onTrackRemoved: options.onTrackRemoved || null
    };

    this.originalTracks = [];
    this.displayTracks = [];
    this.container = null;

    // Sorting state machine: 'asc' -> 'desc' -> 'none' (reset to original)
    this.sortColumn = null; // 'title' | 'artist' | 'album' | 'duration' | null
    this.sortDirection = 'none'; // 'asc' | 'desc' | 'none'
  }

  setTracks(tracks) {
    this.originalTracks = Array.isArray(tracks) ? [...tracks] : [];
    this._applySorting();
  }

  _cycleSort(columnKey) {
    if (this.sortColumn !== columnKey) {
      this.sortColumn = columnKey;
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
    this._applySorting();
    this.render();
  }

  _applySorting() {
    if (this.sortDirection === 'none' || !this.sortColumn) {
      this.displayTracks = [...this.originalTracks];
      return;
    }

    const col = this.sortColumn;
    const dir = this.sortDirection === 'asc' ? 1 : -1;

    this.displayTracks = [...this.originalTracks].sort((a, b) => {
      let valA = a[col];
      let valB = b[col];

      if (col === 'duration') {
        valA = typeof valA === 'number' ? valA : 0;
        valB = typeof valB === 'number' ? valB : 0;
        return (valA - valB) * dir;
      }

      // String comparison
      const strA = (valA || '').toString().toLowerCase();
      const strB = (valB || '').toString().toLowerCase();
      return strA.localeCompare(strB, undefined, { sensitivity: 'base' }) * dir;
    });
  }

  render(containerElement = this.container) {
    if (containerElement) {
      this.container = containerElement;
    }
    if (!this.container) return;

    if (this.displayTracks.length === 0) {
      this.container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
          <p style="font-size: 1.05rem; font-weight: 500;">Nenhuma faixa encontrada</p>
          <span style="font-size: 0.85rem; color: var(--text-muted);">Clique em "Adicionar Pasta" ou "Adicionar Arquivos" para começar a ouvir.</span>
        </div>
      `;
      return;
    }

    const getSortIcon = (col) => {
      if (this.sortColumn !== col) return '';
      if (this.sortDirection === 'asc') return '<span class="sort-indicator asc">▲</span>';
      if (this.sortDirection === 'desc') return '<span class="sort-indicator desc">▼</span>';
      return '';
    };

    const currentTrack = this.app.queueManager?.getCurrentTrack();

    let rowsHtml = '';
    this.displayTracks.forEach((track, idx) => {
      const isCurrent = currentTrack && currentTrack.filePath === track.filePath;
      const isFav = this.app.isFavorite ? this.app.isFavorite(track.filePath) : false;
      const durationStr = this._formatTime(track.duration);
      const coverImg = track.coverDataUrl
        ? `<img src="${track.coverDataUrl}" alt="Capa" loading="lazy">`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;

      rowsHtml += `
        <tr class="track-row ${isCurrent ? 'playing' : ''}" data-index="${idx}">
          ${this.options.showIndexColumn ? `<td class="col-index">${idx + 1}</td>` : ''}
          <td class="col-title">
            <div class="track-title-cell">
              <div class="track-thumb">${coverImg}</div>
              <div class="track-info">
                <span class="track-title-text" title="${this._escapeHtml(track.title || '')}">${this._escapeHtml(track.title || 'Sem título')}</span>
                <span class="track-artist-text">${this._escapeHtml(track.artist || 'Artista desconhecido')}</span>
              </div>
            </div>
          </td>
          <td class="col-artist">${this._escapeHtml(track.artist || '—')}</td>
          <td class="col-album">${this._escapeHtml(track.album || '—')}</td>
          <td class="col-duration">${durationStr}</td>
          <td class="col-actions" style="text-align: right;">
            ${isFav ? '<span class="fav-icon" title="Favorita">★</span>' : ''}
            <button class="btn-icon btn-track-menu" title="Mais opções" data-index="${idx}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="2"></circle>
                <circle cx="19" cy="12" r="2"></circle>
                <circle cx="5" cy="12" r="2"></circle>
              </svg>
            </button>
          </td>
        </tr>
      `;
    });

    this.container.innerHTML = `
      <table class="track-table interactive-track-table">
        <thead>
          <tr>
            ${this.options.showIndexColumn ? '<th style="width: 40px;">#</th>' : ''}
            <th class="sortable-th" data-sort="title">Título ${getSortIcon('title')}</th>
            <th class="sortable-th" data-sort="artist">Artista ${getSortIcon('artist')}</th>
            <th class="sortable-th" data-sort="album">Álbum ${getSortIcon('album')}</th>
            <th class="sortable-th" data-sort="duration">Duração ${getSortIcon('duration')}</th>
            <th style="width: 80px; text-align: right;">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    // Header sorting click
    this.container.querySelectorAll('.sortable-th').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        this._cycleSort(col);
      });
    });

    // Row click for instant playback
    this.container.querySelectorAll('tbody tr.track-row').forEach(row => {
      const idx = parseInt(row.dataset.index, 10);
      const track = this.displayTracks[idx];

      row.addEventListener('click', (e) => {
        // If clicked on actions button or menu, don't trigger playback
        if (e.target.closest('.btn-track-menu') || e.target.closest('.action-menu-dropdown')) {
          return;
        }
        this.options.onPlayTrack(track, this.displayTracks, idx);
      });

      // Three dots menu button
      const menuBtn = row.querySelector('.btn-track-menu');
      if (menuBtn) {
        menuBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._openActionMenu(e, track, idx);
        });
      }
    });
  }

  _openActionMenu(event, track, index) {
    TrackList.closeAllMenus();

    const isFav = this.app.isFavorite ? this.app.isFavorite(track.filePath) : false;
    const menu = document.createElement('div');
    menu.className = 'action-menu-dropdown';

    menu.innerHTML = `
      <div class="action-menu-item" data-action="enqueue">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        Adicionar à Fila
      </div>
      <div class="action-menu-item" data-action="playlist">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
        Adicionar à Playlist
      </div>
      <div class="action-menu-item" data-action="favorite">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        ${isFav ? 'Remover dos Curtidos' : 'Favoritar / Curtir'}
      </div>
      <div class="action-menu-item" data-action="lyrics">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        Ver Letra
      </div>
      <div class="action-menu-divider"></div>
      <div class="action-menu-item" data-action="reveal">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
        Abrir Local do Arquivo
      </div>
      ${this.options.isPlaylist ? `
        <div class="action-menu-divider"></div>
        <div class="action-menu-item danger" data-action="remove-playlist">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          Remover desta Playlist
        </div>
      ` : ''}
    `;

    document.body.appendChild(menu);

    // Position menu near button
    const btnRect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 210;
    let left = btnRect.right - menuWidth;
    if (left < 10) left = 10;
    let top = btnRect.bottom + 4;
    if (top + 220 > window.innerHeight) {
      top = btnRect.top - 220;
    }

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    // Action handlers
    menu.addEventListener('click', async (e) => {
      e.stopPropagation();
      const item = e.target.closest('.action-menu-item');
      if (!item) return;
      const action = item.dataset.action;
      TrackList.closeAllMenus();

      if (action === 'enqueue') {
        this.app.queueManager.addTrack(track);
        this.app.showToast(`Adicionada à fila: ${track.title}`);
      } else if (action === 'playlist') {
        this.app.openAddToPlaylistModal(track);
      } else if (action === 'favorite') {
        const res = await window.api.toggleFavorite(track.filePath);
        if (this.app.syncFavorites) {
          this.app.syncFavorites(res.favorites);
        }
        this.app.showToast(res.isFavorite ? 'Adicionada aos Curtidos!' : 'Removida dos Curtidos!');
        this.render();
      } else if (action === 'lyrics') {
        if (this.app.views.nowPlaying) {
          this.app.views.nowPlaying.open();
        } else if (this.app.views.lyrics) {
          this.app.views.lyrics.open();
        }
      } else if (action === 'reveal') {
        const opened = await window.api.showItemInFolder(track.filePath);
        if (!opened) {
          this.app.showToast('Não foi possível localizar o arquivo no disco.');
        }
      } else if (action === 'remove-playlist') {
        if (this.options.onTrackRemoved) {
          this.options.onTrackRemoved(track, index);
        }
      }
    });

    const closeHandler = (e) => {
      if (!menu.contains(e.target)) {
        TrackList.closeAllMenus();
        window.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => window.addEventListener('click', closeHandler), 10);
  }

  static closeAllMenus() {
    document.querySelectorAll('.action-menu-dropdown').forEach(el => el.remove());
  }

  _formatTime(seconds) {
    if (!seconds || isNaN(seconds) || seconds < 0) return '—';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  _escapeHtml(str) {
    return (str == null ? '' : String(str))
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TrackList;
}
