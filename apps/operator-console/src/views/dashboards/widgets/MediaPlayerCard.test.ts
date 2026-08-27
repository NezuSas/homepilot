import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';
import { formatMediaTime, getDisplayedMediaPosition, getMediaPlayerPresentation, shouldResyncMediaPlaybackReference } from './mediaPlayback';
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
  it('invalidates artwork when the title changes even if the bridge reuses the same image route', () => {
    const current = createMediaDevice('2026-08-13T22:00:00.000Z', '/api/hass_agent/media_player.oscar/thumbnail.png');
    const next = createMediaDevice('2026-08-13T22:00:05.000Z', '/api/hass_agent/media_player.oscar/thumbnail.png');
    current.lastKnownState = {
      state: 'playing',
      attributes: { entity_picture: '/api/hass_agent/media_player.oscar/thumbnail.png', media_title: 'Canción anterior' },
    };
    next.lastKnownState = {
      state: 'playing',
      attributes: { entity_picture: '/api/hass_agent/media_player.oscar/thumbnail.png', media_title: 'Canción actual' },
    };

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

  it('keeps the local clock when a bridge refreshes its timestamp without advancing the position', () => {
    const reference = {
      sourceKey: 'same-track',
      position: 0.011388,
      referenceAt: Date.parse('2026-08-27T18:10:50.469Z'),
    };

    expect(shouldResyncMediaPlaybackReference(reference, 'same-track', 0.011388, 2)).toBe(false);
    expect(shouldResyncMediaPlaybackReference(reference, 'next-track', 0.011388, 2)).toBe(true);
    expect(shouldResyncMediaPlaybackReference(reference, 'same-track', 3.1, 2)).toBe(true);
  });

  it('advances a playing session from its local receipt time when the integration omits the timestamp', () => {
    const presentation = getMediaPlayerPresentation({
      ...createMediaDevice('2026-08-25T19:00:00.000Z', ''),
      lastKnownState: {
        state: 'playing',
        attributes: {
          media_position: 1,
          media_duration: 299,
        },
      },
    });

    const receivedAt = Date.parse('2026-08-25T19:00:00.000Z');
    expect(getDisplayedMediaPosition(presentation, receivedAt + 5000, { position: 1, referenceAt: receivedAt })).toBe(6);
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