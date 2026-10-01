import { renderToStaticMarkup } from 'react-dom/server';
import { getSceneDeviceGroups, SceneDeviceSelector } from './SceneDeviceSelector';
import type { SnapshotDevice } from '../stores/useDeviceSnapshotStore';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: 'es' } }) }));
const rooms = [{ id: 'office', name: 'Oficina' }, { id: 'kitchen', name: 'Cocina' }];
function device(id: string, name: string, roomId: string | null, type = 'light'): SnapshotDevice {
  return { id, name, roomId, type, homeId: 'home', status: 'ASSIGNED', lastKnownState: null };
}
const devices = [
  device('z', 'Luz 10', 'office'), device('a', 'Luz 2', 'office'),
  device('k', 'Kitchen', 'kitchen'), device('u', 'Sin asignar', null),
  device('orphan', 'Sin estancia existente', 'deleted-room'),
  device('camera', 'Cámara', null, 'camera'), device('sensor', 'Temperatura', 'office', 'sensor'),
];
describe('Feature: Scene editor organization (AC48)', () => {
  it('groups alphabetically by known space, naturally sorts devices and puts unassigned last', () => {
    const result = getSceneDeviceGroups(devices, rooms, [], null, '');
    expect(result.groups.map(group => group.id)).toEqual(['kitchen', 'office', '']);
    expect(result.groups[1]?.devices.map(item => item.id)).toEqual(['a', 'z', 'sensor']);
    expect(result.groups[2]?.devices.map(item => item.id)).toEqual(['u', 'orphan']);
    expect(result.groups.flatMap(group => group.devices).some(item => item.id === 'camera')).toBe(false);
  });
  it('keeps selected entities above the catalog without duplicates, even when searching or filtering another space', () => {
    const actions = [{ deviceId: 'z', command: 'turn_off' as const }];
    const result = getSceneDeviceGroups(devices, rooms, actions, null, 'Kitchen', 'kitchen');
    expect(result.selected.map(item => item.id)).toEqual(['z']);
    expect(result.groups.flatMap(group => group.devices).map(item => item.id)).toEqual(['k']);
    expect(actions).toEqual([{ deviceId: 'z', command: 'turn_off' }]);
  });
  it('searches by space and respects the scene scope separately from the browsing filter', () => {
    expect(getSceneDeviceGroups(devices, rooms, [], null, 'Oficina').groups.map(group => group.id)).toEqual(['office']);
    expect(getSceneDeviceGroups(devices, rooms, [], 'office', '').groups.flatMap(group => group.devices).map(item => item.id)).toEqual(['a', 'z', 'sensor']);
    expect(getSceneDeviceGroups(devices, rooms, [], null, '', '__unassigned__').groups[0]?.devices.map(item => item.id)).toEqual(['u', 'orphan']);
  });
  it('uses independent selection buttons and command controls, leaving read-only sensors visible but disabled', () => {
    const html = renderToStaticMarkup(<SceneDeviceSelector devices={devices} rooms={rooms} roomId={null} actions={[{ deviceId: 'z', command: 'turn_off' }]} onToggle={() => {}} onCommand={() => {}} />);
    expect(html.indexOf('aria-label="scenes.builder.selected"')).toBeLessThan(html.indexOf('aria-label="scenes.builder.available"'));
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('Temperatura');
    expect(html).toContain('scenes.builder.unassigned');
    expect(html).not.toContain('Cámara');
  });
  it('renders large catalogs as collapsible spaces without dropping entities', () => {
    const catalog = Array.from({ length: 30 }, (_, i) => device(`l-${i}`, `Luz ${i}`, 'office'));
    const html = renderToStaticMarkup(<SceneDeviceSelector devices={catalog} rooms={rooms} roomId={null} actions={[]} onToggle={() => {}} onCommand={() => {}} />);
    expect(html).toContain('<details');
    expect(html).not.toContain('<details open');
    expect(html).toContain('Luz 29');
  });
});
