import type { SnapshotDevice } from '../../stores/useDeviceSnapshotStore';
import { getRoomDeviceGroup } from './topologyDeviceControl';
import { buildRoomSummary, roomIconKey } from './roomSummaryModel';

const device = (extra: Partial<SnapshotDevice> = {}): SnapshotDevice => ({
  id: `d-${Math.random()}`, homeId: 'h', roomId: 'r', name: 'Dispositivo', type: 'light', status: 'ASSIGNED', lastKnownState: { on: false }, ...extra,
});
const light = (on = false) => device({ type: 'light', lastKnownState: { on } });
const toggle = (extra: Partial<SnapshotDevice> = {}) => device({ type: 'switch', semanticType: 'switch', lastKnownState: { on: false }, ...extra });
const sensor = (extra: Partial<SnapshotDevice> = {}) => device({ type: 'sensor', semanticType: 'sensor', lastKnownState: { state: '21', unit: '°C' }, ...extra });
const camera = () => device({ type: 'camera', lastKnownState: null });
const action = (extra: Partial<SnapshotDevice> = {}) => device({ type: 'sensor', semanticType: 'light', lastKnownState: null,
  capabilities: [{ type: 'button', name: 'Button', commands: [{ name: 'press' }] }], ...extra });

describe('Feature: a space is described by what it really holds', () => {
  it('Scenario: Given momentary commands named as lights or sensors When grouped Then they gather under actions', () => {
    expect(getRoomDeviceGroup(action())).toBe('action');
    expect(getRoomDeviceGroup(action({ semanticType: 'switch', type: 'switch' }))).toBe('action');
    expect(getRoomDeviceGroup(light())).toBe('light');
  });

  it('Scenario: Given a camera or a cover When it has a press command Then it is never turned into an action', () => {
    expect(getRoomDeviceGroup(device({ type: 'camera', capabilities: [{ type: 'button', name: 'b', commands: [{ name: 'press' }] }] }))).toBe('camera');
  });

  it('Scenario: Given the office Patio (3 cameras and a switch) When summarised Then only those kinds appear', () => {
    const summary = buildRoomSummary([camera(), camera(), camera(), toggle()]);
    expect(summary.total).toBe(4);
    expect(summary.groups).toEqual([{ group: 'switch', count: 1 }, { group: 'camera', count: 3 }]);
    expect(summary.hasStates).toBe(true);
    expect(summary.active).toBe(0);
  });

  it('Scenario: Given the office machine room (PLC sensors, outputs and a pulse command) When summarised Then it is a technical room', () => {
    const devices = [
      ...Array.from({ length: 13 }, () => sensor({ integrationSource: 'modbus-tcp' })),
      ...Array.from({ length: 8 }, () => toggle({ integrationSource: 'modbus-tcp' })),
      action({ integrationSource: 'modbus-tcp' }),
    ];
    const summary = buildRoomSummary(devices);
    expect(summary.mostlyPlc).toBe(true);
    expect(summary.groups.map(entry => entry.group)).toEqual(['switch', 'action', 'sensor']);
    expect(roomIconKey(summary)).toBe('plc');
  });

  it('Scenario: Given devices that are on or not answering When summarised Then both are told apart from off', () => {
    const summary = buildRoomSummary([light(true), light(false), device({ type: 'light', lastKnownState: { state: 'unavailable' } })]);
    expect(summary.active).toBe(1);
    expect(summary.unavailable).toBe(1);
  });

  it('Scenario: Given a room with only sensors When summarised Then "on" is not meaningful', () => {
    expect(buildRoomSummary([sensor(), sensor()]).hasStates).toBe(false);
  });

  it('Scenario: Given a room with nothing When summarised Then it is empty and has the empty icon', () => {
    const summary = buildRoomSummary([]);
    expect(summary).toMatchObject({ total: 0, groups: [], active: 0, unavailable: 0, mostlyPlc: false });
    expect(roomIconKey(summary)).toBe('empty');
  });

  it.each([
    ['cameras', [camera(), camera(), toggle()], 'camera'],
    ['lights', [light(), light(), sensor()], 'light'],
    ['only sensors', [sensor(), sensor()], 'sensor'],
    ['sensors beside a light: the sensors do not decide', [sensor(), sensor(), sensor(), light()], 'light'],
    ['actions beside a media player: the actions do not decide', [action(), action(), device({ type: 'media_player' })], 'media_player'],
    ['a tie goes by presentation order', [light(), sensor()], 'light'],
  ] as const)('Scenario: Given mostly %s When choosing the icon Then it is %s', (_name, devices, expected) => {
    expect(roomIconKey(buildRoomSummary([...devices]))).toBe(expected);
  });
});
