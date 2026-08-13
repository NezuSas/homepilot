import { ScopeFilter } from '../application/ScopeFilter';
import { createTestDevice } from './test_helpers';

describe('ScopeFilter', () => {
  const scopeFilter = new ScopeFilter();

  it('treats a device without an "unavailable" state as available', () => {
    expect(scopeFilter.isDeviceAvailable(createTestDevice({ lastKnownState: { on: true } }))).toBe(true);
    expect(scopeFilter.isDeviceAvailable(createTestDevice({ lastKnownState: { state: 'unavailable' } }))).toBe(false);
  });

  it('excludes PENDING (Inbox, never assigned to a room) devices from availability', () => {
    // A freshly-discovered device sitting in the Inbox isn't a real, working part
    // of the home yet — it must never be swept into a bulk action just because it
    // happens to match a category/room, even if its lastKnownState looks fine.
    expect(scopeFilter.isDeviceAvailable(createTestDevice({ status: 'PENDING', lastKnownState: { on: true } }))).toBe(false);
    expect(scopeFilter.isDeviceAvailable(createTestDevice({ status: 'ASSIGNED', lastKnownState: { on: true } }))).toBe(true);
    expect(scopeFilter.isControllableForBulk(createTestDevice({ status: 'PENDING', type: 'light' }), 'turn_off', 'all')).toBe(false);
    expect(scopeFilter.isControllableDevice(createTestDevice({ status: 'PENDING', type: 'light' }), 'turn_on')).toBe(false);
  });

  it('supports turn_on/turn_off/toggle for known controllable types', () => {
    const light = createTestDevice({ type: 'light' });
    expect(scopeFilter.supportsCommand(light, 'turn_on')).toBe(true);
    expect(scopeFilter.supportsCommand(light, 'toggle')).toBe(true);
  });

  it('supports open/close/stop/set_position for covers only', () => {
    const cover = createTestDevice({ type: 'cover' });
    expect(scopeFilter.supportsCommand(cover, 'open')).toBe(true);
    expect(scopeFilter.supportsCommand(cover, 'turn_on')).toBe(false);
  });

  it('classifies lights by semanticType, capability, hardware type, and name fallback', () => {
    expect(scopeFilter.isLightEntity(createTestDevice({ type: 'switch', semanticType: 'light' }))).toBe(true);
    expect(scopeFilter.isLightEntity(createTestDevice({ type: 'switch', semanticType: 'switch' }))).toBe(false);
    expect(scopeFilter.isLightEntity(createTestDevice({ type: 'light' }))).toBe(true);
    expect(scopeFilter.isLightEntity(createTestDevice({ type: 'switch', name: 'Luz Sala' }))).toBe(true);
    expect(scopeFilter.isLightEntity(createTestDevice({ type: 'switch', name: 'Ventilador' }))).toBe(false);
  });

  it('excludes sensors, cameras, and covers from bulk turn_on/turn_off', () => {
    expect(scopeFilter.isControllableForBulk(createTestDevice({ type: 'sensor' }), 'turn_on', 'all')).toBe(false);
    expect(scopeFilter.isControllableForBulk(createTestDevice({ type: 'camera' }), 'turn_on', 'all')).toBe(false);
    expect(scopeFilter.isControllableForBulk(createTestDevice({ type: 'cover' }), 'turn_off', 'all')).toBe(false);
    expect(scopeFilter.isControllableForBulk(createTestDevice({ type: 'light' }), 'turn_off', 'all')).toBe(true);
  });

  it('restricts bulkType "lights" to actual light entities', () => {
    const fan = createTestDevice({ type: 'switch', name: 'Ventilador' });
    expect(scopeFilter.isControllableForBulk(fan, 'turn_off', 'lights')).toBe(false);
    expect(scopeFilter.isControllableForBulk(fan, 'turn_off', 'all')).toBe(true);
  });

  it('requires a bulk state change only when the current state is positively confirmed opposite', () => {
    expect(scopeFilter.requiresBulkStateChange(createTestDevice({ lastKnownState: { on: true } }), 'turn_off')).toBe(true);
    expect(scopeFilter.requiresBulkStateChange(createTestDevice({ lastKnownState: { on: false } }), 'turn_off')).toBe(false);
    // Unknown/unreported state is never assumed to already satisfy the target.
    expect(scopeFilter.requiresBulkStateChange(createTestDevice({ lastKnownState: null }), 'turn_off')).toBe(true);
    expect(scopeFilter.requiresBulkStateChange(createTestDevice({ lastKnownState: { state: 'unknown' } }), 'turn_on')).toBe(true);
    expect(scopeFilter.requiresBulkStateChange(createTestDevice({ lastKnownState: { on: true } }), 'toggle')).toBe(false);
  });

  it('excludes unavailable and sensor/camera devices from single-device control', () => {
    expect(scopeFilter.isControllableDevice(createTestDevice({ lastKnownState: { state: 'unavailable' } }), 'turn_on')).toBe(false);
    expect(scopeFilter.isControllableDevice(createTestDevice({ type: 'sensor' }), 'turn_on')).toBe(false);
    expect(scopeFilter.isControllableDevice(createTestDevice({ type: 'light' }), 'turn_on')).toBe(true);
  });
});
