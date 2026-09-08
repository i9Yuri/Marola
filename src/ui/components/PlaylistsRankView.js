/**
 * PlaylistsRankView: User playlists CRUD, ordering, and Top Tracks ranking (play_count DESC)
 */
class PlaylistsRankView {
  constructor(appContext) {
    this.app = appContext;
    this.container = null;
    this.playlists = [];
    this.topTracks = [];
    this.selectedPlaylist = null;
    this.sortBy = 'created';
  }

  mount(containerElement) {
    this.container = containerElement;
    this.render();
    this.loadData();
  }

  render() {
    this.container.innerHTML = `
      <div class="view-header">
        <div class="view-title-area">
          <h2>Playlists & Mais Tocadas</h2>
          <p>Organize suas seleções e veja as faixas mais executadas</p>
        </div>
        <div class="view-controls">
          <button class="btn btn-primary" id="btn-create-playlist">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Nova Playlist
          </button>
        </div>
      </div>

      <div class="view-body">
        <div class="split-view-container">
          <!-- Left Column: Playlists -->
          <div class="split-card" id="playlists-card">
            <div class="split-card-header">
              <h3 id="playlists-header-title">Suas Playlists</h3>
              <div style="display: flex; gap: 8px; align-items: center;">
                <label style="font-size: 0.78rem; color: var(--text-muted);">Ordenar:</label>
                <select id="playlist-sort-select" style="background: var(--bg-main); color: var(--text-primary); border: 1px solid var(--border-light); border-radius: 4px; padding: 3px 6px; font-size: 0.78rem;">
                  <option value="created">Data de Criação</option>
                  <option value="name">Alfabética</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
            </div>
            <div class="playlists-list" id="playlists-list-container">
              <!-- Playlists list or active playlist content -->
            </div>
          </div>

          <!-- Right Column: Top Tracks Ranking -->
          <div class="split-card" id="top-tracks-card">
            <div class="split-card-header">
              <h3>Mais Tocadas (Top Tracks)</h3>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Ranking por execuções (&ge; 50%)</span>
            </div>
            <div style="flex: 1; overflow-y: auto;" id="top-tracks-list-container">
              <!-- Top tracks table -->
            </div>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const btnCreate = this.container.querySelector('#btn-create-playlist');
    const sortSelect = this.container.querySelector('#playlist-sort-select');

    btnCreate.addEventListener('click', () => {
      this.app.openCreatePlaylistModal(async (name) => {
        await window.api.createPlaylist(name);
        this.app.showToast(`Playlist "${name}" criada com sucesso!`);
        await this.loadPlaylists();
      });
    });

    sortSelect.addEventListener('change', async (e) => {
      this.sortBy = e.target.value;
      await window.api.updateSettings({ playlistSortBy: this.sortBy });
      await this.loadPlaylists();
    });
  }

  async loadData() {
    await Promise.all([this.loadPlaylists(), this.loadTopTracks()]);
  }

  async loadPlaylists() {
    this.playlists = await window.api.getPlaylists(this.sortBy);
    this.renderPlaylistsList();
  }

  async loadTopTracks() {
    this.topTracks = await window.api.getTopTracks(50);
    this.renderTopTracks();
  }

  renderPlaylistsList() {
    const listEl = this.container.querySelector('#playlists-list-container');
    const headerTitle = this.container.querySelector('#playlists-header-title');
    if (!listEl) return;

    if (this.selectedPlaylist) {
      // Render details of selected playlist
      headerTitle.innerHTML = `
        <button class="btn-icon" id="btn-back-playlists" title="Voltar" style="margin-right: 6px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        </button>
        ${this.selectedPlaylist.name}
      `;

      this.container.querySelector('#btn-back-playlists').addEventListener('click', () => {
        this.selectedPlaylist = null;
        headerTitle.textContent = 'Suas Playlists';
        this.renderPlaylistsList();
      });

      this.renderPlaylistDetail(listEl);
      return;
    }

    headerTitle.textContent = 'Suas Playlists';

    if (this.playlists.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state" style="padding: 30px 0;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
          <p>Você ainda não criou nenhuma playlist.</p>
        </div>
      `;
      return;
    }

    let html = '';
    this.playlists.forEach((pl, idx) => {
      const trackCount = pl.trackIds ? pl.trackIds.length : 0;
      html += `
        <div class="playlist-item" data-id="${pl.id}">
          <div class="playlist-meta" style="flex: 1;">
            <h4>${pl.name}</h4>
            <span>${trackCount} música${trackCount === 1 ? '' : 's'}</span>
          </div>
          <div style="display: flex; gap: 4px;">
            ${this.sortBy === 'manual' ? `
              <button class="btn-icon btn-pl-up" title="Mover para cima" ${idx === 0 ? 'disabled style="opacity:0.3;"' : ''}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
              </button>
              <button class="btn-icon btn-pl-down" title="Mover para baixo" ${idx === this.playlists.length - 1 ? 'disabled style="opacity:0.3;"' : ''}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
            ` : ''}
            <button class="btn-icon btn-pl-rename" title="Renomear">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
            </button>
            <button class="btn-icon btn-pl-delete" title="Excluir" style="color: var(--danger);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      `;
    });

    listEl.innerHTML = html;

