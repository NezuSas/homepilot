import { getAutomationDeviceOptions } from './AutomationDeviceSelect';
jest.mock('../stores/useDeviceSnapshotStore', () => ({ useDeviceSnapshotStore: () => ({}) }));
describe('Feature: Automation device groups (AC53)', () => {
  const devices = [
    { id: 'u', name: 'Beta', type: 'sensor', roomId: null },
    { id: 'z', name: 'Zeta', type: 'sensor', semanticType: 'light' as const, roomId: 'a' },
    { id: 'a', name: 'Alfa', type: 'switch', roomId: 'a' },
    { id: 'b', name: 'Primero', type: 'light', roomId: 'b' },
    { id: 'missing', name: 'Alfa', type: 'sensor', roomId: 'missing' },
  ];
  const rooms = [{ id: 'b', name: 'Oficina' }, { id: 'a', name: 'Cocina' }];
  it('sorts rooms, then device names, with unassigned and orphaned rooms last', () => {
    const options = getAutomationDeviceOptions(devices, rooms, 'Sin espacio', 'es');
    expect(options.map(option => option.value)).toEqual(['a', 'z', 'b', 'missing', 'u']);
    expect(options.map(option => option.group)).toEqual(['Cocina', 'Cocina', 'Oficina', 'Sin espacio', 'Sin espacio']);
  });
  it('shows the effective semantic identity, not the integration identity', () => {
    const option = getAutomationDeviceOptions(devices, rooms, 'Sin espacio', 'es').find(item => item.value === 'z');
    expect(option?.description).toBe('Cocina · light');
  });
  it('does not mutate the device list or its room assignments', () => {
    const before = JSON.stringify(devices);
    getAutomationDeviceOptions(devices, rooms, 'Unassigned', 'en');
    expect(JSON.stringify(devices)).toBe(before);
  });
});
