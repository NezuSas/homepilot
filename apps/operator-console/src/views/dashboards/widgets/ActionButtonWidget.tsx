import { useEffect, useRef, useState } from 'react';
import { Check, CircleAlert, Loader2, MousePointerClick } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../../lib/apiClient';
import { canExecuteCommand } from '../../../lib/deviceCapabilities';
import { isMomentaryPlcCommand, plcErrorKey, plcResponseError } from '../../../lib/plcUi';
import { isDeviceUnavailable } from '../../../lib/deviceAvailability';
import { cn } from '../../../lib/utils';
import { API_BASE_URL } from '../../../config';
import { Button } from '../../../components/ui/Button';
import { useDeviceSnapshotStore, type SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';
import type { DashboardWidgetConfig } from '../types';
import { DormantWidgetPlaceholder } from '../components/DormantWidgetPlaceholder';

type ActionStatus = 'idle' | 'pending' | 'success' | 'error';

const API = `${API_BASE_URL}/api/v1`;

/**
 * Stateless Home Assistant-style Button card.
 *
 * Unlike DeviceWidget, this card never exposes an on/off state. It is only
 * enabled for devices that explicitly declare the `press` capability.
 */
export function ActionButtonWidget({ config, isEditing, onConfigure }: {
  config: DashboardWidgetConfig;
  isEditing: boolean;
  onConfigure?: () => void;
}) {
  const { t } = useTranslation();
  const devices = useDeviceSnapshotStore((state) => state.devices);
  const upsertDevice = useDeviceSnapshotStore((state) => state.upsertDevice);
  const feedbackTimerRef = useRef<number | null>(null);
  const executionLock = useRef(false);
  const [status, setStatus] = useState<ActionStatus>('idle');
  const [actionError, setActionError] = useState<string | null>(null);
  useEffect(() => () => {
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
  }, []);

  const device = devices.find((candidate) => candidate.id === config.binding.entityId);

  if (!device) {
    return (
      <DormantWidgetPlaceholder
        title={t('dashboards.widgets.action_button.label')}
        icon={MousePointerClick}
        message={t('dashboards.widgets.action_button.placeholder')}
        isEditing={isEditing}
        onConfigure={onConfigure}
        variant={config.appearance.variant}
      />
    );
  }

  const title = config.appearance.title || config.binding.entityName || device.name;
  const plcPulse = isMomentaryPlcCommand(device);
  const canPress = canExecuteCommand(device, 'press') && (!plcPulse || !isDeviceUnavailable(device));
  const feedbackLabel = status === 'pending'
    ? t('dashboards.widgets.action_button.pending')
    : status === 'success'
      ? t('dashboards.widgets.action_button.success')
      : status === 'error'
        ? t('dashboards.widgets.action_button.error')
        : t('dashboards.widgets.action_button.execute');

  const handlePress = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (isEditing || executionLock.current || status === 'pending' || !canPress) return;
    executionLock.current = true;

    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    setStatus('pending');
    setActionError(null);
    try {
      const response = await apiFetch(`${API}/devices/${encodeURIComponent(device.id)}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'press' }),
      });
      if (!response.ok) throw new Error(plcPulse ? await plcResponseError(response) : 'ACTION_BUTTON_FAILED');
      const updated = await response.json() as SnapshotDevice;
      upsertDevice(updated);
      if (plcPulse && (updated.lastKnownState?.confirmation === 'reset_failed' || updated.lastKnownState?.error)) throw new Error(plcErrorKey(updated.lastKnownState.error ?? 'RESET_FAILED'));
      setStatus(plcPulse ? 'idle' : 'success');
    } catch (error) {
      if (plcPulse) setActionError(error instanceof Error && error.message.startsWith('plc.errors.') ? error.message : plcErrorKey(undefined));
      setStatus(plcPulse ? 'idle' : 'error');
    } finally {
      executionLock.current = false;
    }

    if (!plcPulse) feedbackTimerRef.current = window.setTimeout(() => setStatus('idle'), 2800);
  };

  return (
    <Button
      type="button"
      onClick={handlePress}
      disabled={isEditing || status === 'pending' || !canPress}
      aria-busy={status === 'pending' || undefined}
      data-plc-momentary={plcPulse || undefined}
      data-action-state={status}
      aria-label={t('dashboards.widgets.action_button.aria', { name: title })}
      title={!canPress ? t('dashboards.widgets.action_button.unavailable') : undefined}
      variant="ghost"
      className={cn(
        'dashboard-action-button relative flex h-full w-full min-h-0 min-w-0 flex-col justify-between overflow-hidden rounded-[inherit] border p-3 text-left transition-[background-color,border-color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-default disabled:opacity-65 @md:p-4',
        `dashboard-action-button--${status}`,
      )}
    >
      <div className="flex w-full min-w-0 items-center justify-start gap-2.5">
        <span className="dashboard-action-button__icon grid h-11 w-11 shrink-0 place-items-center rounded-control border">
          {status === 'pending' ? <Loader2 className="h-5 w-5 animate-spin" /> : status === 'success' ? <Check className="h-5 w-5" /> : status === 'error' ? <CircleAlert className="h-5 w-5" /> : <MousePointerClick className="h-5 w-5" />}
        </span>
        <span className="dashboard-action-button__status min-w-0 truncate rounded-pill border px-2.5 py-1 text-widget-meta-fluid font-semibold normal-case tracking-normal">
          {feedbackLabel}
        </span>
      </div>

      <div className="w-full min-w-0 pt-3">
        <h4 className="line-clamp-2 text-widget-body-lg-fluid font-black leading-tight tracking-tight text-foreground">{title}</h4>
        <p className="mt-1 line-clamp-2 text-widget-meta-fluid text-muted-foreground">
          {t('dashboards.widgets.action_button.description')}
        </p>
        {actionError && <p role="alert" className="mt-1 break-words text-widget-meta-fluid text-danger">{t(actionError)}</p>}
      </div>
    </Button>
  );
}
