import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';
import { formatMediaTime, getDisplayedMediaPosition, getMediaPlayerPresentation } from './mediaPlayback';
import { getMediaArtworkSourceKey } from './mediaArtwork';

function createMediaDevice(updatedAt: string, artworkPath: string): SnapshotDevice {
  return {
    id: 'speaker-1',
    homeId: 'home-1',
    roomId: null,
    name: 'Z.TECH SPEAKER',
    type: 'media_player',
    status: 'ASSIGNED',
    updatedAt,
    lastKnownState: {
      state: 'playing',
      attributes: {
        entity_picture_local: artworkPath,
      },
    },
  };
}

describe('MediaPlayerCard artwork source', () => {
  it('keeps the same source across unrelated device state updates', () => {
    const before = createMediaDevice('2026-08-13T22:00:00.000Z', '/api/media_player_proxy/media_player.z_tech?token=first&cache=track-1');
    const after = createMediaDevice('2026-08-13T22:00:05.000Z', '/api/media_player_proxy/media_player.z_tech?token=second&cache=track-1');

    expect(getMediaArtworkSourceKey(before.lastKnownState)).toBe(getMediaArtworkSourceKey(after.lastKnownState));
  });

  it('changes the source only when Home Assistant publishes different artwork', () => {
    const current = createMediaDevice('2026-08-13T22:00:00.000Z', '/api/media_player_proxy/media_player.z_tech?cache=track-1');
    const next = createMediaDevice('2026-08-13T22:00:05.000Z', '/api/media_player_proxy/media_player.z_tech?cache=track-2');

    expect(getMediaArtworkSourceKey(current.lastKnownState)).not.toBe(getMediaArtworkSourceKey(next.lastKnownState));
  });
});
describe('MediaPlayerCard playback progress', () => {
  it('reads the Home Assistant playback attributes and advances a playing session', () => {
    const presentation = getMediaPlayerPresentation({
      ...createMediaDevice('2026-08-25T19:00:00.000Z', ''),
      lastKnownState: {
        state: 'playing',
        attributes: {
          media_position: 42,
          media_duration: 210,
          media_position_updated_at: '2026-08-25T19:00:00.000Z',
        },
      },
    });

    expect(getDisplayedMediaPosition(presentation, Date.parse('2026-08-25T19:00:05.000Z'))).toBe(47);
    expect(formatMediaTime(47)).toBe('0:47');
    expect(formatMediaTime(3661)).toBe('1:01:01');
  });

  it('does not invent playback progress when Home Assistant omits its duration', () => {
    const presentation = getMediaPlayerPresentation({
      ...createMediaDevice('2026-08-25T19:00:00.000Z', ''),
      lastKnownState: {
        state: 'playing',
        attributes: { media_position: 42 },
      },
    });

    expect(getDisplayedMediaPosition(presentation)).toBeNull();
  });
});