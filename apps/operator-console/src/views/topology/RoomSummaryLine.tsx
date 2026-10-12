import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import type { RoomSummary } from './roomSummaryModel';

interface RoomSummaryLineProps {
  summary: RoomSummary;
  /** Card use: only the first kinds, no total. */
  compact?: boolean;
  className?: string;
}

/** What the space holds and how it is doing, in plain text; trouble is named, never left to colour alone. */
export function RoomSummaryLine({ summary, compact = false, className }: RoomSummaryLineProps) {
  const { t } = useTranslation();
  if (summary.total === 0) return <p className={cn('text-caption text-muted-foreground', className)}>{t('topology.summary.empty')}</p>;
  const kinds = (compact ? summary.groups.slice(0, 3) : summary.groups).map(entry => t(`topology.summary.${entry.group}`, { count: entry.count }));
  const parts = [
    ...(compact ? [] : [t('topology.room_device_count', { count: summary.total })]),
    ...kinds,
    ...(summary.hasStates && !compact ? [t('topology.active_device_count', { count: summary.active })] : []),
  ];
  return (
    <p className={cn('flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground', className)}>
      <span className="min-w-0 break-words">{parts.join(' · ')}</span>
      {summary.unavailable > 0 && (
        <span className="inline-flex items-center gap-1 font-semibold text-warning">
          <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0" />{t('topology.summary.unavailable', { count: summary.unavailable })}
        </span>
      )}
    </p>
  );
}
