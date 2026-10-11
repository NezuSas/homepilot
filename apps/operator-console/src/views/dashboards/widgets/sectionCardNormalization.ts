import type { DashboardWidgetConfig, WidgetType } from '../types';
import { readCardGridOptions } from '../../../../../../packages/topology/application/readDashboardSections';
import { getEffectiveCardSpan, getDefaultSpan, getWidgetType, isClockKind, normalizeKind } from './sectionCardKinds';
import { getDefaultIcon } from './sectionCardLabels';
import {
  normalizeSensorScale,
  normalizeSensorVisualStyle,
  type LegacySectionCardKind,
  type NormalizedSectionCardItem,
} from './sectionCardTypes';

export const createId = () => `section-card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function normalizeCards(extra?: DashboardWidgetConfig['extra']): NormalizedSectionCardItem[] {
  const rawCards = Array.isArray(extra?.cards) ? extra.cards : [];

  return rawCards.flatMap((rawCard) => {
    const card = rawCard as Partial<NormalizedSectionCardItem> & Record<string, unknown>;
    const legacyKind = (card.kind as LegacySectionCardKind) || 'device';
    // Room summaries and standalone scene shortcuts were superseded by
    // section grouping and the action button, respectively. Drop persisted
    // legacy cards too, so an obsolete card cannot reappear after editing.
    if (legacyKind === 'system' || legacyKind === 'room' || legacyKind === 'scene') return [];
    const kind = normalizeKind(legacyKind);

    const metadata = { ...card };
    delete metadata.order;
    delete metadata.rowSpan;
    return [{
      ...metadata,
      id: typeof card.id === 'string' && card.id.trim() ? card.id : createId(),
      kind,
      title: typeof card.title === 'string' && card.title.trim()
        ? card.title
        : '',
      description: typeof card.description === 'string' ? card.description : '',
      widgetType: (card.widgetType as WidgetType) || getWidgetType(kind),
      entityId: typeof card.entityId === 'string' ? card.entityId : undefined,
      entityName: typeof card.entityName === 'string' ? card.entityName : undefined,
      span: isClockKind(kind)
        ? 'full'
        : getEffectiveCardSpan(
            kind,
            card.span === 'medium' || card.span === 'full' || card.span === 'small'
              ? card.span
              : getDefaultSpan(kind)
          ),
      icon: typeof card.icon === 'string' && card.icon.trim() ? card.icon : getDefaultIcon(kind),
      ...(kind === 'media' && (card.mediaVariant === 'classic' || card.mediaVariant === 'premium')
        ? { mediaVariant: card.mediaVariant }
        : {}),
      ...(kind === 'sensor' && normalizeSensorScale(card.sensorScale) ? { sensorScale: normalizeSensorScale(card.sensorScale) } : {}),
      ...(kind === 'sensor' && card.sensorDecimals === true ? { sensorDecimals: true } : {}),
      ...(kind === 'sensor' && card.visualStyle !== undefined ? { visualStyle: normalizeSensorVisualStyle(card.visualStyle) } : {}),
      ...(card.gridOptions ? { gridOptions: readCardGridOptions(card.gridOptions) } : {}),
      hidden: card.hidden === true,
    }];
  });
}
