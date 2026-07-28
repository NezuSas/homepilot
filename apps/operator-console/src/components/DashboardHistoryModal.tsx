import { History, RotateCcw } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/Button';
import { LoadingState } from './ui/LoadingState';
import { Modal } from './ui/Modal';

export interface DashboardRevisionSummary {
  id: string;
  createdAt: string;
  snapshot: {
    title: string;
    tabs: Array<unknown>;
  };
}

interface DashboardHistoryModalProps {
  isOpen: boolean;
  revisions: DashboardRevisionSummary[];
  isLoading: boolean;
  onClose: () => void;
  onRestore: (revision: DashboardRevisionSummary) => void;
}

export function DashboardHistoryModal({
  isOpen,
  revisions,
  isLoading,
  onClose,
  onRestore,
}: DashboardHistoryModalProps) {
  const { t, i18n } = useTranslation();
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }), [i18n.language]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('dashboards.history.title')}
      description={t('dashboards.history.description')}
      headerAlign="start"
      className="max-w-2xl"
      contentClassName="pt-0"
    >
      {isLoading ? (
        <LoadingState label={t('dashboards.history.loading')} className="min-h-40" size="sm" />
      ) : revisions.length === 0 ? (
        <div className="rounded-panel border border-dashed border-border/70 bg-muted/20 p-6 text-center">
          <History className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-body font-semibold text-foreground">{t('dashboards.history.empty_title')}</p>
          <p className="mt-1 text-caption text-muted-foreground">{t('dashboards.history.empty_description')}</p>
        </div>
      ) : (
        <ul className="space-y-2" aria-label={t('dashboards.history.title')}>
          {revisions.map((revision) => (
            <li key={revision.id} className="flex min-w-0 flex-col gap-3 rounded-control border border-border/70 bg-muted/15 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-body font-semibold text-foreground">{revision.snapshot.title}</p>
                <p className="mt-1 text-caption text-muted-foreground">
                  {t('dashboards.history.metadata', {
                    date: dateFormatter.format(new Date(revision.createdAt)),
                    count: revision.snapshot.tabs.length,
                  })}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onRestore(revision)}
                className="shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                {t('dashboards.history.restore')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
