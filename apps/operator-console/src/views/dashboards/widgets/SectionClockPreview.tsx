import { ClockWidget } from './ClockWidget';
import { useEffect, useRef, useState } from 'react';
import { getClockStyleForKind, type SectionCardKind } from './sectionCardCatalog';
import type { DashboardWidgetConfig } from '../types';

export function SectionClockPreview({ kind, title }: { kind: SectionCardKind; title: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (!host.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => { const bounds = entries[0]?.contentRect; if (bounds) setCompact(bounds.height < 300); });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const clockConfig: DashboardWidgetConfig = {
    layout: { x: 0, y: 0, w: 4, h: 4 },
    binding: { entityId: '', entityType: 'system', entityName: title },
    visibility: { rules: [], defaultState: 'show' },
    appearance: { variant: 'glass', title, showTitle: true },
    extra: { clockStyle: getClockStyleForKind(kind) },
  };

  return (
    <div ref={host} className={`homepilot-dashboard-screen h-full min-h-0 overflow-hidden rounded-section ${compact ? 'homepilot-clock-compact' : ''}`}>
      <ClockWidget config={clockConfig} />
    </div>
  );
}
