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
    this._ensureBackdrop();
  }

  _ensureBackdrop() {
    if (typeof document === 'undefined') return;
    let backdrop = document.getElementById('queue-drawer-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'queue-drawer-backdrop';
      backdrop.className = 'drawer-backdrop';
      document.body.appendChild(backdrop);
    }
    this.backdropEl = backdrop;
    this.backdropEl.onclick = () => this.close();
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

    this._onPointerDown = (e) => {
      if (!this.isOpen) return;
      // If clicked inside the drawer or inside the queue toggle button, ignore
      if (this.container && this.container.contains(e.target)) return;
      if (e.target.closest && e.target.closest('#btn-queue')) return;
      this.close();
    };

    this._onKeyDown = (e) => {
      if (!this.isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    };
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
    this._ensureBackdrop();
    if (this.backdropEl) {
      this.backdropEl.classList.add('open');
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('pointerdown', this._onPointerDown);
      document.addEventListener('keydown', this._onKeyDown);
    }
    this.renderQueueItems();
  }

  close() {
    this.isOpen = false;
    this.container.classList.remove('open');
    if (this.backdropEl) {
      this.backdropEl.classList.remove('open');
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('pointerdown', this._onPointerDown);
      document.removeEventListener('keydown', this._onKeyDown);
    }
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
        <div class="queue-item ${isCurrent ? 'current' : ''}" data-index="${idx}" draggable="true">
          <div class="drag-handle" title="Arrastar para reordenar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="6" r="1.8"></circle>
              <circle cx="15" cy="6" r="1.8"></circle>
              <circle cx="9" cy="12" r="1.8"></circle>
              <circle cx="15" cy="12" r="1.8"></circle>
              <circle cx="9" cy="18" r="1.8"></circle>
              <circle cx="15" cy="18" r="1.8"></circle>
            </svg>
          </div>
          <div class="queue-item-info clickable">
            <div class="queue-item-title">${this._escapeHtml(track.title || 'Sem título')}</div>
            <div class="queue-item-artist">${this._escapeHtml(track.artist || 'Artista desconhecido')}</div>
          </div>
          <button class="btn-icon btn-q-remove" title="Remover da fila" style="color: var(--danger);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      `;
    });

    content.innerHTML = `<div class="queue-list">${html}</div>`;

    const items = content.querySelectorAll('.queue-item');

    items.forEach(item => {
      const idx = parseInt(item.dataset.index, 10);
      const track = queue[idx];

      // Play on track info click
      item.querySelector('.queue-item-info').addEventListener('click', () => {
        this.app.queueManager.jumpTo(idx);
        this.app.audioEngine.playTrack(track);
      });

      // Remove button
      item.querySelector('.btn-q-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.queueManager.removeTrack(idx);
      });

      // HTML5 Drag and Drop events
      item.addEventListener('dragstart', (e) => {
        this.draggedIndex = idx;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', idx.toString());
        setTimeout(() => item.classList.add('is-dragging'), 0);
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = item.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;

        if (e.clientY < mid) {
          item.classList.add('drop-target-above');
          item.classList.remove('drop-target-below');
        } else {
          item.classList.add('drop-target-below');
          item.classList.remove('drop-target-above');
        }
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('drop-target-above', 'drop-target-below');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('drop-target-above', 'drop-target-below');

        const fromIdx = parseInt(e.dataTransfer.getData('text/plain') ?? this.draggedIndex, 10);
        if (isNaN(fromIdx) || fromIdx === idx) return;

        const rect = item.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        let targetIdx = idx;

        // If dropped below midpoint and dragging downwards, target current
        // If dropped below midpoint and dragging upwards, target is current or next
        if (e.clientY >= mid && fromIdx < idx) {
          targetIdx = idx;
        } else if (e.clientY < mid && fromIdx > idx) {
          targetIdx = idx;
        }

        this.app.queueManager.moveTrack(fromIdx, targetIdx);
      });

      item.addEventListener('dragend', () => {
        items.forEach(el => el.classList.remove('is-dragging', 'drop-target-above', 'drop-target-below'));
        this.draggedIndex = null;
      });
    });
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
  module.exports = QueueView;
}
