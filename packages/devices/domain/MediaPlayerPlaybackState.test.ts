import { normalizeMediaPlaybackState } from './MediaPlayerPlaybackState';

function playingState(position: number, title = 'Canción A'): Record<string, unknown> {
  return {
    state: 'playing',
    attributes: {
      media_title: title,
      media_artist: 'Artista',
      media_duration: 240,
      media_position: position,
      media_position_updated_at: '2026-08-27T19:00:00.000Z',
    },
  };
}

describe('MediaPlayerPlaybackState', () => {
  it('keeps a server reference when a bridge republishes a stationary position', () => {
    const first = normalizeMediaPlaybackState(null, playingState(0), '2026-08-27T19:00:00.000Z');
    const repeated = normalizeMediaPlaybackState(first, playingState(0), '2026-08-27T19:02:00.000Z');
    const attributes = repeated.attributes as Record<string, unknown>;

    expect(attributes.homepilot_media_position).toBe(0);
    expect(attributes.homepilot_media_position_updated_at).toBe('2026-08-27T19:00:00.000Z');
    expect(attributes.homepilot_native_media_position).toBe(0);
  });

  it('resynchronizes the server reference after a real position change or content change', () => {
    const first = normalizeMediaPlaybackState(null, playingState(0), '2026-08-27T19:00:00.000Z');
    const progressed = normalizeMediaPlaybackState(first, playingState(12), '2026-08-27T19:00:12.000Z');
    const nextTrack = normalizeMediaPlaybackState(progressed, playingState(0, 'Canción B'), '2026-08-27T19:01:00.000Z');

    expect((progressed.attributes as Record<string, unknown>).homepilot_media_position).toBe(12);
    expect((progressed.attributes as Record<string, unknown>).homepilot_media_position_updated_at).toBe('2026-08-27T19:00:12.000Z');
    expect((nextTrack.attributes as Record<string, unknown>).homepilot_media_position).toBe(0);
    expect((nextTrack.attributes as Record<string, unknown>).homepilot_media_position_updated_at).toBe('2026-08-27T19:01:00.000Z');
  });
});