import { ClockWidget } from './ClockWidget';
import { getClockStyleForKind, type SectionCardKind } from './sectionCardCatalog';
import type { DashboardWidgetConfig } from '../types';

export function SectionClockPreview({ kind, title }: { kind: SectionCardKind; title: string }) {
  const clockConfig: DashboardWidgetConfig = {
    layout: { x: 0, y: 0, w: 4, h: 4 },
    binding: { entityId: '', entityType: 'system', entityName: title },
    visibility: { rules: [], defaultState: 'show' },
    appearance: { variant: 'glass', title, showTitle: true },
    extra: { clockStyle: getClockStyleForKind(kind) },
  };

  return <div className="h-full min-h-clock-card overflow-hidden rounded-section"><ClockWidget config={clockConfig} /></div>;
}
