import type { SnapshotDevice } from '../../stores/useDeviceSnapshotStore';
import { buildRoomSceneState, getCoverOpenPercent } from './roomSceneModel';

const device = (type: string, lastKnownState: Record<string, unknown> | null, extra: Partial<SnapshotDevice> = {}) => ({
  id: `${type}-${Math.random()}`, homeId: 'h', roomId: 'r', name: type, type, status: 'ASSIGNED', lastKnownState, ...extra,
} as unknown as SnapshotDevice);

describe('Feature: Room scene reflects real device state (REQ-06, REQ-07, AC4)', () => {
  it('turns the lamp on only when a light is known to be on', () => {
    expect(buildRoomSceneState([device('light', { state: 'on' })]).lightsOn).toBe(true);
    expect(buildRoomSceneState([device('light', { state: 'off' }), device('light', { on: true })]).lightsOn).toBe(true);
    expect(buildRoomSceneState([device('light', { state: 'off' })]).lightsOn).toBe(false);
    expect(buildRoomSceneState([device('light', { state: 'unknown' }), device('light', null)]).lightsOn).toBe(false);
    expect(buildRoomSceneState([device('switch', { state: 'on' })]).lightsOn).toBe(false);
  });

  it('reads the cover position and averages several covers', () => {
    expect(getCoverOpenPercent(device('cover', { current_position: 20 }))).toBe(20);
    expect(getCoverOpenPercent(device('cover', { attributes: { current_position: '70' } }))).toBe(70);
    expect(buildRoomSceneState([device('cover', { current_position: 20 }), device('cover', { position: 60 })]).curtainOpen).toBe(40);
  });

  it('honors inverted covers', () => {
    expect(getCoverOpenPercent(device('cover', { current_position: 20 }, { invertState: true }))).toBe(80);
    expect(getCoverOpenPercent(device('cover', { state: 'open' }, { invertState: true }))).toBe(0);
  });

  it('never treats an unknown position as closed', () => {
    expect(getCoverOpenPercent(device('cover', { state: 'unknown' }))).toBeNull();
    expect(getCoverOpenPercent(device('cover', { state: 'unavailable' }))).toBeNull();
    expect(getCoverOpenPercent(device('cover', null))).toBeNull();
    expect(buildRoomSceneState([device('cover', { state: 'unknown' })]).curtainOpen).toBeNull();
    expect(buildRoomSceneState([]).curtainOpen).toBeNull();
  });

  it('falls back to the open or closed label when there is no numeric position', () => {
    expect(getCoverOpenPercent(device('cover', { state: 'open' }))).toBe(100);
    expect(getCoverOpenPercent(device('cover', { state: 'closed' }))).toBe(0);
  });
});
