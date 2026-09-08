/**
 * PlaylistCoverService: Generates reactive dynamic playlist covers based on tracks.
 * - If custom cover is specified: renders custom image.
 * - If 0 tracks: renders monochrome placeholder with music note icon.
 * - If 1-3 tracks: renders 100% cover of the first track.
 * - If 4+ tracks: renders dynamic 2x2 mosaic grid with covers of the first 4 tracks.
 */
class PlaylistCoverService {
  /**
   * Generates HTML markup for a playlist cover.
   * @param {Object} playlist Playlist data object { id, name, customCoverUrl }
   * @param {Array<Object>} tracks Array of track objects in their indexed order
   * @param {Object} options Configuration options
   * @returns {string} HTML string
   */
  static getCoverHtml(playlist = {}, tracks = [], options = {}) {
    // 1. Explicit custom cover
    if (playlist?.customCoverUrl) {
      const escaped = PlaylistCoverService._escapeHtml(playlist.name || 'Playlist');
      return `<img src="${playlist.customCoverUrl}" alt="${escaped}" class="playlist-cover-img" style="width: 100%; height: 100%; object-fit: cover; display: block;">`;
    }

    const validTracks = Array.isArray(tracks) ? tracks : [];

    // 2. Empty playlist (0 tracks)
    if (validTracks.length === 0) {
      return `
        <div class="playlist-cover-empty" style="width: 100%; height: 100%; background: #282828; display: flex; align-items: center; justify-content: center; color: #b3b3b3;">
          <svg width="42%" height="42%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
          </svg>
        </div>
      `;
    }

    // 3. 1 to 3 tracks: use first track's cover
    if (validTracks.length < 4) {
      const first = validTracks[0];
      if (first?.coverDataUrl) {
        const title = PlaylistCoverService._escapeHtml(playlist?.name || first.title || 'Playlist');
        return `<img src="${first.coverDataUrl}" alt="${title}" class="playlist-cover-img" style="width: 100%; height: 100%; object-fit: cover; display: block;">`;
      }
      return `
        <div class="playlist-cover-empty" style="width: 100%; height: 100%; background: #282828; display: flex; align-items: center; justify-content: center; color: #b3b3b3;">
          <svg width="42%" height="42%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
          </svg>
        </div>
      `;
    }

    // 4. 4 or more tracks: 2x2 dynamic mosaic grid
    const firstFour = validTracks.slice(0, 4);
    const tilesHtml = firstFour.map((t, idx) => {
      if (t?.coverDataUrl) {
        return `<img src="${t.coverDataUrl}" alt="Faixa ${idx + 1}" class="mosaic-tile-img" style="width: 100%; height: 100%; object-fit: cover; display: block;">`;
      }
      return `
        <div class="mosaic-tile-fallback" style="width: 100%; height: 100%; background: #242424; display: flex; align-items: center; justify-content: center; color: #777;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
          </svg>
        </div>
      `;
    }).join('');

    return `
      <div class="playlist-mosaic-grid" style="display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; aspect-ratio: 1 / 1; width: 100%; height: 100%; overflow: hidden;">
        ${tilesHtml}
      </div>
    `;
  }

  static _escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlaylistCoverService;
}
if (typeof window !== 'undefined') {
  window.PlaylistCoverService = PlaylistCoverService;
}
