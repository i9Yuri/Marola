const { test, describe } = require('node:test');
const assert = require('node:assert');
const PlaylistCoverService = require('../src/services/playlistCoverService');

describe('PlaylistCoverService Dynamic Mosaic Covers', () => {
  test('Renders custom image when customCoverUrl is provided', () => {
    const playlist = { id: 'pl-1', name: 'My Mix', customCoverUrl: 'data:image/jpeg;base64,custom123' };
    const tracks = [{ coverDataUrl: 'data:image/jpeg;base64,track1' }];
    const html = PlaylistCoverService.getCoverHtml(playlist, tracks);

    assert(html.includes('data:image/jpeg;base64,custom123'));
    assert(html.includes('class="playlist-cover-img"'));
  });

  test('Renders placeholder note icon when tracks array is empty (0 tracks)', () => {
    const playlist = { id: 'pl-empty', name: 'Empty Playlist' };
    const html = PlaylistCoverService.getCoverHtml(playlist, []);

    assert(html.includes('class="playlist-cover-empty"'));
    assert(html.includes('<svg'));
    assert(!html.includes('<img'));
  });

  test('Renders single 100% cover of the first track when playlist has 1-3 tracks', () => {
    const playlist = { id: 'pl-few', name: 'Rock Classics' };
    const tracks = [
      { id: '1', title: 'Song 1', coverDataUrl: 'data:image/jpeg;base64,track1' },
      { id: '2', title: 'Song 2', coverDataUrl: 'data:image/jpeg;base64,track2' }
    ];
    const html = PlaylistCoverService.getCoverHtml(playlist, tracks);

    assert(html.includes('data:image/jpeg;base64,track1'));
    assert(!html.includes('data:image/jpeg;base64,track2'));
    assert(html.includes('class="playlist-cover-img"'));
    assert(!html.includes('playlist-mosaic-grid'));
  });

  test('Renders fallback placeholder when 1-3 tracks exist but track has no coverDataUrl', () => {
    const playlist = { id: 'pl-nocover', name: 'No Cover' };
    const tracks = [{ id: '1', title: 'No Cover Song' }];
    const html = PlaylistCoverService.getCoverHtml(playlist, tracks);

    assert(html.includes('class="playlist-cover-empty"'));
    assert(!html.includes('<img'));
  });

  test('Renders 2x2 dynamic mosaic grid when playlist has 4 or more tracks', () => {
    const playlist = { id: 'pl-many', name: 'Huge Library' };
    const tracks = [
      { id: '1', coverDataUrl: 'data:image/jpeg;base64,cover1' },
      { id: '2', coverDataUrl: 'data:image/jpeg;base64,cover2' },
      { id: '3', coverDataUrl: 'data:image/jpeg;base64,cover3' },
      { id: '4', coverDataUrl: 'data:image/jpeg;base64,cover4' },
      { id: '5', coverDataUrl: 'data:image/jpeg;base64,cover5' }
    ];
    const html = PlaylistCoverService.getCoverHtml(playlist, tracks);

    assert(html.includes('class="playlist-mosaic-grid"'));
    assert(html.includes('grid-template-columns: 1fr 1fr'));
    assert(html.includes('cover1'));
    assert(html.includes('cover2'));
    assert(html.includes('cover3'));
    assert(html.includes('cover4'));
    // 5th track should NOT be in the mosaic
    assert(!html.includes('cover5'));
  });

  test('Renders fallback tile inside 2x2 mosaic when some tracks lack coverDataUrl', () => {
    const playlist = { id: 'pl-mixed', name: 'Mixed Covers' };
    const tracks = [
      { id: '1', coverDataUrl: 'data:image/jpeg;base64,cover1' },
      { id: '2', coverDataUrl: null },
      { id: '3', coverDataUrl: 'data:image/jpeg;base64,cover3' },
      { id: '4', coverDataUrl: null }
    ];
    const html = PlaylistCoverService.getCoverHtml(playlist, tracks);

    assert(html.includes('class="playlist-mosaic-grid"'));
    assert(html.includes('mosaic-tile-img'));
    assert(html.includes('mosaic-tile-fallback'));
  });
});
