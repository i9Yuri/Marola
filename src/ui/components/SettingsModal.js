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
                <span id="setting-accent-name">Verde Spotify (#1ed760)</span>
              </div>
              <div class="settings-control-inline">
                <div class="accent-swatch-list" id="setting-accent-swatches">
                  <button type="button" class="accent-swatch-btn active" data-color="#1ed760" data-name="Verde Spotify" style="background-color: #1ed760;" title="Verde Spotify"></button>
                  <button type="button" class="accent-swatch-btn" data-color="#f59e0b" data-name="Laranja Âmbar" style="background-color: #f59e0b;" title="Laranja Âmbar"></button>
                  <button type="button" class="accent-swatch-btn" data-color="#10b981" data-name="Verde Esmeralda" style="background-color: #10b981;" title="Verde Esmeralda"></button>
                  <button type="button" class="accent-swatch-btn" data-color="#e11d48" data-name="Carmesim Sóbrio" style="background-color: #e11d48;" title="Carmesim Sóbrio"></button>
                  <button type="button" class="accent-swatch-btn" data-color="#06b6d4" data-name="Ciano Puro" style="background-color: #06b6d4;" title="Ciano Puro"></button>
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

          <!-- Section 3: Music Folders Manager (Pastas de Mídia) -->
          <div class="settings-section">
            <h4 class="settings-section-title">Pastas de Mídia</h4>
            <div class="settings-row" style="flex-direction: column; align-items: stretch; gap: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
                <div class="settings-label" style="max-width: 70%;">
                  <strong>Diretórios Monitorados</strong>
                  <span>As faixas exibidas na biblioteca provêm exclusivamente das pastas ativas listadas abaixo. Desmarque uma pasta para ocultar suas músicas temporariamente ou remova-a para desvincular do acervo.</span>
                </div>
                <div style="display: flex; gap: 8px; flex-shrink: 0;">
                  <button class="btn btn-secondary btn-sm" id="setting-btn-rescan-all" title="Reescanear todas as pastas ativas">
                    Escanear Todas
                  </button>
                  <button class="btn-add-music-folder" id="setting-btn-add-dir" title="Adicionar novo diretório de músicas">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
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
                <span>Formatos decodificados localmente: <code>.mp3</code>, <code>.flac</code>, <code>.wav</code>, <code>.ogg</code>, <code>.opus</code>, <code>.m4a</code> e letras <code>.lrc</code>.</span>
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

    // Add Music Folder
    this.dom.btnAddDir?.addEventListener('click', async () => {
      const folder = window.api?.selectMusicFolder
        ? await window.api.selectMusicFolder()
        : await window.api?.openFolderDialog();

      if (folder) {
        this.app.showToast(`Adicionando pasta: ${folder}...`);
        let newEntry = null;
        if (window.api?.addMusicFolder) {
          newEntry = await window.api.addMusicFolder(folder);
        } else if (window.api?.addLibraryFolder) {
          await window.api.addLibraryFolder(folder);
        }

        // Scan newly added folder in background
        if (window.api?.scanFolder) {
          const files = await window.api.scanFolder(folder);
          if (files && files.length > 0 && window.api?.parseMetadataBatch) {
            this.app.showToast(`Indexando ${files.length} faixas encontradas...`);
            await window.api.parseMetadataBatch(files);
          }
        }

        if (window.api?.getSettings) {
          this.currentSettings = await window.api.getSettings();
        } else if (newEntry && Array.isArray(this.currentSettings.musicFolders)) {
          this.currentSettings.musicFolders.push(newEntry);
        }

        this._renderDirectories();
        this.app.showToast('Pasta adicionada à biblioteca!');
        if (this.app.views.recent) await this.app.views.recent.loadTracks();
      }
    });

    // Rescan all folders
    this.dom.btnRescanAll?.addEventListener('click', async () => {
      this.app.showToast('Reescaneando pastas monitoradas...');
      if (window.api?.scanAllFolders) {
        const result = await window.api.scanAllFolders();
        if (result?.folders) {
          this.currentSettings.musicFolders = result.folders;
        }
        this._renderDirectories();
        this.app.showToast(`Varredura concluída: ${result?.totalFound || 0} faixas processadas.`);
      } else {
        const folders = this.currentSettings.musicFolders || [];
        let totalFound = 0;
        for (const f of folders) {
          if (f.enabled === false) continue;
          const files = await window.api.scanFolder(f.path);
          if (files && files.length > 0) {
            await window.api.parseMetadataBatch(files);
            totalFound += files.length;
          }
        }
        this.app.showToast(`Varredura concluída: ${totalFound} faixas processadas.`);
      }
      if (this.app.views.recent) await this.app.views.recent.loadTracks();
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
    const activeAccent = (s.accentColor || '#1ed760').toLowerCase();
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
    let folders = this.currentSettings.musicFolders;
    if (!Array.isArray(folders) || folders.length === 0) {
      if (Array.isArray(this.currentSettings.libraryFolders) && this.currentSettings.libraryFolders.length > 0) {
        folders = this.currentSettings.libraryFolders.map((p, i) => ({
          id: `fld_leg_${i}`,
          path: p,
          enabled: true,
          trackCount: 0,
          lastScanned: null
        }));
      } else {
        folders = [];
      }
    }

    if (!this.dom.dirList) return;

    if (folders.length === 0) {
      this.dom.dirList.innerHTML = `
        <div class="settings-folders-empty">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="margin-bottom: 6px; opacity: 0.6;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          <div style="font-weight: 600; color: #b3b3b3;">Nenhuma pasta de mídia monitorada</div>
          <div style="font-size: 0.76rem; color: #777777; margin-top: 3px;">Clique em "Adicionar Pasta" para indexar pastas locais do seu sistema.</div>
        </div>
      `;
      return;
    }

    let html = '';
    folders.forEach(f => {
      const isEnabled = f.enabled !== false;
      const count = typeof f.trackCount === 'number' ? f.trackCount : 0;
      const countLabel = `${count} faixa${count === 1 ? '' : 's'}`;
      const statusLabel = isEnabled ? 'Ativa' : 'Desativada';
      const escapedPath = this._escapeHtml(f.path);
      const displayPath = this._formatPathMiddle(f.path, 46);

      html += `
        <div class="settings-folder-card ${isEnabled ? '' : 'disabled'}" data-id="${f.id}">
          <div class="folder-info-col">
            <div class="folder-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <div class="folder-details">
              <div class="folder-path-text" title="${escapedPath}">${displayPath}</div>
              <div class="folder-meta-row">
                <span class="folder-count-badge">${countLabel}</span>
                <span class="folder-status-indicator">${statusLabel}</span>
              </div>
            </div>
          </div>
          <div class="folder-actions-col">
            <label class="toggle-switch" title="${isEnabled ? 'Desativar pasta' : 'Ativar pasta'}">
              <input type="checkbox" class="folder-toggle-input" data-id="${f.id}" ${isEnabled ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
            <button class="btn-remove-folder" title="Excluir pasta da lista monitorada" data-id="${f.id}" data-path="${escapedPath}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      `;
    });

    this.dom.dirList.innerHTML = html;

    // Toggle switch listeners
    this.dom.dirList.querySelectorAll('.folder-toggle-input').forEach(input => {
      input.addEventListener('change', async () => {
        const id = input.dataset.id;
        const checked = input.checked;
        if (window.api?.toggleMusicFolder) {
          await window.api.toggleMusicFolder(id, checked);
        }
        const target = this.currentSettings.musicFolders?.find(item => item.id === id);
        if (target) target.enabled = checked;

        const card = input.closest('.settings-folder-card');
        if (card) {
          card.classList.toggle('disabled', !checked);
          const statusEl = card.querySelector('.folder-status-indicator');
          if (statusEl) statusEl.textContent = checked ? 'Ativa' : 'Desativada';
        }

        this.app.showToast(checked ? 'Pasta reativada na biblioteca' : 'Pasta desativada (faixas ocultadas)');
        if (this.app.views.recent) {
          await this.app.views.recent.loadTracks();
        }
      });
    });

    // Remove folder listeners
    this.dom.dirList.querySelectorAll('.btn-remove-folder').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const p = btn.dataset.path;
        if (window.api?.removeMusicFolder) {
          const updated = await window.api.removeMusicFolder(id);
          this.currentSettings.musicFolders = updated;
        } else if (window.api?.removeLibraryFolder) {
          const updated = await window.api.removeLibraryFolder(p);
          this.currentSettings.libraryFolders = updated;
        } else {
          this.currentSettings.musicFolders = (this.currentSettings.musicFolders || []).filter(f => f.id !== id);
        }
        this._renderDirectories();
        this.app.showToast('Pasta removida da lista e registros purgados.');
        if (this.app.views.recent) {
          await this.app.views.recent.loadTracks();
        }
      });
    });
  }

  _formatPathMiddle(fullPath, maxLen = 46) {
    if (!fullPath || fullPath.length <= maxLen) return fullPath || '';
    const half = Math.floor((maxLen - 3) / 2);
    return fullPath.substring(0, half) + '...' + fullPath.substring(fullPath.length - half);
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
  module.exports = SettingsModal;
}
