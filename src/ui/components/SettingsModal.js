/**
 * SettingsModal: Preferences panel for Crossfade, Themes (Dark/Light/System),
 * Custom Background with Dimmer, Library Directories, and Audio Normalization.
 */
class SettingsModal {
  constructor(appContext) {
    this.app = appContext;
    this.container = null;
    this.isOpen = false;
    this.currentSettings = {};
    this.dom = {};
  }

  mount(containerElement) {
    this.container = containerElement;
    this.container.className = 'modal-overlay';
    this.container.id = 'settings-modal';

    this.container.innerHTML = `
      <div class="modal-card settings-modal-card">
        <div class="settings-modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            <h3>Configurações</h3>
          </div>
          <button class="btn-icon" id="settings-btn-close" title="Fechar (Esc)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div class="settings-modal-body">
          <!-- Section 1: Audio & Crossfade -->
          <div class="settings-section">
            <h4 class="settings-section-title">Motor de Áudio & Transição</h4>
            <div class="settings-row">
              <div class="settings-label">
                <strong>Crossfade (Transição entre faixas)</strong>
                <span>Tempo de sobreposição suave entre faixas consecutivas</span>
              </div>
              <div class="settings-control-inline">
                <input type="range" id="setting-crossfade" min="0" max="12" step="0.5" value="3">
                <span class="settings-value-badge" id="setting-crossfade-val">3.0s</span>
              </div>
            </div>

            <div class="settings-row">
              <div class="settings-label">
                <strong>Normalização de Volume</strong>
                <span>Equilibrar ganho sonoro entre faixas com volumes díspares</span>
              </div>
              <div class="settings-control-inline">
                <label class="toggle-switch">
                  <input type="checkbox" id="setting-normalization">
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>

          <!-- Section 2: Appearance & Themes -->
          <div class="settings-section">
            <h4 class="settings-section-title">Aparência & Temas</h4>
            <div class="settings-row">
              <div class="settings-label">
                <strong>Tema da Interface</strong>
                <span>Escolha o esquema de cores sóbrio de sua preferência</span>
              </div>
              <div class="settings-control-inline">
                <select id="setting-theme" class="modal-input" style="padding: 6px 12px; width: 170px;">
                  <option value="dark">Escuro (Slate/Zinc)</option>
                  <option value="light">Claro</option>
                  <option value="system">Sincronizado (Sistema)</option>
                </select>
              </div>
            </div>

            <div class="settings-row">
              <div class="settings-label">
                <strong>Cor de Destaque (Accent Color)</strong>
                <span id="setting-accent-name">Azul Aço (#38bdf8)</span>
              </div>
              <div class="settings-control-inline">
                <div class="accent-swatch-list" id="setting-accent-swatches">
                  <button type="button" class="accent-swatch-btn active" data-color="#38bdf8" data-name="Azul Aço" style="background-color: #38bdf8;" title="Azul Aço"></button>
                  <button type="button" class="accent-swatch-btn" data-color="#10b981" data-name="Verde Esmeralda" style="background-color: #10b981;" title="Verde Esmeralda"></button>
                  <button type="button" class="accent-swatch-btn" data-color="#f59e0b" data-name="Âmbar Quente" style="background-color: #f59e0b;" title="Âmbar Quente"></button>
                  <button type="button" class="accent-swatch-btn" data-color="#14b8a6" data-name="Teal Sóbrio" style="background-color: #14b8a6;" title="Teal Sóbrio"></button>
                  <button type="button" class="accent-swatch-btn" data-color="#e4e4e7" data-name="Grafite Puro" style="background-color: #e4e4e7;" title="Grafite Puro"></button>
                </div>
              </div>
            </div>

            <div class="settings-row">
              <div class="settings-label">
                <strong>Imagem de Plano de Fundo</strong>
                <span id="setting-bg-status">Nenhuma imagem personalizada ativa</span>
              </div>
              <div class="settings-control-inline" style="gap: 8px;">
                <button class="btn btn-secondary btn-sm" id="setting-btn-choose-bg">
                  Escolher Imagem...
                </button>
                <button class="btn btn-secondary btn-sm" id="setting-btn-reset-bg" style="display: none; color: var(--danger);">
                  Remover
                </button>
              </div>
            </div>

            <div class="settings-row" id="setting-dimmer-row" style="display: none;">
              <div class="settings-label">
                <strong>Escurecimento do Fundo (Dimmer)</strong>
                <span>Ajuste a intensidade do filtro escuro para máxima legibilidade</span>
              </div>
              <div class="settings-control-inline">
                <input type="range" id="setting-dimmer" min="0" max="0.9" step="0.05" value="0.4">
                <span class="settings-value-badge" id="setting-dimmer-val">40%</span>
              </div>
            </div>
          </div>

          <!-- Section 3: Monitored Library Directories -->
          <div class="settings-section">
            <h4 class="settings-section-title">Diretórios da Biblioteca</h4>
            <div class="settings-row" style="flex-direction: column; align-items: stretch; gap: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div class="settings-label">
                  <strong>Pastas Monitoradas</strong>
                  <span>Pastas do sistema onde suas músicas locais estão armazenadas</span>
                </div>
                <div style="display: flex; gap: 8px;">
                  <button class="btn btn-secondary btn-sm" id="setting-btn-rescan-all">
                    Escanear Agora
                  </button>
                  <button class="btn btn-primary btn-sm" id="setting-btn-add-dir">
                    Adicionar Pasta
                  </button>
                </div>
              </div>
              <div class="settings-dir-list" id="setting-dir-list">
                <!-- Directory items rendered here -->
              </div>
            </div>
          </div>

          <!-- Section 4: System info & Formats -->
          <div class="settings-section" style="border-bottom: none;">
            <h4 class="settings-section-title">Formatos Suportados & Informações</h4>
            <div class="settings-row">
              <div class="settings-label">
                <span>Formatos decodificados localmente: <code>.mp3</code>, <code>.flac</code>, <code>.wav</code>, <code>.ogg</code>, <code>.m4a</code> e letras <code>.lrc</code>.</span>
              </div>
              <div style="font-size: 0.8rem; color: var(--text-muted);" id="setting-lib-stats">
                JustPlay Offline v1.0.0
              </div>
            </div>
          </div>
        </div>

        <div class="settings-modal-footer">
          <button class="btn btn-primary" id="settings-btn-done">Concluído</button>
        </div>
      </div>
    `;

    this._cacheDom();
    this._bindEvents();
  }

