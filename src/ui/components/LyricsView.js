/**
 * LyricsView: Synchronized LRC & plain USLT lyrics viewer with autoscroll
 */
class LyricsView {
  constructor(appContext) {
    this.app = appContext;
    this.container = null;
    this.isOpen = false;
    this.lyricsData = null; // { lines: [], plain: '' }
    this.currentLineIndex = -1;
  }

  mount(containerElement) {
    this.container = containerElement;
    this.render();

    this.app.audioEngine.on('trackChange', async ({ track }) => {
      if (this.isOpen) {
        await this.loadLyricsForTrack(track);
      }
    });

    this.app.audioEngine.on('timeupdate', ({ currentTime }) => {
      if (this.isOpen && this.lyricsData && this.lyricsData.lines.length > 0) {
        this.updateActiveLine(currentTime);
      }
    });
  }

  render() {
    this.container.className = 'drawer-panel';
    this.container.id = 'lyrics-drawer';
    this.container.innerHTML = `
      <div class="drawer-header">
        <h3>Letras da Música</h3>
        <button class="btn-icon" id="btn-close-lyrics">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="drawer-content" id="lyrics-drawer-content">
        <!-- Lyrics content -->
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    this.container.querySelector('#btn-close-lyrics').addEventListener('click', () => {
      this.close();
    });
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  async open() {
    this.isOpen = true;
    this.container.classList.add('open');
    const track = this.app.queueManager.getCurrentTrack();
    await this.loadLyricsForTrack(track);
  }

  close() {
    this.isOpen = false;
    this.container.classList.remove('open');
  }

  async loadLyricsForTrack(track) {
    const content = this.container.querySelector('#lyrics-drawer-content');
    if (!content) return;

    if (!track) {
      this.lyricsData = null;
      content.innerHTML = `
        <div class="empty-state" style="padding: 60px 0;">
          <p>Nenhuma faixa em reprodução</p>
        </div>
      `;
      return;
    }

    content.innerHTML = `
      <div class="empty-state" style="padding: 60px 0;">
        <p>Buscando letras...</p>
      </div>
    `;

    try {
      this.lyricsData = await window.api.getLyrics(track.filePath);
      this.renderLyrics();
    } catch (err) {
      console.error('[LyricsView] Error loading lyrics:', err);
      this.lyricsData = null;
      this.renderLyrics();
    }
  }

  renderLyrics() {
    const content = this.container.querySelector('#lyrics-drawer-content');
    if (!content) return;

    if (!this.lyricsData || (!this.lyricsData.lines?.length && !this.lyricsData.plain)) {
      content.innerHTML = `
        <div class="empty-state" style="padding: 60px 0;">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          <p>Nenhuma letra encontrada</p>
          <span style="font-size: 0.78rem;">Adicione um arquivo .lrc na mesma pasta da música</span>
        </div>
      `;
      return;
    }

    // Check if synced
    const hasSync = this.lyricsData.lines.some(l => l.time >= 0);

    if (hasSync) {
      let html = '<div class="lyrics-container" id="synced-lyrics-list">';
      this.lyricsData.lines.forEach((line, idx) => {
        html += `<div class="lyric-line" id="lyric-line-${idx}" data-time="${line.time}">${this._escapeHtml(line.text || '...')}</div>`;
      });
      html += '</div>';
      content.innerHTML = html;
      this.currentLineIndex = -1;
    } else {
      // Plain text
      content.innerHTML = `
        <div class="lyrics-container" style="white-space: pre-wrap; font-size: 0.95rem; line-height: 1.8; text-align: left; padding: 20px;">
          ${this._escapeHtml(this.lyricsData.plain || '')}
        </div>
      `;
    }
  }

  updateActiveLine(currentTime) {
    if (!this.lyricsData?.lines?.length) return;

    let targetIdx = -1;
    for (let i = 0; i < this.lyricsData.lines.length; i++) {
      if (this.lyricsData.lines[i].time <= currentTime) {
        targetIdx = i;
      } else {
        break;
      }
    }

    if (targetIdx !== this.currentLineIndex) {
      if (this.currentLineIndex !== -1) {
        const prevEl = this.container.querySelector(`#lyric-line-${this.currentLineIndex}`);
        if (prevEl) prevEl.classList.remove('active');
      }

      this.currentLineIndex = targetIdx;

      if (targetIdx !== -1) {
        const curEl = this.container.querySelector(`#lyric-line-${targetIdx}`);
        if (curEl) {
          curEl.classList.add('active');
          curEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }

  _escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LyricsView;
}
