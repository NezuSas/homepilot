import type { SnapshotDevice, SnapshotRoom } from '../../../stores/useDeviceSnapshotStore';
import type { CardColumns, CardGridOptions } from '../types';
import {
  getDefaultIcon, getDefaultSpan, isBindableKind, normalizeKind,
  type AssignableAutomation, type AssignableDisplayAction, type AssignableScene, type CardDraft,
  type NormalizedSectionCardKind, type SectionCardKind, type SensorScale,
} from './sectionCardCatalog';
import { isAutomationEntityId, stripAutomationEntityPrefix, toDeviceActionEntityId } from './sectionCardAssignments';

export type InfoCardKind = 'info_time' | 'info_weather' | 'info_sensor';

export interface ControlSelectionContext {
  devices: SnapshotDevice[];
  scenes: AssignableScene[];
  automations: AssignableAutomation[];
  displayActions: AssignableDisplayAction[];
  isLightDevice: (deviceId: string) => boolean;
}

/** Grid options shown in the editor: clocks and sensors enforce their own minimums. */
export function resolveEditorGridOptions(
  draft: CardDraft,
  isClock: boolean,
  normalizeClockOptions: (options?: CardGridOptions) => CardGridOptions,
): CardGridOptions {
  const defaultColumns = draft.span === 'full' ? 12 : draft.span === 'small' ? 3 : 6;
  const sensor = draft.kind === 'sensor';
  const minimum = sensor ? 4 : 2;
  return isClock ? normalizeClockOptions(draft.gridOptions)
    : sensor ? { ...draft.gridOptions, columns: Math.max(minimum, typeof draft.gridOptions?.columns === 'number' ? draft.gridOptions.columns : defaultColumns) as CardColumns, rows: typeof draft.gridOptions?.rows === 'number' ? Math.max(minimum, draft.gridOptions.rows) : 'auto', minColumns: minimum as CardColumns, minRows: minimum }
      : draft.gridOptions ?? { columns: defaultColumns as CardColumns, rows: 'auto' };
}

export function isSensorScaleInvalid(draft: CardDraft, sensorScale: SensorScale | undefined, validMinimum: boolean, validMaximum: boolean): boolean {
  return draft.kind === 'sensor' && (!validMinimum || !validMaximum || ((draft.sensorMin !== undefined || draft.sensorMax !== undefined) && !sensorScale));
}

export function applyInfoSourceChange(draft: CardDraft, kind: InfoCardKind): CardDraft {
  return { ...draft, kind, entityId: '', icon: getDefaultIcon(kind) };
}

export function applyCardTypeChange(draft: CardDraft, nextKind: NormalizedSectionCardKind, catalogLabel: (kind: SectionCardKind) => string): CardDraft {
  return {
    ...draft,
    kind: nextKind === 'light' && draft.kind === 'action' ? 'action' : nextKind,
    entityId: isBindableKind(nextKind) && (normalizeKind(draft.kind) === normalizeKind(nextKind) || (nextKind === 'light' && draft.kind === 'action')) ? draft.entityId : '',
    span: nextKind === 'light' && draft.kind === 'action' ? draft.span : getDefaultSpan(nextKind),
    icon: nextKind === 'light' && draft.kind === 'action' ? draft.icon : getDefaultIcon(nextKind),
    title: draft.title || catalogLabel(nextKind),
  };
}

export function applySceneSelection(draft: CardDraft, selectedId: string, scenes: AssignableScene[], automations: AssignableAutomation[]): CardDraft {
  const nextName = isAutomationEntityId(selectedId)
    ? automations.find((automation) => automation.id === stripAutomationEntityPrefix(selectedId))?.name
    : scenes.find((scene) => scene.id === selectedId)?.name;
  return { ...draft, entityId: selectedId, title: nextName || draft.title };
}

export function applyRoomSelection(draft: CardDraft, selectedId: string, rooms: SnapshotRoom[]): CardDraft {
  const nextRoom = rooms.find((room) => room.id === selectedId);
  return { ...draft, entityId: selectedId, title: nextRoom?.name || draft.title };
}

export function applyDeviceSelection(draft: CardDraft, selectedId: string, devices: SnapshotDevice[]): CardDraft {
  const nextDevice = devices.find((device) => device.id === selectedId);
  return { ...draft, entityId: selectedId, title: nextDevice?.name || draft.title };
}

/** A control can be a device, scene, routine or display action; the card kind follows the target. */
export function applyControlSelection(draft: CardDraft, selectedId: string, context: ControlSelectionContext): CardDraft {
  const { devices, scenes, automations, displayActions, isLightDevice } = context;
  const nextDisplayAction = displayActions.find((action) =>
    toDeviceActionEntityId(action.deviceId, action.actionKey) === selectedId);
  const nextDevice = devices.find((device) => device.id === selectedId);
  const nextName = nextDisplayAction?.displayName || nextDevice?.name
    || scenes.find((scene) => scene.id === selectedId)?.name
    || (isAutomationEntityId(selectedId)
      ? automations.find((automation) => automation.id === stripAutomationEntityPrefix(selectedId))?.name
      : undefined);
  const isLightTarget = !nextDisplayAction && (!selectedId || isLightDevice(selectedId));
  const nextKind = isLightTarget ? 'light' : 'action';
  return {
    ...draft,
    kind: nextKind,
    entityId: selectedId,
    title: nextName || draft.title,
    icon: draft.icon === getDefaultIcon(draft.kind) ? getDefaultIcon(nextKind) : draft.icon,
  };
}
