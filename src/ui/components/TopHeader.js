/**
 * TopHeader: Modern top navigation bar with history back/forward controls,
 * prominent Home button, centered search pill, and profile/settings actions.
 */
class TopHeader {
  constructor(appContext, options = {}) {
    this.app = appContext;
    this.options = {
      onNavigateBack: options.onNavigateBack || (() => {}),
      onNavigateForward: options.onNavigateForward || (() => {}),
      onHomeClick: options.onHomeClick || (() => {}),
      onSearchInput: options.onSearchInput || (() => {}),
      onBrowseClick: options.onBrowseClick || (() => {}),
      onOpenSettings: options.onOpenSettings || (() => {})
    };
    this.container = null;
    this.canGoBack = false;
    this.canGoForward = false;
  }

  mount(containerElement) {
    this.container = containerElement;
    this.render();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <header class="top-header-bar">
        <!-- Left: Navigation history controls -->
        <div class="top-nav-history">
          <button class="top-nav-circle-btn" id="top-btn-back" title="Voltar" ${!this.canGoBack ? 'disabled' : ''}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <button class="top-nav-circle-btn" id="top-btn-forward" title="Avançar" ${!this.canGoForward ? 'disabled' : ''}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>

        <!-- Center: Home and Search Pill -->
        <div class="top-nav-center">
          <button class="top-home-btn active" id="top-btn-home" title="Início">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
          </button>

          <div class="top-search-pill">
            <div class="top-search-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
            <input type="text" id="top-search-input" placeholder="O que você quer ouvir?" spellcheck="false" autocomplete="off">
            <div class="top-search-divider"></div>
            <button class="top-search-browse-btn" id="top-btn-browse" title="Adicionar pasta / Explorar arquivos">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2"></rect>
                <path d="M8 15h8"></path>
                <circle cx="12" cy="10" r="1" fill="currentColor"></circle>
              </svg>
            </button>
          </div>
        </div>

        <!-- Right: Notifications, Settings & Profile -->
        <div class="top-nav-right">
          <button class="top-circle-action-btn" id="top-btn-notifications" title="Novidades & Notificações">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </button>
          <button class="top-circle-action-btn" id="top-btn-settings" title="Configurações">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
          <div class="top-user-avatar" id="top-btn-profile" title="JustPlay Offline Profile">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
        </div>
      </header>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const btnBack = this.container.querySelector('#top-btn-back');
    const btnForward = this.container.querySelector('#top-btn-forward');
    const btnHome = this.container.querySelector('#top-btn-home');
    const searchInput = this.container.querySelector('#top-search-input');
    const btnBrowse = this.container.querySelector('#top-btn-browse');
    const btnSettings = this.container.querySelector('#top-btn-settings');
    const btnNotifications = this.container.querySelector('#top-btn-notifications');

    btnBack?.addEventListener('click', () => this.options.onNavigateBack());
    btnForward?.addEventListener('click', () => this.options.onNavigateForward());
    btnHome?.addEventListener('click', () => this.options.onHomeClick());

    let searchDebounceTimer = null;
    const triggerSearch = (val) => {
      this.searchTerm = val;
      if (this.options.onSearchInput) this.options.onSearchInput(val);
      if (this.options.onSearch) this.options.onSearch(val);
    };

    searchInput?.addEventListener('input', (e) => {
      const val = e.target.value;
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        triggerSearch(val);
      }, 200);
    });

    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(searchDebounceTimer);
        triggerSearch(e.target.value);
      }
    });

    btnBrowse?.addEventListener('click', () => {
      if (this.options.onBrowseClick) this.options.onBrowseClick();
      if (this.options.onBrowseFolder) this.options.onBrowseFolder();
    });
    btnSettings?.addEventListener('click', () => this.options.onOpenSettings());

    btnNotifications?.addEventListener('click', () => {
      this.app.showToast('Você está em dia com sua biblioteca local!');
    });
  }

  updateNavState(canBack, canForward) {
    this.canGoBack = canBack;
    this.canGoForward = canForward;
    const btnBack = this.container?.querySelector?.('#top-btn-back');
    const btnForward = this.container?.querySelector?.('#top-btn-forward');
    if (btnBack) btnBack.disabled = !canBack;
    if (btnForward) btnForward.disabled = !canForward;
  }

  setSearchValue(val) {
    this.searchTerm = val || '';
    const input = this.container?.querySelector?.('#top-search-input');
    if (input) input.value = this.searchTerm;
  }

  setSearchTerm(val) {
    this.setSearchValue(val);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TopHeader;
}
