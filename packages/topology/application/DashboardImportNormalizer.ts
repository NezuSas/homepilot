import { randomUUID } from 'crypto';
import type {
  DashboardImportBindingResolver, DashboardImportReport, DashboardImportTarget,
  DashboardWidget,
} from '../domain/Dashboard';

const DEVICE_ACTION = /^device-action:([A-Za-z0-9._-]+):([A-Za-z0-9._-]+)$/;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function cardTarget(kind: unknown, entityId: string): DashboardImportTarget | null {
  if (kind === 'action') {
    const action = DEVICE_ACTION.exec(entityId);
    if (action) return { type: 'device-action', id: action[1], actionKey: action[2], cardKind: 'action' };
    if (entityId.startsWith('device-action:')) return null;
    if (entityId.startsWith('automation:')) return { type: 'automation', id: entityId.slice('automation:'.length) };
    return { type: 'action', id: entityId, cardKind: 'action' };
  }
  if (kind === 'scene') {
    return entityId.startsWith('automation:')
      ? { type: 'automation', id: entityId.slice('automation:'.length) }
      : { type: 'scene', id: entityId };
  }
  if (kind === 'room') return { type: 'room', id: entityId };
  if (['device', 'light', 'cover', 'camera', 'sensor', 'media'].includes(String(kind))) {
    return { type: 'device', id: entityId, cardKind: String(kind) };
  }
  return null;
}

export async function normalizeImportedWidgets(
  widgets: DashboardWidget[],
  tabTitle: string,
  authorizedHomeIds: ReadonlySet<string>,
  tabIds: ReadonlyMap<string, string>,
  resolver: DashboardImportBindingResolver | undefined,
  report: DashboardImportReport,
): Promise<DashboardWidget[]> {
  return Promise.all(widgets.map(async (widget) => {
    const widgetId = randomUUID();
    const config = JSON.parse(JSON.stringify(widget.config)) as Record<string, unknown>;
    const widgetTitle = record(config.appearance)?.title;
    const title = typeof widgetTitle === 'string' && widgetTitle.trim() ? widgetTitle : widget.type;
    const binding = record(config.binding);
    if (binding && typeof binding.entityId === 'string' && binding.entityId.trim()) {
      const bindingType = binding.entityType;
      if (bindingType === 'system' && binding.entityId === widget.id) {
        config.binding = { ...binding, entityId: widgetId };
      }
      const target = ['device', 'room', 'scene', 'automation'].includes(String(bindingType))
        ? { type: bindingType as DashboardImportTarget['type'], id: binding.entityId }
        : null;
      const isPortableInternalBinding = ['system', 'assistant', 'energy'].includes(String(bindingType));
      if (!isPortableInternalBinding && !(target && await resolver?.exists(authorizedHomeIds, target))) {
        config.binding = { ...binding, entityId: '', entityName: undefined };
        report.unresolvedBindings.push({ tabTitle, widgetId, title, targetType: target?.type ?? 'unknown' });
      }
    }

    const extra = record(config.extra);
    if (Array.isArray(extra?.badges)) {
      config.extra = { ...extra, badges: extra.badges.flatMap((rawBadge: unknown) => {
        const badge = record(rawBadge);
        if (!badge || badge.kind !== 'tab' || typeof badge.tabId !== 'string') return [rawBadge];
        const newTabId = tabIds.get(badge.tabId);
        if (!newTabId) {
          report.unresolvedBindings.push({ tabTitle, widgetId, title, targetType: 'tab' });
          return [];
        }
        return [{ ...badge, tabId: newTabId }];
      }) };
    }
    if (Array.isArray(extra?.cards)) {
      const cards = await Promise.all(extra.cards.map(async (rawCard: unknown) => {
        const card = record(rawCard);
        if (!card || typeof card.entityId !== 'string' || !card.entityId.trim()) return rawCard;
        const target = cardTarget(card.kind, card.entityId);
        if (target && await resolver?.exists(authorizedHomeIds, target)) return rawCard;
        report.unresolvedBindings.push({
          tabTitle, widgetId, cardId: typeof card.id === 'string' ? card.id : undefined,
          title: typeof card.title === 'string' ? card.title : title,
          targetType: target?.type ?? 'unknown',
        });
        return { ...card, entityId: undefined, entityName: undefined };
      }));
      config.extra = { ...(record(config.extra) ?? {}), cards };
    }

    const visibility = record(config.visibility);
    if (Array.isArray(visibility?.rules)) {
      const checked = await Promise.all(visibility.rules.map(async (rawRule: unknown) => {
        const rule = record(rawRule);
        if (!rule || rule.type !== 'device_on' || typeof rule.value !== 'string' || !rule.value.trim()) return rawRule;
        if (await resolver?.exists(authorizedHomeIds, { type: 'device', id: rule.value })) return rawRule;
        report.unresolvedBindings.push({ tabTitle, widgetId, title, targetType: 'device' });
        return { ...rule, value: '' };
      }));
      config.visibility = { ...visibility, rules: checked };
    }
    return { ...widget, id: widgetId, config };
  }));
}