  _cacheDom() {
    this.dom = {
      btnClose: this.container.querySelector('#settings-btn-close'),
      btnDone: this.container.querySelector('#settings-btn-done'),
      crossfade: this.container.querySelector('#setting-crossfade'),
      crossfadeVal: this.container.querySelector('#setting-crossfade-val'),
      normalization: this.container.querySelector('#setting-normalization'),
      theme: this.container.querySelector('#setting-theme'),
      accentName: this.container.querySelector('#setting-accent-name'),
      accentSwatches: this.container.querySelectorAll('.accent-swatch-btn'),
      btnChooseBg: this.container.querySelector('#setting-btn-choose-bg'),
      btnResetBg: this.container.querySelector('#setting-btn-reset-bg'),
      bgStatus: this.container.querySelector('#setting-bg-status'),
      dimmerRow: this.container.querySelector('#setting-dimmer-row'),
      dimmer: this.container.querySelector('#setting-dimmer'),
      dimmerVal: this.container.querySelector('#setting-dimmer-val'),
      dirList: this.container.querySelector('#setting-dir-list'),
      btnAddDir: this.container.querySelector('#setting-btn-add-dir'),
      btnRescanAll: this.container.querySelector('#setting-btn-rescan-all'),
      libStats: this.container.querySelector('#setting-lib-stats')
    };
  }

