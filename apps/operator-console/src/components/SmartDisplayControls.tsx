import { useEffect, useState } from 'react';
import { Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import type { SnapshotDevice } from '../stores/useDeviceSnapshotStore';
import { Button } from './ui/Button';
import { Drawer } from './ui/Drawer';
import { LoadingState } from './ui/LoadingState';

export interface DisplayCatalogCommand {
  key: string;
  displayName: string;
  implementationType: 'homepilot' | 'legacy_adb';
  controlType: 'button' | 'slider';
  visibility: 'visible' | 'hidden';
  executableInHomePilot: boolean;
  dashboardEligible: boolean;
}

export interface DisplayControlCatalog {
  deviceId: string;
  plan: { id: number; name: string | null; type: string | null };
  commands: DisplayCatalogCommand[];
}

export function parseDisplayControlCatalog(value: unknown, deviceId: string): DisplayControlCatalog | null {
  if (!value || typeof value !== 'object' || !('deviceId' in value) || value.deviceId !== deviceId
    || !('plan' in value) || !value.plan || typeof value.plan !== 'object'
    || !('commands' in value) || !Array.isArray(value.commands)) return null;
  const plan = value.plan;
  if (!('id' in plan) || typeof plan.id !== 'number' || !Number.isSafeInteger(plan.id) || plan.id <= 0
    || !('name' in plan) || (plan.name !== null && typeof plan.name !== 'string')
    || !('type' in plan) || (plan.type !== null && typeof plan.type !== 'string')) return null;
  const commands: DisplayCatalogCommand[] = [];
  for (const item of value.commands) {
    if (!item || typeof item !== 'object' || typeof item.key !== 'string'
      || typeof item.displayName !== 'string'
      || (item.implementationType !== 'homepilot' && item.implementationType !== 'legacy_adb')
      || (item.controlType !== 'button' && item.controlType !== 'slider')
      || (item.visibility !== 'visible' && item.visibility !== 'hidden')
      || typeof item.executableInHomePilot !== 'boolean'
      || typeof item.dashboardEligible !== 'boolean') return null;
    commands.push({ key: item.key, displayName: item.displayName,
      implementationType: item.implementationType, controlType: item.controlType, visibility: item.visibility,
      executableInHomePilot: item.executableInHomePilot, dashboardEligible: item.dashboardEligible });
  }
  return { deviceId, plan: { id: plan.id, name: plan.name, type: plan.type }, commands };
}

export function SmartDisplayCatalogContent({ catalog }: { catalog: DisplayControlCatalog }) {
  const { t } = useTranslation();
  const visibleCommands = catalog.commands.filter((command) => command.visibility === 'visible');
  const available = visibleCommands.filter((command) => command.executableInHomePilot);
  const remaining = visibleCommands.filter((command) => !command.executableInHomePilot);
  const renderCommand = (command: DisplayCatalogCommand) => (
    <li key={command.key} className="min-w-0 border-b border-border/60 py-3 last:border-0">
      <p className="break-words font-semibold text-foreground">{command.displayName}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {command.executableInHomePilot
          ? t(command.controlType === 'button' ? 'inbox.smart_display.direct_action' : 'inbox.smart_display.value_control')
          : t(command.implementationType === 'legacy_adb'
            ? 'inbox.smart_display.managed_externally' : 'inbox.smart_display.included_unavailable')}
      </p>
      {command.executableInHomePilot && <p className="mt-1 text-sm text-primary">
        {t(command.dashboardEligible ? 'inbox.smart_display.dashboard_available' : 'inbox.smart_display.control_available')}
      </p>}
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
    <section aria-labelledby="display-homepilot-controls">
      <h4 id="display-homepilot-controls" className="text-base font-bold">{t('inbox.smart_display.homepilot_controls')}</h4>
      {available.length ? <ul className="mt-2">{available.map(renderCommand)}</ul>
        : <p className="mt-2 text-sm text-muted-foreground">{t('inbox.smart_display.no_actions')}</p>}
    </section>
    <section aria-labelledby="display-included-controls">
      <h4 id="display-included-controls" className="text-base font-bold">{t('inbox.smart_display.included_controls')}</h4>
      {remaining.length ? <ul className="mt-2">{remaining.map(renderCommand)}</ul>
        : <p className="mt-2 text-sm text-muted-foreground">{t('inbox.smart_display.no_other_controls')}</p>}
    </section>
  </div>;
}

export function SmartDisplayControls({ device, onClose }: { device: SnapshotDevice; onClose: () => void }) {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<DisplayControlCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    setCatalog(null);
    void apiFetch(`${API_BASE_URL}/api/v1/devices/${encodeURIComponent(device.id)}/control-catalog`, {
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error('Catalog unavailable');
      const parsed = parseDisplayControlCatalog(await response.json() as unknown, device.id);
      if (!parsed) throw new Error('Invalid catalog');
      if (!controller.signal.aborted) setCatalog(parsed);
    }).catch(() => { if (!controller.signal.aborted) setLoadError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [device.id, reloadKey]);

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
      {loading ? <LoadingState label={t('inbox.smart_display.loading')} size="sm" /> : loadError ? (
        <div role="alert" className="space-y-3">
          <p>{t('inbox.smart_display.load_error')}</p>
          <Button type="button" variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            {t('inbox.smart_display.retry')}
          </Button>
        </div>
      ) : catalog ? <SmartDisplayCatalogContent catalog={catalog} /> : null}
    </div>
  </Drawer>;
}
