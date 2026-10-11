import type { TFunction } from 'i18next';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { Card } from '../../components/ui/Card';
import type { DashboardImportReport } from './types';

/** Warns about bindings and backgrounds that could not be carried over by an import. */
export function DashboardImportReportBanner({ report, t }: { report: DashboardImportReport; t: TFunction }) {
  return (
    <div className="m-4 space-y-2 sm:m-6">
      <AlertBanner
        variant="warning"
        title={t(report.unresolvedBindings.length > 0
          ? 'dashboards.transfer.pending_title'
          : 'dashboards.transfer.pending_background_title')}
        message={t('dashboards.transfer.pending_message', {
          bindings: report.unresolvedBindings.length,
          backgrounds: report.nonPortableBackgrounds,
        })}
      />
      {report.unresolvedBindings.length > 0 && (
        <Card variant="flat" radius="panel" className="px-4 py-3 text-body text-foreground">
          <details>
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold">{t('dashboards.transfer.pending_details')}</summary>
            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto pl-5 text-caption text-muted-foreground">
              {report.unresolvedBindings.map((item, index) => (
                <li key={`${item.widgetId}-${item.cardId ?? ''}-${index}`} className="list-disc break-words">
                  <span className="text-foreground">{t('dashboards.transfer.pending_item', { title: item.title })}</span>
                  <span className="ml-2 text-muted-foreground">{item.tabTitle}</span>
                </li>
              ))}
            </ul>
          </details>
        </Card>
      )}
    </div>
  );
}
