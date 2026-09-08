/**
 * TrackList: Reusable table component with row-click to play, 3-state column sorting,
 * contextual 3-dots actions menu, equalizer overlay on active track thumbnail,
 * horizontal swipe-to-queue gesture, and drag-and-drop manual reordering for playlists.
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
      onReorderTracks: options.onReorderTracks || null,
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

  updatePlayingState() {
    if (!this.container) return;
    const currentTrack = this.app.queueManager?.getCurrentTrack();
    const isPlaying = Boolean(this.app.audioEngine?.isPlaying);

    this.container.querySelectorAll('tbody tr.track-row').forEach(row => {
      const idx = parseInt(row.dataset.index, 10);
      const track = this.displayTracks[idx];
      const isCurrent = Boolean(currentTrack && track && currentTrack.filePath === track.filePath);

      const thumb = row.querySelector('.track-thumb');
      let eq = row.querySelector('.equalizer-overlay');

      if (isCurrent) {
        row.classList.add('playing');
        if (isPlaying) {
          row.classList.remove('paused');
        } else {
          row.classList.add('paused');
        }
        if (!eq && thumb) {
          eq = document.createElement('div');
          eq.className = 'equalizer-overlay';
          eq.innerHTML = `
            <span class="eq-bar"></span>
            <span class="eq-bar"></span>
            <span class="eq-bar"></span>
            <span class="eq-bar"></span>
          `;
          thumb.appendChild(eq);
        }
      } else {
        row.classList.remove('playing', 'paused');
        if (eq) eq.remove();
      }
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
    const isPlaying = Boolean(this.app.audioEngine?.isPlaying);

    let rowsHtml = '';
    this.displayTracks.forEach((track, idx) => {
      const isCurrent = Boolean(currentTrack && currentTrack.filePath === track.filePath);
      const isFav = this.app.isFavorite ? this.app.isFavorite(track.filePath) : false;
      const durationStr = this._formatTime(track.duration);
      const coverImg = track.coverDataUrl
        ? `<img src="${track.coverDataUrl}" alt="Capa" loading="lazy">`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;

      const equalizerHtml = isCurrent ? `
        <div class="equalizer-overlay">
          <span class="eq-bar"></span>
          <span class="eq-bar"></span>
          <span class="eq-bar"></span>
          <span class="eq-bar"></span>
        </div>
      ` : '';

      rowsHtml += `
        <tr class="track-row ${isCurrent ? 'playing' : ''} ${isCurrent && !isPlaying ? 'paused' : ''}" data-index="${idx}">
          ${this.options.isPlaylist ? `
            <td class="drag-handle-col" title="Arraste para reordenar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.6; display: inline-block; vertical-align: middle;">
                <circle cx="9" cy="5" r="1.5" fill="currentColor"></circle>
                <circle cx="9" cy="12" r="1.5" fill="currentColor"></circle>
                <circle cx="9" cy="19" r="1.5" fill="currentColor"></circle>
                <circle cx="15" cy="5" r="1.5" fill="currentColor"></circle>
                <circle cx="15" cy="12" r="1.5" fill="currentColor"></circle>
                <circle cx="15" cy="19" r="1.5" fill="currentColor"></circle>
              </svg>
            </td>
          ` : ''}
          ${this.options.showIndexColumn ? `<td class="col-index" style="text-align: center;">${idx + 1}</td>` : ''}
          <td class="col-title">
            <div class="track-title-cell">
              <div class="track-thumb">
                ${coverImg}
                ${equalizerHtml}
              </div>
              <div class="track-info">
                <span class="track-title-text" title="${this._escapeHtml(track.title || '')}">${this._escapeHtml(track.title || 'Sem título')}</span>
                <span class="track-artist-text" title="${this._escapeHtml(track.artist || '')}">${this._escapeHtml(track.artist || 'Artista desconhecido')}</span>
              </div>
            </div>
          </td>
          <td class="col-artist" title="${this._escapeHtml(track.artist || '')}">${this._escapeHtml(track.artist || '—')}</td>
          <td class="col-album" title="${this._escapeHtml(track.album || '')}">${this._escapeHtml(track.album || '—')}</td>
          <td class="col-duration" style="text-align: center;">${durationStr}</td>
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
            ${this.options.isPlaylist ? '<th style="width: 32px; text-align: center;"></th>' : ''}
            ${this.options.showIndexColumn ? '<th style="width: 40px; text-align: center;">#</th>' : ''}
            <th class="sortable-th" data-sort="title" style="width: 40%;">Título ${getSortIcon('title')}</th>
            <th class="sortable-th" data-sort="artist" style="width: 25%;">Artista ${getSortIcon('artist')}</th>
            <th class="sortable-th" data-sort="album" style="width: 20%;">Álbum ${getSortIcon('album')}</th>
            <th class="sortable-th" data-sort="duration" style="width: 70px; text-align: center;">Duração ${getSortIcon('duration')}</th>
            <th style="width: 75px; text-align: right;">Ações</th>
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

    const tbody = this.container.querySelector('tbody');
    if (!tbody) return;

    // Row click for instant playback and swipe gesture
    tbody.querySelectorAll('tr.track-row').forEach(row => {
      const idx = parseInt(row.dataset.index, 10);
      const track = this.displayTracks[idx];

      row.addEventListener('click', (e) => {
        if (row._justSwiped) {
          return;
        }
        // If clicked on actions button, drag handle, or menu, don't trigger playback
        if (e.target.closest('.btn-track-menu') || e.target.closest('.drag-handle-col') || e.target.closest('.action-menu-dropdown')) {
          return;
        }
        this.options.onPlayTrack(track, this.displayTracks, idx);
      });

      // Swipe-to-action gesture (drag to the right to enqueue)
      this._bindSwipeGesture(row, track);

      // Three dots menu button
      const menuBtn = row.querySelector('.btn-track-menu');
      if (menuBtn) {
        menuBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._openActionMenu(e, track, idx);
        });
      }
    });

    // Manual Drag & Drop reordering in playlists
    if (this.options.isPlaylist) {
      this._bindDragAndDrop(tbody);
    }
  }

  _bindSwipeGesture(row, track) {
    let startX = 0;
    let startY = 0;
    let currentDeltaX = 0;
    let isSwiping = false;
    let isTracking = false;
    let revealEl = null;

    const onPointerDown = (e) => {
      if (e.button !== 0) return; // Only primary mouse/touch button
      if (e.target.closest('.btn-track-menu') || e.target.closest('.drag-handle-col') || e.target.closest('.action-menu-dropdown')) {
        return;
      }
      startX = e.clientX;
      startY = e.clientY;
      currentDeltaX = 0;
      isSwiping = false;
      isTracking = true;
    };

    const onPointerMove = (e) => {
      if (!isTracking) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!isSwiping) {
        // Vertical scroll detection: cancel tracking if user is scrolling vertically
        if (Math.abs(dy) > 7 && Math.abs(dy) > Math.abs(dx)) {
          isTracking = false;
          return;
        }
        // Horizontal swipe to right detection
        if (dx > 10 && dx > Math.abs(dy) * 1.2) {
          isSwiping = true;
          row.classList.add('swiping');
          try {
            row.setPointerCapture?.(e.pointerId);
          } catch (_) {}

          if (!revealEl) {
            revealEl = document.createElement('div');
            revealEl.className = 'swipe-action-reveal';
            revealEl.innerHTML = `
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="5 4 15 12 5 20 5 4"></polygon>
                <line x1="19" y1="5" x2="19" y2="19"></line>
              </svg>
              <span>Tocar a seguir</span>
            `;
            row.appendChild(revealEl);
          }
          revealEl.style.opacity = '1';
        }
      }

      if (isSwiping) {
        e.preventDefault();
        // Clamp swipe between 0 and 150px
        currentDeltaX = Math.max(0, Math.min(dx, 150));
        row.style.transform = `translateX(${currentDeltaX}px)`;

        // Keep reveal pinned to the left edge while expanding
        if (revealEl) {
          revealEl.style.transform = `translateX(-${currentDeltaX}px)`;
          revealEl.style.width = `${Math.max(currentDeltaX, 60)}px`;
          if (currentDeltaX >= 70) {
            revealEl.classList.add('ready');
          } else {
            revealEl.classList.remove('ready');
          }
        }
      }
    };

    const onPointerUp = (e) => {
      if (!isTracking) return;
      isTracking = false;

      if (isSwiping) {
        isSwiping = false;
        try {
          row.releasePointerCapture?.(e.pointerId);
        } catch (_) {}

        row.classList.remove('swiping');
        row.classList.add('swipe-snapping');
        row.style.transform = 'translateX(0px)';

        if (revealEl) {
          revealEl.style.transform = 'translateX(0px)';
          revealEl.style.opacity = '0';
        }

        const triggered = currentDeltaX >= 70;
        if (triggered) {
          if (typeof this.app.queueManager?.addTrackPlayNext === 'function') {
            this.app.queueManager.addTrackPlayNext(track);
          } else {
            this.app.queueManager?.addTrack(track);
          }
          this.app.showToast(`Tocar a seguir: ${track.title || 'Faixa'}`);
        }

        // Suppress row click playback
        row._justSwiped = true;
        setTimeout(() => {
          row._justSwiped = false;
        }, 220);

        setTimeout(() => {
          row.classList.remove('swipe-snapping');
          row.style.transform = '';
          if (revealEl) {
            revealEl.remove();
            revealEl = null;
          }
        }, 270);
      }
    };

    row.addEventListener('pointerdown', onPointerDown);
    row.addEventListener('pointermove', onPointerMove);
    row.addEventListener('pointerup', onPointerUp);
    row.addEventListener('pointercancel', onPointerUp);
  }

  _bindDragAndDrop(tbody) {
    let draggedIdx = null;

    tbody.querySelectorAll('.drag-handle-col').forEach(handle => {
      handle.setAttribute('draggable', 'true');

      handle.addEventListener('dragstart', (e) => {
        const row = handle.closest('tr.track-row');
        draggedIdx = parseInt(row.dataset.index, 10);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(draggedIdx));
        row.classList.add('dragging');
      });

      handle.addEventListener('dragend', () => {
        tbody.querySelectorAll('tr.track-row').forEach(r => {
          r.classList.remove('dragging', 'drop-target-above', 'drop-target-below');
        });
        draggedIdx = null;
      });
    });

    tbody.querySelectorAll('tr.track-row').forEach(row => {
      row.addEventListener('dragover', (e) => {
        if (draggedIdx === null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const rect = row.getBoundingClientRect();
        const isAbove = e.clientY < (rect.top + rect.height / 2);
        row.classList.toggle('drop-target-above', isAbove);
        row.classList.toggle('drop-target-below', !isAbove);
      });

      row.addEventListener('dragleave', () => {
        row.classList.remove('drop-target-above', 'drop-target-below');
      });

      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('drop-target-above', 'drop-target-below');
        if (draggedIdx === null) return;

        const targetIdx = parseInt(row.dataset.index, 10);
        const rect = row.getBoundingClientRect();
        const isAbove = e.clientY < (rect.top + rect.height / 2);

        let newIdx = isAbove ? targetIdx : targetIdx + 1;
        if (draggedIdx < newIdx) {
          newIdx--;
        }

        if (draggedIdx !== newIdx && newIdx >= 0 && newIdx < this.originalTracks.length) {
          const [movedTrack] = this.originalTracks.splice(draggedIdx, 1);
          this.originalTracks.splice(newIdx, 0, movedTrack);
          this.displayTracks = [...this.originalTracks];
          this.render();

          if (this.options.onReorderTracks) {
            const trackIds = this.originalTracks.map(t => t.filePath);
            this.options.onReorderTracks(trackIds);
          }
        }
        draggedIdx = null;
      });
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
        this.app.queueManager?.addTrack(track);
        this.app.showToast(`Adicionada à fila: ${track.title || 'Faixa'}`);
      } else if (action === 'playlist') {
        this.app.openAddToPlaylistModal(track);
      } else if (action === 'favorite') {
        const res = await window.api.toggleFavorite(track.filePath);
        if (this.app.syncFavorites) {
          this.app.syncFavorites(res.favorites);
        }
        this.app.showToast(res.isFavorite ? 'Adicionada aos Curtidos!' : 'Removida dos Curtidos!');
        this.render();
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
