import { Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDisplayControlCatalog } from './useDisplayControlCatalog';
import type { SnapshotDevice } from '../stores/useDeviceSnapshotStore';
import { Button } from './ui/Button';
import { Drawer } from './ui/Drawer';
import { DisplayCatalogSkeleton } from './ui/ComponentSkeletons';

import type { DisplayCatalogCommand, DisplayControlCatalog } from './displayControlCatalog';
export { parseDisplayControlCatalog } from './displayControlCatalog';
export type { DisplayCatalogCommand, DisplayControlCatalog } from './displayControlCatalog';

export function SmartDisplayCatalogContent({ catalog }: { catalog: DisplayControlCatalog }) {
  const { t } = useTranslation();
  const visibleCommands = catalog.commands.filter((command) => command.visibility === 'visible');
  const renderCommand = (command: DisplayCatalogCommand) => (
    <li key={command.key} className="min-w-0 border-b border-border/60 py-3 last:border-0">
      <p className="break-words font-semibold text-foreground">{command.displayName}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {t(command.dashboardEligible ? 'inbox.smart_display.dashboard_available'
          : command.executableInHomePilot && command.controlType === 'slider'
            ? 'inbox.smart_display.control_available' : 'inbox.smart_display.included_in_plan')}
      </p>
    </li>
  );

  return <div className="space-y-8">
    <section aria-labelledby="display-plan-title">
      <h4 id="display-plan-title" className="text-sm font-semibold text-muted-foreground">{t('inbox.smart_display.current_plan')}</h4>
      <p className="mt-2 break-words text-lg font-bold text-foreground">
        {catalog.plan.name || t('inbox.smart_display.plan_fallback', { id: catalog.plan.id })}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {catalog.plan.type || t('inbox.smart_display.plan_pending')}
      </p>
    </section>
    <section aria-labelledby="display-included-controls">
      <h4 id="display-included-controls" className="text-base font-bold">{t('inbox.smart_display.included_controls')}</h4>
      {visibleCommands.length ? <ul className="mt-2">{visibleCommands.map(renderCommand)}</ul>
        : <p className="mt-2 text-sm text-muted-foreground">{t('inbox.smart_display.no_actions')}</p>}
    </section>
  </div>;
}

export function SmartDisplayControls({ device, onClose }: { device: SnapshotDevice; onClose: () => void }) {
  const { t } = useTranslation();
  const { catalog, loading, loadError, retry } = useDisplayControlCatalog(device.id);

  const connectionState = device.lastKnownState?.connectionState;
  return <Drawer isOpen onClose={onClose} title={t('inbox.smart_display.manage_controls')}>
    <div className="border-b border-border px-5 py-6 pr-16 sm:px-7">
      <div className="flex items-center gap-3">
        <Monitor className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="break-words text-xl font-bold">{device.name}</h3>
          <p className="text-sm text-muted-foreground">
            {t('inbox.smart_display.type')} · {t(connectionState === 'online' ? 'inbox.smart_display.online'
              : connectionState === 'offline' ? 'inbox.smart_display.offline' : 'inbox.smart_display.unknown')}
          </p>
        </div>
      </div>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
      {loading && !catalog ? <DisplayCatalogSkeleton label={t('inbox.smart_display.loading')} /> : loadError ? (
        <div role="alert" className="space-y-3">
          <p>{t('inbox.smart_display.load_error')}</p>
          <Button type="button" variant="outline" onClick={retry}>
            {t('inbox.smart_display.retry')}
          </Button>
        </div>
      ) : catalog ? <SmartDisplayCatalogContent catalog={catalog} /> : null}
    </div>
  </Drawer>;
}
