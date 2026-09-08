/**
 * HomeRecentView: Library overview, recent files, directory scan and file imports,
 * using the reusable TrackList component with 3-state column sorting and contextual actions.
 */
const _TrackListHome = typeof TrackList !== 'undefined'
  ? TrackList
  : (typeof require !== 'undefined' ? require('./TrackList') : null);

class HomeRecentView {
  constructor(appContext) {
    this.app = appContext;
    this.tracks = [];
    this.filteredTracks = [];
    this.container = null;
    this.searchTerm = '';
    this.trackList = new _TrackListHome(this.app, {
      showIndexColumn: false,
      onPlayTrack: (track, list, index) => {
        this.app.playTrackDirectly(track, list, index);
      }
    });
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
            <input type="text" id="library-search" placeholder="Buscar título, artista, álbum...">
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
        <!-- TrackList injected here -->
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const btnFolder = this.container.querySelector('#btn-add-folder');
    const btnFiles = this.container.querySelector('#btn-add-files');
    const searchInput = this.container.querySelector('#library-search');

    if (btnFolder) {
      btnFolder.addEventListener('click', async () => {
        const folder = await window.api.openFolderDialog();
        if (folder) {
          this.app.showToast('Escaneando pasta de músicas...');
          // Also add to monitored library folders
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
    }

    if (btnFiles) {
      btnFiles.addEventListener('click', async () => {
        const files = await window.api.openFilesDialog();
        if (files && files.length > 0) {
          this.app.showToast(`Processando ${files.length} arquivos...`);
          const parsed = await window.api.parseMetadataBatch(files);
          this.app.showToast(`${parsed.length} faixas adicionadas!`);
          await this.loadTracks();
        }
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = e.target.value.toLowerCase().trim();
        this.filterAndRender();
      });
    }
  }

  async loadTracks() {
    try {
      const res = await window.api.getRecentTracks(500);
      this.tracks = Array.isArray(res) ? res : [];

      // If library has no tracks yet, auto-scan previously configured library folders
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

    this.filterAndRender();
  }

  filterAndRender() {
    if (!Array.isArray(this.tracks)) {
      this.tracks = [];
    }

    if (!this.searchTerm) {
      this.filteredTracks = [...this.tracks];
    } else {
      this.filteredTracks = this.tracks.filter(t =>
        (t.title && t.title.toLowerCase().includes(this.searchTerm)) ||
        (t.artist && t.artist.toLowerCase().includes(this.searchTerm)) ||
        (t.album && t.album.toLowerCase().includes(this.searchTerm))
      );
    }

    const countText = this.container?.querySelector('#library-count-text');
    if (countText) {
      countText.textContent = `${this.tracks.length} faixa${this.tracks.length === 1 ? '' : 's'} na sua biblioteca`;
    }

    const body = this.container?.querySelector('#library-body');
    if (!body) return;

    this.trackList.setTracks(this.filteredTracks);
    this.trackList.render(body);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = HomeRecentView;
}
