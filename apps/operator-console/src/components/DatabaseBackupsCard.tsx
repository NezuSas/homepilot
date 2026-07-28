import { Archive, CalendarClock, DatabaseBackup, HardDriveDownload, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';

export interface DatabaseBackupSummary {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

interface DatabaseBackupsCardProps {
  backups: DatabaseBackupSummary[];
  isLoading: boolean;
  isCreating: boolean;
  hasError: boolean;
  onCreate: () => void;
  onRefresh: () => void;
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
  onRefresh
}: DatabaseBackupsCardProps) {
  const { t, i18n } = useTranslation();
  const latestBackup = backups[0];
  const formatter = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  return (
    <Card className="min-w-0">
      <CardHeader className="gap-3 p-4 sm:p-5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-body-compact">
              <DatabaseBackup aria-hidden="true" className="size-4 shrink-0 text-primary" />
              {t('diagnostics.backups.title')}
            </CardTitle>
            <CardDescription>{t('diagnostics.backups.description')}</CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label={t('diagnostics.backups.refresh')}
            title={t('diagnostics.backups.refresh')}
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
              {t('diagnostics.backups.available')}
            </p>
            <p className="mt-1 text-section-title font-bold tabular-nums">{backups.length}</p>
          </div>
          <div className="min-w-0 border-l border-border/60 pl-3">
            <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">
              {t('diagnostics.backups.latest')}
            </p>
            <p className="mt-1 truncate text-caption font-semibold" title={latestBackup ? formatter.format(new Date(latestBackup.createdAt)) : undefined}>
              {latestBackup ? formatter.format(new Date(latestBackup.createdAt)) : t('common.never')}
            </p>
          </div>
        </div>

        {hasError ? (
          <p role="status" className="text-caption text-danger">{t('diagnostics.backups.load_failed')}</p>
        ) : backups.length === 0 && !isLoading ? (
          <div className="flex items-center gap-2 rounded-control border border-dashed border-border/70 p-3 text-caption text-muted-foreground">
            <Archive aria-hidden="true" className="size-4 shrink-0" />
            {t('diagnostics.backups.empty')}
          </div>
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
          {isCreating ? t('diagnostics.backups.creating') : t('diagnostics.backups.create')}
        </Button>
        <p className="text-micro leading-relaxed text-muted-foreground">{t('diagnostics.backups.note')}</p>
      </CardContent>
    </Card>
  );
}
