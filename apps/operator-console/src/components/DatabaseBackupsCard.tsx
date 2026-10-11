import type { HTMLAttributes } from 'react';
import { Archive, CalendarClock, DatabaseBackup, HardDriveDownload, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { EmptyState } from './ui/EmptyState';

export interface DatabaseBackupSummary {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

/** Texts shown by the card; the caller supplies them already translated. */
export interface DatabaseBackupsLabels {
  title: string;
  description: string;
  refresh: string;
  available: string;
  latest: string;
  never: string;
  loadFailed: string;
  empty: string;
  create: string;
  creating: string;
  note: string;
}

interface DatabaseBackupsCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  backups: DatabaseBackupSummary[];
  isLoading: boolean;
  isCreating: boolean;
  hasError: boolean;
  onCreate: () => void;
  onRefresh: () => void;
  labels: DatabaseBackupsLabels;
  /** BCP 47 language tag used to format the latest backup date. */
  locale: string;
}

function formatBackupSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  const kilobytes = sizeBytes / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;
  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

export function DatabaseBackupsCard({
  backups,
  isLoading,
  isCreating,
  hasError,
  onCreate,
  onRefresh,
  labels,
  locale,
  className,
  ...rootProps
}: DatabaseBackupsCardProps) {
  const latestBackup = backups[0];
  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  return (
    <Card {...rootProps} className={cn('min-w-0', className)}>
      <CardHeader className="gap-3 p-4 sm:p-5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-body-compact">
              <DatabaseBackup aria-hidden="true" className="size-4 shrink-0 text-primary" />
              {labels.title}
            </CardTitle>
            <CardDescription>{labels.description}</CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label={labels.refresh}
            title={labels.refresh}
            onClick={onRefresh}
            disabled={isLoading || isCreating}
          >
            <RefreshCw aria-hidden="true" className={isLoading ? 'size-4 animate-spin' : 'size-4'} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
        <div className="grid grid-cols-2 gap-2 rounded-control border border-border/60 bg-muted/20 p-3">
          <div className="min-w-0">
            <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">
              {labels.available}
            </p>
            <p className="mt-1 text-section-title font-bold tabular-nums">{backups.length}</p>
          </div>
          <div className="min-w-0 border-l border-border/60 pl-3">
            <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">
              {labels.latest}
            </p>
            <p className="mt-1 truncate text-caption font-semibold" title={latestBackup ? formatter.format(new Date(latestBackup.createdAt)) : undefined}>
              {latestBackup ? formatter.format(new Date(latestBackup.createdAt)) : labels.never}
            </p>
          </div>
        </div>

        {hasError ? (
          <p role="status" className="text-caption text-danger">{labels.loadFailed}</p>
        ) : backups.length === 0 && !isLoading ? (
          <EmptyState variant="dashed" icon={Archive} title={labels.empty} className="py-4 sm:py-4" />
        ) : latestBackup ? (
          <div className="flex min-w-0 items-center gap-2 rounded-control border border-border/60 p-3">
            <CalendarClock aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-caption font-semibold" title={latestBackup.filename}>{latestBackup.filename}</p>
              <p className="text-micro text-muted-foreground">{formatBackupSize(latestBackup.sizeBytes)}</p>
            </div>
          </div>
        ) : null}

        <Button type="button" className="w-full" onClick={onCreate} isLoading={isCreating} disabled={isLoading}>
          <HardDriveDownload aria-hidden="true" className="size-4" />
          {isCreating ? labels.creating : labels.create}
        </Button>
        <p className="text-micro leading-relaxed text-muted-foreground">{labels.note}</p>
      </CardContent>
    </Card>
  );
}