    listEl.querySelectorAll('.playlist-item').forEach(item => {
      const plId = item.dataset.id;
      const pl = this.playlists.find(p => p.id === plId);

      item.addEventListener('click', () => {
        this.selectedPlaylist = pl;
        this.renderPlaylistsList();
      });

      const btnRename = item.querySelector('.btn-pl-rename');
      if (btnRename) {
        btnRename.addEventListener('click', (e) => {
          e.stopPropagation();
          this.app.openPromptModal('Renomear Playlist', pl.name, async (newName) => {
            if (newName && newName.trim()) {
              await window.api.renamePlaylist(plId, newName.trim());
              await this.loadPlaylists();
            }
          });
        });
      }

      const btnDelete = item.querySelector('.btn-pl-delete');
      if (btnDelete) {
        btnDelete.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`Deseja realmente excluir a playlist "${pl.name}"?`)) {
            window.api.deletePlaylist(plId).then(() => {
              this.app.showToast('Playlist removida');
              this.loadPlaylists();
            });
          }
        });
      }

      const btnUp = item.querySelector('.btn-pl-up');
      const btnDown = item.querySelector('.btn-pl-down');
      if (btnUp) {
        btnUp.addEventListener('click', async (e) => {
          e.stopPropagation();
          const currIdx = this.playlists.findIndex(p => p.id === plId);
          if (currIdx > 0) {
            const ids = this.playlists.map(p => p.id);
            const temp = ids[currIdx];
            ids[currIdx] = ids[currIdx - 1];
            ids[currIdx - 1] = temp;
            await window.api.reorderPlaylists(ids);
            await this.loadPlaylists();
          }
        });
      }
      if (btnDown) {
        btnDown.addEventListener('click', async (e) => {
          e.stopPropagation();
          const currIdx = this.playlists.findIndex(p => p.id === plId);
          if (currIdx < this.playlists.length - 1) {
            const ids = this.playlists.map(p => p.id);
            const temp = ids[currIdx];
            ids[currIdx] = ids[currIdx + 1];
            ids[currIdx + 1] = temp;
            await window.api.reorderPlaylists(ids);
            await this.loadPlaylists();
          }
        });
      }
    });
  }

  async renderPlaylistDetail(container) {
    const tracks = await window.api.getPlaylistTracks(this.selectedPlaylist.id);

    if (tracks.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 20px 0;">
          <p>Esta playlist está vazia.</p>
          <span style="font-size: 0.8rem;">Adicione faixas a partir da Biblioteca.</span>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 0.8rem; color: var(--text-muted);">${tracks.length} faixa${tracks.length === 1 ? '' : 's'}</span>
        <button class="btn btn-primary btn-sm" id="btn-play-all-playlist" style="padding: 4px 12px; font-size: 0.78rem;">
          Tocar Playlist
        </button>
      </div>
      <div id="playlist-tracklist-container" style="flex: 1; overflow-y: auto;"></div>
    `;

    container.querySelector('#btn-play-all-playlist').addEventListener('click', () => {
      this.app.setQueueAndPlay(tracks, 0);
    });

    const trackListEl = container.querySelector('#playlist-tracklist-container');
    const plTrackList = new TrackList(this.app, {
      showIndexColumn: true,
      isPlaylist: true,
      playlistId: this.selectedPlaylist.id,
      onPlayTrack: (track, list, idx) => {
        this.app.playTrackDirectly(track, list, idx);
      },
      onTrackRemoved: async (track, idx) => {
        const foundIdx = this.selectedPlaylist.trackIds.indexOf(track.filePath);
        if (foundIdx !== -1) {
          await window.api.removeTrackFromPlaylist(this.selectedPlaylist.id, foundIdx);
          this.selectedPlaylist.trackIds.splice(foundIdx, 1);
          this.renderPlaylistDetail(container);
        }
      }
    });

    plTrackList.setTracks(tracks);
    plTrackList.render(trackListEl);
  }
        btnDown.addEventListener('click', async () => {
          const ids = [...this.selectedPlaylist.trackIds];
          const temp = ids[idx];
          ids[idx] = ids[idx + 1];
          ids[idx + 1] = temp;
          await window.api.reorderPlaylistTracks(this.selectedPlaylist.id, ids);
          this.selectedPlaylist.trackIds = ids;
          this.renderPlaylistDetail(container);
        });
      }
    });
  }

  renderTopTracks() {
    const container = this.container.querySelector('#top-tracks-list-container');
    if (!container) return;

    if (this.topTracks.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 30px 0;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          <p>Ainda não há reproduções computadas.</p>
          <span style="font-size: 0.8rem;">Toque faixas por pelo menos 50% para que entrem no ranking.</span>
        </div>
      `;
      return;
    }

    let rowsHtml = '';
    this.topTracks.forEach((track, idx) => {
      const plays = track.play_count || 0;
      rowsHtml += `
        <tr data-index="${idx}" style="cursor: pointer;">
          <td style="width: 32px; font-weight: 700; color: ${idx === 0 ? 'var(--accent)' : 'var(--text-muted)'}; text-align: center;">
            #${idx + 1}
          </td>
          <td>
            <div style="font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">
              ${track.title || 'Sem título'}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${track.artist || 'Artista desconhecido'}</div>
          </td>
          <td style="text-align: right; font-weight: 600; color: var(--accent);">
            ${plays} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">tq${plays === 1 ? '' : 's'}</span>
          </td>
        </tr>
      `;
    });

    container.innerHTML = `
      <table class="track-table">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Faixa</th>
            <th style="text-align: right;">Reproduções</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

    container.querySelectorAll('tbody tr').forEach(row => {
      const idx = parseInt(row.dataset.index, 10);
      const track = this.topTracks[idx];
      row.addEventListener('click', () => {
        this.app.playTrackDirectly(track, this.topTracks, idx);
      });
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlaylistsRankView;
}
