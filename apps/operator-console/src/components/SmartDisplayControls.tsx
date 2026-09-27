import React, { useEffect, useState } from 'react';
import { ArrowLeft, House, Monitor, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import type { SnapshotDevice } from '../stores/useDeviceSnapshotStore';
import { Button } from './ui/Button';
import { Drawer } from './ui/Drawer';
import { LoadingState } from './ui/LoadingState';
import { RangeInput } from './ui/RangeInput';

export type DisplayAction = 'navigate_home' | 'navigate_back' | 'volume_set';

export function selectSmartDisplayControls(payload: unknown, deviceId: string): DisplayAction[] {
  if (!payload || typeof payload !== 'object' || !('deviceId' in payload) || !('actions' in payload)
    || payload.deviceId !== deviceId || !Array.isArray(payload.actions)) return [];

  const actions = new Set<DisplayAction>();
  for (const action of payload.actions) {
    if (!action || typeof action !== 'object' || action.visibility !== 'visible'
      || action.requiresConfirmation !== false) continue;
    if ((action.semanticAction === 'navigate_home' || action.semanticAction === 'navigate_back')
      && action.controlType === 'button') actions.add(action.semanticAction);
    if (action.semanticAction === 'volume_set' && action.controlType === 'slider') actions.add('volume_set');
  }
  return [...actions];
}

interface SmartDisplayControlsProps {
  device: SnapshotDevice;
  onClose: () => void;
  onCommand: (deviceId: string, command: string, params?: Record<string, unknown>) => Promise<SnapshotDevice | null>;
  onUpdate: (device: SnapshotDevice) => void;
}

interface SmartDisplayActionControlsProps {
  actions: DisplayAction[];
  disabled: boolean;
  busyAction: DisplayAction | null;
  volume: number;
  onVolumeChange: (volume: number) => void;
  onAction: (action: DisplayAction) => void;
}

export const SmartDisplayActionControls: React.FC<SmartDisplayActionControlsProps> = ({
  actions, disabled, busyAction, volume, onVolumeChange, onAction,
}) => {
  const { t } = useTranslation();
  if (actions.length === 0) return <p className="text-sm text-muted-foreground">{t('inbox.smart_display.no_actions')}</p>;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {actions.includes('navigate_home') && (
          <Button type="button" variant="secondary" disabled={disabled} isLoading={busyAction === 'navigate_home'}
            onClick={() => onAction('navigate_home')} className="w-full">
            <House className="h-4 w-4" aria-hidden="true" /> {t('inbox.smart_display.home')}
          </Button>
        )}
        {actions.includes('navigate_back') && (
          <Button type="button" variant="secondary" disabled={disabled} isLoading={busyAction === 'navigate_back'}
            onClick={() => onAction('navigate_back')} className="w-full">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t('inbox.smart_display.back')}
          </Button>
        )}
      </div>
      {actions.includes('volume_set') && (
        <div className="rounded-card border border-border bg-background/40 p-4">
          <label htmlFor="smart-display-volume" className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Volume2 className="h-4 w-4" aria-hidden="true" /> {t('inbox.smart_display.volume')}: {volume}%
          </label>
          <RangeInput id="smart-display-volume" min={0} max={100} value={volume}
            disabled={disabled} onValueChange={onVolumeChange} />
          <p className="mt-2 text-xs text-muted-foreground">{t('inbox.smart_display.volume_hint')}</p>
          <Button type="button" className="mt-4 w-full" disabled={disabled}
            isLoading={busyAction === 'volume_set'} onClick={() => onAction('volume_set')}>
            {t('inbox.smart_display.apply_volume')}
          </Button>
        </div>
      )}
    </div>
  );
};

export const SmartDisplayControls: React.FC<SmartDisplayControlsProps> = ({ device, onClose, onCommand, onUpdate }) => {
  const { t } = useTranslation();
  const [actions, setActions] = useState<DisplayAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyAction, setBusyAction] = useState<DisplayAction | null>(null);
  const [feedback, setFeedback] = useState<'success' | 'error' | null>(null);
  const [volume, setVolume] = useState(50);
  const online = device.lastKnownState?.connectionState === 'online';

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    setActions([]);
    void apiFetch(`${API_BASE_URL}/api/v1/devices/${encodeURIComponent(device.id)}/effective-actions`, {
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error('Effective actions unavailable');
      const payload: unknown = await response.json();
      if (!controller.signal.aborted) setActions(selectSmartDisplayControls(payload, device.id));
    }).catch(() => {
      if (!controller.signal.aborted) setLoadError(true);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [device.id, reloadKey]);

  const runAction = async (action: DisplayAction) => {
    if (busyAction || !online || !actions.includes(action)) return;
    setBusyAction(action);
    setFeedback(null);
    try {
      const updated = await onCommand(device.id, action, action === 'volume_set' ? { volume } : undefined);
      if (updated) {
        onUpdate(updated);
        setFeedback('success');
      } else setFeedback('error');
    } catch {
      setFeedback('error');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <Drawer isOpen onClose={onClose} title={t('inbox.smart_display.controls')}>
      <div className="border-b border-border px-5 py-6 pr-16 sm:px-7">
        <div className="flex items-center gap-3">
          <Monitor className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="truncate text-xl font-bold">{device.name}</h3>
            <p className="text-sm text-muted-foreground">{online ? t('inbox.smart_display.online')
              : device.lastKnownState?.connectionState === 'offline'
                ? t('inbox.smart_display.offline') : t('inbox.smart_display.unknown')}</p>
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
        ) : (
          <SmartDisplayActionControls actions={actions} disabled={!online || busyAction !== null}
            busyAction={busyAction} volume={volume} onVolumeChange={setVolume} onAction={(action) => void runAction(action)} />
        )}
        {feedback && <p role="status" className="mt-5 text-sm text-muted-foreground">
          {t(feedback === 'success' ? 'inbox.smart_display.command_sent' : 'inbox.smart_display.command_error')}
        </p>}
      </div>
    </Drawer>
  );
};
