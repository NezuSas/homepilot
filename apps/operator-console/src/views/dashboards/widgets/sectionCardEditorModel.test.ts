import type { SnapshotDevice, SnapshotRoom } from '../../../stores/useDeviceSnapshotStore';
import type { CardDraft } from './sectionCardCatalog';
import {
  applyCardTypeChange, applyControlSelection, applyDeviceSelection, applyInfoSourceChange,
  applyRoomSelection, applySceneSelection, isSensorScaleInvalid, resolveEditorGridOptions,
} from './sectionCardEditorModel';

jest.mock('../../../config', () => ({ API_BASE_URL: 'http://localhost:3000' }));

const baseDraft: CardDraft = { title: 'Card', kind: 'device', entityId: 'd1', span: 'medium', icon: 'lightbulb', mediaVariant: 'premium' };
const device = (id: string, name: string): SnapshotDevice => ({ id, homeId: 'home', roomId: null, name, type: 'light', status: 'ASSIGNED', lastKnownState: {} });
const devices = [device('d1', 'Lamp'), device('d2', 'Fan')];
const identityClock = <T,>(options?: T) => options as never;

describe('sectionCardEditorModel', () => {
  it('derives grid options per card kind', () => {
    expect(resolveEditorGridOptions(baseDraft, false, identityClock)).toEqual({ columns: 6, rows: 'auto' });
    expect(resolveEditorGridOptions({ ...baseDraft, span: 'full' }, false, identityClock)).toEqual({ columns: 12, rows: 'auto' });
    expect(resolveEditorGridOptions({ ...baseDraft, kind: 'sensor', span: 'small' }, false, identityClock))
      .toMatchObject({ columns: 4, rows: 'auto', minColumns: 4, minRows: 4 });
    const clockOptions = { columns: 6 as const, rows: 'auto' as const };
    expect(resolveEditorGridOptions(baseDraft, true, () => clockOptions)).toBe(clockOptions);
  });

  it('flags an invalid sensor scale only for sensor cards', () => {
    expect(isSensorScaleInvalid(baseDraft, undefined, false, true)).toBe(false);
    const sensor = { ...baseDraft, kind: 'sensor' as const };
    expect(isSensorScaleInvalid(sensor, undefined, false, true)).toBe(true);
    expect(isSensorScaleInvalid({ ...sensor, sensorMin: 1 }, undefined, true, true)).toBe(true);
    expect(isSensorScaleInvalid({ ...sensor, sensorMin: 1 }, { min: 1, max: 2 }, true, true)).toBe(false);
  });

  it('resets entity and icon when the information source changes', () => {
    expect(applyInfoSourceChange({ ...baseDraft, kind: 'info_time' }, 'info_weather')).toMatchObject({ kind: 'info_weather', entityId: '' });
  });

  it('keeps the entity when the type is unchanged and falls back to the catalog label', () => {
    const label = () => 'Label';
    expect(applyCardTypeChange({ ...baseDraft, title: '' }, 'device', label)).toMatchObject({ entityId: 'd1', title: 'Label' });
    expect(applyCardTypeChange(baseDraft, 'scene', label).entityId).toBe('');
    expect(applyCardTypeChange({ ...baseDraft, kind: 'action' }, 'light', label)).toMatchObject({ kind: 'action', entityId: 'd1', span: 'medium' });
  });

  it('takes the selected name for scene, room and device assignments', () => {
    const scenes = [{ id: 's1', name: 'Movie' }];
    const rooms = [{ id: 'r1', name: 'Kitchen' } as SnapshotRoom];
    expect(applySceneSelection(baseDraft, 's1', scenes, [])).toMatchObject({ entityId: 's1', title: 'Movie' });
    expect(applySceneSelection(baseDraft, 'missing', scenes, [])).toMatchObject({ title: 'Card' });
    expect(applyRoomSelection(baseDraft, 'r1', rooms)).toMatchObject({ entityId: 'r1', title: 'Kitchen' });
    expect(applyDeviceSelection(baseDraft, 'd2', devices)).toMatchObject({ entityId: 'd2', title: 'Fan' });
  });

  it('switches between light and action kinds for control selections', () => {
    const context = { devices, scenes: [], automations: [], displayActions: [{ deviceId: 'd1', actionKey: 'open', displayName: 'Open', deviceName: 'Lamp' }], isLightDevice: (id: string) => id === 'd1' };
    expect(applyControlSelection(baseDraft, 'd1', context)).toMatchObject({ kind: 'light', title: 'Lamp' });
    expect(applyControlSelection(baseDraft, 'd2', context)).toMatchObject({ kind: 'action', title: 'Fan' });
    expect(applyControlSelection(baseDraft, '', context)).toMatchObject({ kind: 'light', entityId: '' });
  });
});
