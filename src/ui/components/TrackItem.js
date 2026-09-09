/**
 * TrackItem & TrackSwipeController:
 * Modular swipe-to-action gesture handler and virtualized row encapsulation
 * for instant "Play Next" FIFO queuing and zero-lag 60fps lists.
 */

class TrackSwipeController {
  constructor(options = {}) {
    this.container = options.container;
    this.getTrackByIndex = options.getTrackByIndex || (() => null);
    this.onPlayNext = options.onPlayNext || (() => {});

    this.isTracking = false;
    this.isSwiping = false;
    this.activeRow = null;
    this.activeTrack = null;
    this.startX = 0;
    this.startY = 0;
    this.currentDeltaX = 0;
    this.currentPointerId = null;

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onPointerCancel = this._onPointerCancel.bind(this);

    this.attach(this.container);
  }

  attach(container) {
    if (!container) return;
    this.container = container;
    this.container.addEventListener('pointerdown', this._onPointerDown);
    this.container.addEventListener('pointermove', this._onPointerMove);
    this.container.addEventListener('pointerup', this._onPointerUp);
    this.container.addEventListener('pointercancel', this._onPointerCancel);
  }

  detach() {
    if (!this.container) return;
    this.container.removeEventListener('pointerdown', this._onPointerDown);
    this.container.removeEventListener('pointermove', this._onPointerMove);
    this.container.removeEventListener('pointerup', this._onPointerUp);
    this.container.removeEventListener('pointercancel', this._onPointerCancel);
    this.container = null;
  }

  _onPointerDown(e) {
    if (e.button !== 0) return; // Primary button only

    // Ignore clicks directly targeting interactive controls (buttons, inputs, menus)
    if (e.target.closest('button, input, select, a, .col-actions, .at-action-btn, .btn-row-fav, .btn-row-more, .row-play-trigger, .at-play-btn, .btn-track-menu, .drag-handle-col')) {
      return;
    }

    const row = e.target.closest('.spotify-track-row, .at-row, .track-row');
    if (!row) return;

    const idx = parseInt(row.dataset.index, 10);
    if (isNaN(idx)) return;

    const track = this.getTrackByIndex(idx);
    if (!track) return;

    this.isTracking = true;
    this.isSwiping = false;
    this.activeRow = row;
    this.activeTrack = track;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.currentDeltaX = 0;
    this.currentPointerId = e.pointerId;
  }

  _onPointerMove(e) {
    if (!this.isTracking || !this.activeRow) return;

    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;

    if (!this.isSwiping) {
      // 1. Detect vertical scrolling intent early (5px threshold)
      if (Math.abs(dy) > 5 && Math.abs(dy) > Math.abs(dx)) {
        // User is scrolling vertically - immediately abort horizontal tracking to prevent any scroll stutter
        this.isTracking = false;
        this.activeRow = null;
        this.activeTrack = null;
        return;
      }

      // 2. Detect horizontal drag to the right
      if (dx > 6 && dx > Math.abs(dy)) {
        this.isSwiping = true;
        this.activeRow.classList.add('swiping');
        const parentItem = this.activeRow.closest('.track-virtual-item') || this.activeRow.parentElement;
        parentItem?.classList.add('is-swiping');

        try {
          this.activeRow.setPointerCapture(e.pointerId);
        } catch (_) {}
      }
    }

    if (this.isSwiping) {
      // Prevent browser text selection or unintended default behaviors
      if (e.cancelable) e.preventDefault();

      // Clamp horizontal movement between 0 and 100px
      this.currentDeltaX = Math.max(0, Math.min(dx, 100));
      this.activeRow.style.transform = `translateX(${this.currentDeltaX}px)`;

      const parentItem = this.activeRow.closest('.track-virtual-item') || this.activeRow.parentElement;
      const revealEl = parentItem?.querySelector('.swipe-reveal-layer');
      if (revealEl) {
        if (this.currentDeltaX >= 70) {
          revealEl.classList.add('ready');
        } else {
          revealEl.classList.remove('ready');
        }
      }
    }
  }

  _onPointerUp(e) {
    if (!this.isTracking) return;

    const row = this.activeRow;
    const track = this.activeTrack;
    const wasSwiping = this.isSwiping;
    const deltaX = this.currentDeltaX;
    const pointerId = this.currentPointerId;

    this.isTracking = false;
    this.isSwiping = false;
    this.activeRow = null;
    this.activeTrack = null;
    this.currentPointerId = null;

    if (wasSwiping && row) {
      try {
        row.releasePointerCapture(pointerId);
      } catch (_) {}

      row.classList.remove('swiping');
      row.classList.add('swipe-snapping');
      row.style.transform = 'translateX(0px)';

      const parentItem = row.closest('.track-virtual-item') || row.parentElement;
      const revealEl = parentItem?.querySelector('.swipe-reveal-layer');
      revealEl?.classList.remove('ready');

      // Trigger action if reached activation threshold (70px)
      const triggered = deltaX >= 70;
      if (triggered && track) {
        this.onPlayNext(track);
      }

      // Suppress accidental click/dblclick playback right after swiping
      row._justSwiped = true;
      setTimeout(() => {
        row._justSwiped = false;
      }, 250);

      setTimeout(() => {
        row.classList.remove('swipe-snapping');
        parentItem?.classList.remove('is-swiping');
        row.style.transform = '';
      }, 260);
    }
  }

  _onPointerCancel(e) {
    this._onPointerUp(e);
  }
}

/**
 * Helper to render the unified background action layer
 */
function renderSwipeRevealLayer() {
  return `
    <div class="swipe-reveal-layer" aria-hidden="true">
      <div class="swipe-reveal-content">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 4 15 12 5 20 5 4"></polygon>
          <line x1="19" y1="5" x2="19" y2="19"></line>
        </svg>
        <span class="swipe-reveal-text">Tocar a seguir</span>
      </div>
    </div>
  `;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TrackSwipeController,
    renderSwipeRevealLayer
  };
}

if (typeof window !== 'undefined') {
  window.TrackSwipeController = TrackSwipeController;
  window.renderSwipeRevealLayer = renderSwipeRevealLayer;
}