  _bindEvents() {
    this.dom.btnClose?.addEventListener('click', () => this.close());
    this.dom.btnDone?.addEventListener('click', () => this.close());

    // Click outside modal card to close
    this.container?.addEventListener('click', (e) => {
      if (e.target === this.container) this.close();
    });

    // Crossfade change
    this.dom.crossfade?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (this.dom.crossfadeVal) this.dom.crossfadeVal.textContent = `${val.toFixed(1)}s`;
      this.app.audioEngine?.setCrossfade(val);
      window.api?.updateSettings({ crossfadeSeconds: val });
    });

    // Volume Normalization toggle
    this.dom.normalization?.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      window.api?.updateSettings({ volumeNormalization: enabled });
      this.app.showToast(enabled ? 'Normalização de volume ativada' : 'Normalização de volume desativada');
    });

    // Theme change
    this.dom.theme?.addEventListener('change', (e) => {
      const theme = e.target.value;
      window.api?.updateSettings({ theme });
      this.app.applyTheme(theme);
    });

    // Accent Color change
    this.dom.accentSwatches?.forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.dataset.color;
        const name = btn.dataset.name;
        this.dom.accentSwatches.forEach(b => b.classList.toggle('active', b === btn));
        if (this.dom.accentName) this.dom.accentName.textContent = `${name} (${color})`;
        this.app.applyAccentColor(color);
        window.api?.updateSettings({ accentColor: color });
      });
    });

    // Background Image
    this.dom.btnChooseBg?.addEventListener('click', async () => {
      const imgPath = await window.api.openImageDialog();
      if (imgPath) {
        window.api.updateSettings({ backgroundImage: imgPath });
        const dimVal = this.dom.dimmer ? parseFloat(this.dom.dimmer.value) : 0.4;
        this.app.applyBackground(imgPath, dimVal);
        this._syncBgUi(imgPath, dimVal);
      }
    });

    this.dom.btnResetBg?.addEventListener('click', () => {
      window.api?.updateSettings({ backgroundImage: null });
      this.app.applyBackground(null, 0.4);
      this._syncBgUi(null, 0.4);
    });

    // Dimmer
    this.dom.dimmer?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (this.dom.dimmerVal) this.dom.dimmerVal.textContent = `${Math.round(val * 100)}%`;
      window.api?.updateSettings({ backgroundDim: val });
      this.app.applyBackground(this.currentSettings.backgroundImage, val);
    });

    // Add Library Directory
    this.dom.btnAddDir?.addEventListener('click', async () => {
      const folder = await window.api.openFolderDialog();
      if (folder) {
        const folders = await window.api.addLibraryFolder(folder);
        this.currentSettings.libraryFolders = folders;
        this._renderDirectories();

        // Scan newly added folder
        this.app.showToast(`Escaneando pasta: ${folder}...`);
        const files = await window.api.scanFolder(folder);
        if (files.length > 0) {
          await window.api.parseMetadataBatch(files);
          this.app.showToast(`${files.length} faixas indexadas!`);
          if (this.app.views.recent) this.app.views.recent.loadTracks();
        }
      }
    });

    // Rescan all folders
    this.dom.btnRescanAll?.addEventListener('click', async () => {
      const folders = this.currentSettings.libraryFolders || [];
      if (folders.length === 0) {
        this.app.showToast('Nenhuma pasta monitorada configurada.');
        return;
      }
      this.app.showToast('Reescaneando diretórios...');
      let totalFound = 0;
      for (const f of folders) {
        const files = await window.api.scanFolder(f);
        if (files.length > 0) {
          await window.api.parseMetadataBatch(files);
          totalFound += files.length;
        }
      }
      this.app.showToast(`Escaneamento concluído: ${totalFound} faixas processadas.`);
      if (this.app.views.recent) this.app.views.recent.loadTracks();
    });

    // Escape key handling
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  async open() {
    this.isOpen = true;
    this.container.classList.add('open');
    this.currentSettings = await window.api.getSettings();
    this._syncState();
  }

  close() {
    this.isOpen = false;
    this.container.classList.remove('open');
  }

  _syncState() {
    const s = this.currentSettings;

    // Crossfade
    const fade = typeof s.crossfadeSeconds === 'number' ? s.crossfadeSeconds : 3;
    this.dom.crossfade.value = fade;
    this.dom.crossfadeVal.textContent = `${fade.toFixed(1)}s`;

    // Normalization
    this.dom.normalization.checked = !!s.volumeNormalization;

    // Theme
    this.dom.theme.value = s.theme || 'dark';

    // Accent Color
    const activeAccent = (s.accentColor || '#38bdf8').toLowerCase();
    this.dom.accentSwatches?.forEach(btn => {
      const match = (btn.dataset.color || '').toLowerCase() === activeAccent;
      btn.classList.toggle('active', match);
      if (match && this.dom.accentName) {
        this.dom.accentName.textContent = `${btn.dataset.name} (${btn.dataset.color})`;
      }
    });

    // Background & Dimmer
    this._syncBgUi(s.backgroundImage, s.backgroundDim);

    // Directories
    this._renderDirectories();

    // Stats
    window.api.getTracks().then(tracks => {
      if (this.dom.libStats) {
        this.dom.libStats.textContent = `${tracks.length} faixas registradas na biblioteca`;
      }
    });
  }

  _syncBgUi(imgPath, dimVal = 0.4) {
    if (imgPath) {
      this.dom.bgStatus.textContent = imgPath.split('/').pop();
      this.dom.btnResetBg.style.display = 'inline-flex';
      this.dom.dimmerRow.style.display = 'flex';
      this.dom.dimmer.value = dimVal;
      this.dom.dimmerVal.textContent = `${Math.round(dimVal * 100)}%`;
    } else {
      this.dom.bgStatus.textContent = 'Nenhuma imagem personalizada ativa';
      this.dom.btnResetBg.style.display = 'none';
      this.dom.dimmerRow.style.display = 'none';
    }
  }

  _renderDirectories() {
    const folders = this.currentSettings.libraryFolders || [];
    if (folders.length === 0) {
      this.dom.dirList.innerHTML = `
        <div style="font-size: 0.8rem; color: var(--text-muted); padding: 8px;">
          Nenhum diretório adicionado ainda. Clique em "Adicionar Pasta" para monitorar pastas locais.
        </div>
      `;
      return;
    }

    let html = '';
    folders.forEach((dirPath, idx) => {
      html += `
        <div class="settings-dir-item" data-index="${idx}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          <span class="settings-dir-path" title="${dirPath}">${dirPath}</span>
          <button class="btn-icon btn-remove-dir" title="Remover pasta" data-path="${dirPath}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      `;
    });

    this.dom.dirList.innerHTML = html;

    this.dom.dirList.querySelectorAll('.btn-remove-dir').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const p = btn.dataset.path;
        const updated = await window.api.removeLibraryFolder(p);
        this.currentSettings.libraryFolders = updated;
        this._renderDirectories();
      });
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SettingsModal;
}
