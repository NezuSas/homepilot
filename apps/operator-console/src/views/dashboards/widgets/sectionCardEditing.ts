import type { CardGridOptions, WidgetType } from '../types';
import { getClockGridOptions } from './clock/clockRegistry';
import { isAutomationEntityId, stripAutomationEntityPrefix } from './sectionCardAssignments';
import {
  createId,
  getDefaultIcon,
  getCatalogCategory,
  getDefaultSpan,
  getEffectiveCardSpan,
  getWidgetType,
  isClockKind,
  normalizeMediaVariant,
  type AssignableAutomation,
  type AssignableScene,
  type CardDraft,
  type NormalizedSectionCardItem,
  type NormalizedSectionCardKind,
  type SectionCardCategory,
  type SectionCardSpan,
  type SensorScale,
} from './sectionCardCatalog';

// Minimum footprint (in grid cells) a sensor card needs to stay readable.
const SENSOR_SIZE_MINIMUM = 4;

export interface SectionCatalogItem {
  kind: NormalizedSectionCardKind;
  title: string;
  description: string;
  widgetType: WidgetType;
  span: SectionCardSpan;
  icon: string;
}

export interface DraftCardLabels {
  /** Title used when the draft has no explicit title. */
  fallbackTitle: string;
  description: string;
  entityName?: string;
}

/** Icon of the scene or automation a routine action card is bound to, if still available. */
export function getBoundRoutineIcon(entityId: string | undefined, scenes: AssignableScene[], automations: AssignableAutomation[]): string | undefined {
  if (!entityId) return undefined;
  if (isAutomationEntityId(entityId)) {
    const automation = automations.find((item) => item.id === stripAutomationEntityPrefix(entityId));
    return automation ? automation.icon ?? 'mdi:robot' : undefined;
  }
  const scene = scenes.find((item) => item.id === entityId);
  return scene ? scene.icon ?? 'mdi:auto-fix' : undefined;
}

export function filterCatalogItems(items: SectionCatalogItem[], category: SectionCardCategory | null, query: string): SectionCatalogItem[] {
  return items.filter((item) => {
    if (category && getCatalogCategory(item.kind) !== category) return false;

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return true;
    return `${item.title} ${item.description}`.toLowerCase().includes(normalizedQuery);
  });
}

export function createCardFromCatalogItem(item: SectionCatalogItem, id: string = createId()): NormalizedSectionCardItem {
  return {
    id,
    kind: item.kind,
    title: item.title,
    description: item.description,
    widgetType: item.widgetType,
    span: item.span,
    icon: item.icon,
    ...(!isClockKind(item.kind) && item.kind !== 'media' && item.kind !== 'camera'
      ? { gridOptions: { columns: (item.span === 'small' ? 3 : item.span === 'medium' ? 6 : 12) as CardGridOptions['columns'], rows: 2 } }
      : {}),
    ...(item.kind === 'media' ? { mediaVariant: 'premium' as const } : {}),
    ...(item.kind === 'sensor' ? { visualStyle: 'auto' as const } : {}),
  };
}

/** Editor draft for a card that was just added from the catalog (not yet bound to an entity). */
export function createDraftFromNewCard(card: NormalizedSectionCardItem): CardDraft {
  return {
    title: card.title,
    kind: card.kind,
    entityId: '',
    span: card.span ?? getDefaultSpan(card.kind),
    icon: card.icon ?? getDefaultIcon(card.kind),
    mediaVariant: normalizeMediaVariant(card.mediaVariant),
    visualStyle: card.visualStyle,
    gridOptions: card.gridOptions,
  };
}

export function createDraftFromCard(card: NormalizedSectionCardItem): CardDraft {
  return {
    title: card.title,
    kind: card.kind,
    entityId: card.entityId || '',
    span: getEffectiveCardSpan(card.kind, card.span ?? getDefaultSpan(card.kind)),
    icon: card.icon ?? getDefaultIcon(card.kind),
    mediaVariant: normalizeMediaVariant(card.mediaVariant),
    sensorMin: card.sensorScale?.min,
    sensorMax: card.sensorScale?.max,
    sensorDecimals: card.sensorDecimals === true,
    visualStyle: card.visualStyle ?? 'gauge',
    gridOptions: card.gridOptions,
    hidden: card.hidden,
  };
}

function getDraftGridOptions(draft: CardDraft): CardGridOptions | undefined {
  if (isClockKind(draft.kind)) return getClockGridOptions(draft.gridOptions);
  if (draft.kind === 'sensor' && draft.gridOptions) {
    return {
      ...draft.gridOptions,
      columns: typeof draft.gridOptions.columns === 'number' ? Math.max(SENSOR_SIZE_MINIMUM, draft.gridOptions.columns) as CardGridOptions['columns'] : 'full',
      rows: typeof draft.gridOptions.rows === 'number' ? Math.max(SENSOR_SIZE_MINIMUM, draft.gridOptions.rows) : 'auto',
      minColumns: SENSOR_SIZE_MINIMUM,
      minRows: SENSOR_SIZE_MINIMUM,
    };
  }
  return draft.gridOptions;
}

/** Merges the editor draft into a persisted card, dropping options the card kind does not use. */
export function applyDraftToCard(card: NormalizedSectionCardItem, draft: CardDraft, sensorScale: SensorScale | undefined, labels: DraftCardLabels): NormalizedSectionCardItem {
  const updatedCard: NormalizedSectionCardItem = {
    ...card,
    kind: draft.kind,
    title: draft.title.trim() || labels.fallbackTitle,
    description: labels.description,
    widgetType: getWidgetType(draft.kind),
    entityId: draft.entityId || undefined,
    entityName: labels.entityName,
    span: isClockKind(draft.kind) ? 'full' : getEffectiveCardSpan(draft.kind, draft.span),
    icon: draft.icon,
    gridOptions: getDraftGridOptions(draft),
    hidden: draft.hidden,
  };
  if (draft.kind === 'media') updatedCard.mediaVariant = draft.mediaVariant;
  else delete updatedCard.mediaVariant;
  if (draft.kind === 'sensor' && sensorScale) updatedCard.sensorScale = sensorScale;
  else delete updatedCard.sensorScale;
  if (draft.kind === 'sensor' && draft.sensorDecimals) updatedCard.sensorDecimals = true;
  else delete updatedCard.sensorDecimals;
  if (draft.kind === 'sensor') updatedCard.visualStyle = draft.visualStyle ?? 'gauge';
  else delete updatedCard.visualStyle;
  return updatedCard;
}
