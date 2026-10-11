import { arrayMove } from '@dnd-kit/sortable';
import type { SnapshotDevice, SnapshotRoom } from '../../../stores/useDeviceSnapshotStore';
import { resolvePlacedCardRows } from '../sectionCardDrag';
import { getAssignableDevicesForSectionCard } from '../dashboardUtils';
import {
  cardKinds,
  getDefaultIcon,
  getDefaultSpan,
  getWidgetType,
  normalizeKind,
  type AssignableAutomation,
  type AssignableDisplayAction,
  type AssignableScene,
  type NormalizedSectionCardItem,
  type SectionCardKind,
} from './sectionCardCatalog';
import { isAutomationEntityId, stripAutomationEntityPrefix, toDeviceActionEntityId } from './sectionCardAssignments';
import type { SectionCatalogItem } from './sectionCardEditing';

const BADGE_ROW_KINDS = ['info_time', 'info_weather', 'info_sensor'] as const;

/** Devices a draft card of this kind can bind to; light and action cards share both pools. */
export function resolveAssignableDevices(rawKind: SectionCardKind, available: SnapshotDevice[]): SnapshotDevice[] {
  const kind = normalizeKind(rawKind);
  if (kind !== 'light' && kind !== 'action') return getAssignableDevicesForSectionCard(kind, available);
  const targets = new Map(
    [...getAssignableDevicesForSectionCard('light', available), ...getAssignableDevicesForSectionCard('action', available)]
      .map((device) => [device.id, device] as const),
  );
  return [...targets.values()].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
}

/** Catalog entries offered by the "add card" modal for a regular section or a badge row. */
export function buildSectionCatalogItems(
  badgeRow: boolean,
  titleFor: (kind: SectionCardKind) => string,
  descriptionFor: (kind: SectionCardKind) => string,
): SectionCatalogItem[] {
  const kinds = badgeRow ? BADGE_ROW_KINDS : cardKinds.filter((kind) => !kind.startsWith('info_'));
  return kinds.map((kind) => ({
    kind,
    title: titleFor(kind),
    description: descriptionFor(kind),
    widgetType: getWidgetType(kind),
    span: getDefaultSpan(kind),
    icon: getDefaultIcon(kind),
  }));
}

/** Rows of explicitly placed cards after intrinsic growth is projected onto the grid. */
export function resolveSectionPlacedRows(
  cards: NormalizedSectionCardItem[],
  isEditing: boolean,
  rowSpans: Readonly<Record<string, number>>,
): Record<string, number> {
  return resolvePlacedCardRows(cards.filter((card) => (isEditing || !card.hidden) && card.gridOptions?.rowStart !== undefined).map((card) => ({
    id: card.id, column: card.gridOptions!.columnStart!, row: card.gridOptions!.rowStart!,
    columns: card.gridOptions!.columns === 'full' ? 12 : card.gridOptions!.columns,
    rows: Math.max(rowSpans[card.id] ?? 1, typeof card.gridOptions!.rows === 'number' ? card.gridOptions!.rows : 1),
  })));
}

/** Moves the source card to the target card's position; unchanged when either id is unknown or equal. */
export function reorderSectionCards(cards: NormalizedSectionCardItem[], sourceId: string, targetId: string): NormalizedSectionCardItem[] | null {
  if (sourceId === targetId) return null;

  const sourceIndex = cards.findIndex((card) => card.id === sourceId);
  const targetIndex = cards.findIndex((card) => card.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return null;

  return arrayMove(cards, sourceIndex, targetIndex);
}

interface DraftEntitySources {
  entityId: string;
  devices: SnapshotDevice[];
  scenes: AssignableScene[];
  automations: AssignableAutomation[];
  displayActions: AssignableDisplayAction[];
  rooms: SnapshotRoom[];
}

export interface SelectedDraftEntities {
  device?: SnapshotDevice;
  scene?: AssignableScene;
  automation?: AssignableAutomation;
  displayAction?: AssignableDisplayAction;
  room?: SnapshotRoom;
}

/** Resolves the entity a draft card is bound to against every assignable source. */
export function resolveSelectedDraftEntities({ entityId, devices, scenes, automations, displayActions, rooms }: DraftEntitySources): SelectedDraftEntities {
  return {
    device: entityId ? devices.find((device) => device.id === entityId) : undefined,
    scene: entityId && !isAutomationEntityId(entityId)
      ? scenes.find((scene) => scene.id === entityId)
      : undefined,
    automation: entityId && isAutomationEntityId(entityId)
      ? automations.find((automation) => automation.id === stripAutomationEntityPrefix(entityId))
      : undefined,
    displayAction: displayActions.find((action) =>
      toDeviceActionEntityId(action.deviceId, action.actionKey) === entityId),
    room: entityId ? rooms.find((room) => room.id === entityId) : undefined,
  };
}
