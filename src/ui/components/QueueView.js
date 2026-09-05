/**
 * QueueView: Side drawer for playback queue inspection, reordering, and removal
 */
class QueueView {
  constructor(appContext) {
    this.app = appContext;
    this.container = null;
    this.isOpen = false;
  }

  mount(containerElement) {
    this.container = containerElement;
    this.render();

    this.app.queueManager.on('queueChanged', () => {
      if (this.isOpen) this.renderQueueItems();
    });
    this.app.queueManager.on('currentTrackChanged', () => {
      if (this.isOpen) this.renderQueueItems();
    });
  }

  render() {
    this.container.className = 'drawer-panel';
    this.container.id = 'queue-drawer';
    this.container.innerHTML = `
      <div class="drawer-header">
        <h3>Fila de Reprodução</h3>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" id="btn-clear-queue" style="padding: 4px 8px; font-size: 0.78rem;">
            Limpar
          </button>
          <button class="btn-icon" id="btn-close-queue">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>
      <div class="drawer-content" id="queue-drawer-items">
        <!-- Queue items list -->
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    this.container.querySelector('#btn-close-queue').addEventListener('click', () => {
      this.close();
    });

    this.container.querySelector('#btn-clear-queue').addEventListener('click', () => {
      this.app.queueManager.clear();
      this.app.audioEngine.pause();
      this.renderQueueItems();
    });
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.isOpen = true;
    this.container.classList.add('open');
    this.renderQueueItems();
  }

  close() {
    this.isOpen = false;
    this.container.classList.remove('open');
  }

  renderQueueItems() {
    const content = this.container.querySelector('#queue-drawer-items');
    if (!content) return;

    const queue = this.app.queueManager.queue;
    const currentIdx = this.app.queueManager.currentIndex;

    if (queue.length === 0) {
      content.innerHTML = `
        <div class="empty-state" style="padding: 60px 0;">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
          <p>Fila vazia</p>
          <span style="font-size: 0.78rem;">Adicione faixas da biblioteca</span>
        </div>
      `;
      return;
    }

    let html = '';
    queue.forEach((track, idx) => {
      const isCurrent = idx === currentIdx;
      html += `
        <div class="queue-item ${isCurrent ? 'current' : ''}" data-index="${idx}">
          <button class="btn-icon btn-q-play" title="Tocar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          </button>
          <div class="queue-item-info">
            <div class="queue-item-title">${track.title || 'Sem título'}</div>
            <div class="queue-item-artist">${track.artist || 'Artista desconhecido'}</div>
          </div>
          <button class="btn-icon btn-q-up" title="Mover para cima" ${idx === 0 ? 'disabled style="opacity:0.3;"' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
          </button>
          <button class="btn-icon btn-q-down" title="Mover para baixo" ${idx === queue.length - 1 ? 'disabled style="opacity:0.3;"' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          <button class="btn-icon btn-q-remove" title="Remover da fila" style="color: var(--danger);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      `;
    });

    content.innerHTML = `<div class="queue-list">${html}</div>`;

    content.querySelectorAll('.queue-item').forEach(item => {
      const idx = parseInt(item.dataset.index, 10);
      const track = queue[idx];

      item.querySelector('.btn-q-play').addEventListener('click', () => {
        this.app.queueManager.jumpTo(idx);
        this.app.audioEngine.playTrack(track);
      });

      item.querySelector('.btn-q-remove').addEventListener('click', () => {
        this.app.queueManager.removeTrack(idx);
      });

      const btnUp = item.querySelector('.btn-q-up');
      const btnDown = item.querySelector('.btn-q-down');

      if (btnUp && idx > 0) {
        btnUp.addEventListener('click', () => {
          this.app.queueManager.moveTrack(idx, idx - 1);
        });
      }

      if (btnDown && idx < queue.length - 1) {
        btnDown.addEventListener('click', () => {
          this.app.queueManager.moveTrack(idx, idx + 1);
        });
      }
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = QueueView;
}
