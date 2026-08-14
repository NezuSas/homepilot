import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';
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