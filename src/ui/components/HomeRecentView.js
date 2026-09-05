/**
 * HomeRecentView: Library overview, recent files, directory scan and file imports
 */
class HomeRecentView {
  constructor(appContext) {
    this.app = appContext;
    this.tracks = [];
    this.filteredTracks = [];
    this.container = null;
    this.searchTerm = '';
  }

  mount(containerElement) {
    this.container = containerElement;
    this.render();
    this.loadTracks();
  }

  render() {
    this.container.innerHTML = `
      <div class="view-header">
        <div class="view-title-area">
          <h2>Biblioteca & Recentes</h2>
          <p id="library-count-text">Carregando suas músicas locais...</p>
        </div>
        <div class="view-controls">
          <div class="search-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" id="library-search" placeholder="Buscar título, artista...">
          </div>
          <button class="btn btn-secondary" id="btn-add-files">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
            Adicionar Arquivos
          </button>
          <button class="btn btn-primary" id="btn-add-folder">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
            Adicionar Pasta
          </button>
        </div>
      </div>

      <div class="view-body" id="library-body">
        <!-- Content injected dynamically -->
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const btnFolder = this.container.querySelector('#btn-add-folder');
    const btnFiles = this.container.querySelector('#btn-add-files');
    const searchInput = this.container.querySelector('#library-search');

    btnFolder.addEventListener('click', async () => {
      const folder = await window.api.openFolderDialog();
      if (folder) {
        this.app.showToast('Escaneando pasta de músicas...');
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

    btnFiles.addEventListener('click', async () => {
      const files = await window.api.openFilesDialog();
      if (files && files.length > 0) {
        this.app.showToast(`Processando ${files.length} arquivos...`);
        const parsed = await window.api.parseMetadataBatch(files);
        this.app.showToast(`${parsed.length} faixas adicionadas!`);
        await this.loadTracks();
      }
    });

    searchInput.addEventListener('input', (e) => {
      this.searchTerm = e.target.value.toLowerCase().trim();
      this.filterAndRender();
    });
  }

  async loadTracks() {
    this.tracks = await window.api.getRecentTracks(500);
    this.filterAndRender();
  }

  filterAndRender() {
    if (!this.searchTerm) {
      this.filteredTracks = [...this.tracks];
    } else {
      this.filteredTracks = this.tracks.filter(t =>
        (t.title && t.title.toLowerCase().includes(this.searchTerm)) ||
        (t.artist && t.artist.toLowerCase().includes(this.searchTerm)) ||
        (t.album && t.album.toLowerCase().includes(this.searchTerm))
      );
    }

    const countText = this.container.querySelector('#library-count-text');
    if (countText) {
      countText.textContent = `${this.tracks.length} faixa${this.tracks.length === 1 ? '' : 's'} na sua biblioteca`;
    }

    const body = this.container.querySelector('#library-body');
    if (!body) return;

    if (this.filteredTracks.length === 0) {
      body.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
          <p style="font-size: 1.05rem; font-weight: 500;">Nenhuma música na biblioteca</p>
          <span style="font-size: 0.85rem;">Clique em "Adicionar Pasta" ou "Adicionar Arquivos" para começar a ouvir.</span>
        </div>
      `;
      return;
    }

    let rowsHtml = '';
    const currentTrack = this.app.queueManager.getCurrentTrack();

    this.filteredTracks.forEach((track, idx) => {
      const isCurrent = currentTrack && currentTrack.filePath === track.filePath;
      const durationStr = this._formatTime(track.duration);
      const coverImg = track.coverDataUrl
        ? `<img src="${track.coverDataUrl}" alt="Capa">`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;

      rowsHtml += `
        <tr class="${isCurrent ? 'playing' : ''}" data-index="${idx}">
          <td style="width: 40px; text-align: center;">
            <button class="btn-icon btn-row-play" title="Tocar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
          </td>
          <td>
            <div class="track-title-cell">
              <div class="track-thumb">${coverImg}</div>
              <div class="track-info">
                <span class="track-title-text" title="${track.title || ''}">${track.title || 'Sem título'}</span>
                <span class="track-artist-text">${track.artist || 'Artista desconhecido'}</span>
              </div>
            </div>
          </td>
          <td>${track.album || '—'}</td>
          <td>${durationStr}</td>
          <td style="text-align: right;">
            <button class="btn-icon btn-row-add-queue" title="Adicionar à fila">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
            <button class="btn-icon btn-row-add-playlist" title="Adicionar à playlist">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
            </button>
          </td>
        </tr>
      `;
    });

    body.innerHTML = `
      <table class="track-table">
        <thead>
          <tr>
            <th></th>
            <th>Título / Artista</th>
            <th>Álbum</th>
            <th>Duração</th>
            <th style="text-align: right;">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

    // Row click events
    body.querySelectorAll('tbody tr').forEach(row => {
      const idx = parseInt(row.dataset.index, 10);
      const track = this.filteredTracks[idx];

      row.addEventListener('dblclick', () => {
        this.app.playTrackDirectly(track, this.filteredTracks, idx);
      });

      row.querySelector('.btn-row-play').addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.playTrackDirectly(track, this.filteredTracks, idx);
      });

      row.querySelector('.btn-row-add-queue').addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.queueManager.addTrack(track);
        this.app.showToast(`Adicionada à fila: ${track.title}`);
      });

      row.querySelector('.btn-row-add-playlist').addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.openAddToPlaylistModal(track);
      });
    });
  }

  _formatTime(seconds) {
    if (!seconds || isNaN(seconds) || seconds < 0) return '—';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = HomeRecentView;
}
