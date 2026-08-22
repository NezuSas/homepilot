import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleHelp, Cpu, Lightbulb, Loader2, Power } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useDeviceSnapshotStore } from '../../../stores/useDeviceSnapshotStore';
import type { DashboardWidgetConfig } from '../types';
import { apiFetch } from '../../../lib/apiClient';
import { API_BASE_URL } from '../../../config';
import { isDeviceActive } from '../dashboardUtils';
import { DormantWidgetPlaceholder } from '../components/DormantWidgetPlaceholder';
import { CameraDeviceTile } from '../../../components/CameraDeviceTile';
import { getDashboardIconComponent, needsMdiCatalog, useMdiCatalogLoaded } from '../components/IconPicker';
import { Button } from '../../../components/ui/Button';
import { getDeviceTileStateClasses } from '../../../components/ui/DeviceTileShell';
import { createDeviceTogglePlan, executeDeviceToggle } from './deviceToggle';

const API = `${API_BASE_URL}/api/v1`;

export function DeviceWidget({ config, isEditing, onConfigure }: { config: DashboardWidgetConfig; isEditing: boolean; onConfigure?: () => void }) {
  const { t } = useTranslation();
  // A saved custom MDI icon remains supported without requesting the full
  // catalog for the normal HomePilot icon set.
  useMdiCatalogLoaded(needsMdiCatalog(config.appearance.icon));
  const devices = useDeviceSnapshotStore((state) => state.devices);
  const upsertDevice = useDeviceSnapshotStore((state) => state.upsertDevice);
  const device = devices.find((candidate) => candidate.id === config.binding.entityId);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  if (!device) {
    return (
      <DormantWidgetPlaceholder
        title={t('dashboards.widgets.selected_device.label')}
        icon={Cpu}
        message={t('dashboards.widgets.selected_device.placeholder')}
        isEditing={isEditing}
        onConfigure={onConfigure}
        variant={config.appearance.variant}
      />
    );
  }

  if (device.type === 'camera' || device.semanticType === 'camera') {
    return (
      <div className="h-full w-full overflow-hidden rounded-panel">
        <CameraDeviceTile device={device} />
      </div>
    );
  }

  const isOn = isDeviceActive(device);
  const isPhysicalLight = device.type === 'light' || device.semanticType === 'light';
  const togglePlan = createDeviceTogglePlan(device);
  const canToggle = togglePlan !== null;
  const displayName = config.appearance.title || config.binding.entityName || device.name;
  const IconComponent = getIconComponent(device.type, config.appearance.icon);
  const isCompact = config.layout.h === 1;
  const stateLabel = isOn ? t('common.on') : t('common.off');

  const handleToggle = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (isProcessing || !canToggle) return;

    setIsProcessing(true);
    setToggleError(null);

    const result = await executeDeviceToggle(device, {
      upsertDevice,
      sendCommand: async (command) => {
        const response = await apiFetch(`${API}/devices/${encodeURIComponent(device.id)}/command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command }),
        });

        if (!response.ok) {
          throw new Error(`DEVICE_COMMAND_${response.status}`);
        }

        return await response.json();
      },
    });

    if (!result.succeeded) {
      setToggleError(t('dashboards.widgets.selected_device.toggle_error'));
    }

    setIsProcessing(false);
  };

  return (
    <Button
      type="button"
      className={cn(
        'device-toggle-control relative h-full w-full min-h-0 min-w-0 overflow-hidden rounded-[inherit] text-left transition-[background-color,border-color,box-shadow,transform] duration-300 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:cursor-default',
        'group',
        getDeviceTileStateClasses(isOn, isPhysicalLight ? 'light' : 'brand'),
        isCompact
          ? 'flex items-center gap-3 px-3 py-2 @md:px-4'
          : 'flex flex-col justify-between p-3 @md:p-4',
      )}
      onClick={handleToggle}
      disabled={isProcessing || !canToggle}
      aria-pressed={isOn}
      aria-busy={isProcessing || undefined}
      aria-label={t('dashboards.widgets.selected_device.toggle_label', { name: displayName, state: stateLabel })}
      title={!canToggle ? t('dashboards.widgets.selected_device.toggle_unavailable') : undefined}
      variant="outline"
    >
      <div className={cn('flex min-w-0 items-center', isCompact ? 'flex-1 gap-3' : 'w-full justify-between gap-3')}>
        <span
          aria-hidden="true"
          className={cn(
            'device-toggle-icon flex shrink-0 items-center justify-center rounded-control transition-colors duration-300',
            isCompact ? 'h-9 w-9' : 'h-11 w-11 @md:h-12 @md:w-12',
          )}
        >
          <IconComponent className={cn(isCompact ? 'h-device-icon-sm w-device-icon-sm' : 'h-device-icon-md w-device-icon-md')} />
        </span>
        {isCompact && (
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-widget-body-fluid font-semibold leading-tight tracking-tight">{displayName}</h4>
            <p className="mt-0.5 text-widget-meta-fluid text-muted-foreground">{stateLabel}</p>
          </div>
        )}
        <span className="device-toggle-status shrink-0 rounded-pill px-2 py-1 text-widget-meta-fluid font-semibold leading-none">
          {stateLabel}
        </span>
      </div>

      {!isCompact && (
        <div className="min-w-0 pr-1">
          <h4 className="truncate text-widget-body-lg-fluid font-semibold leading-tight tracking-tight">{displayName}</h4>
          <p className="mt-1 text-widget-meta-fluid text-muted-foreground">
            {t('dashboards.widgets.selected_device.toggle_hint', { state: stateLabel })}
          </p>
        </div>
      )}

      {toggleError && (
        <span role="status" className="device-toggle-error absolute inset-x-3 bottom-2 truncate rounded-control px-2 py-1 text-widget-meta-fluid font-medium">
          {toggleError}
        </span>
      )}

      {isProcessing && (
        <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/28 backdrop-blur-surface" aria-hidden="true">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </span>
      )}
    </Button>
  );
}

function getIconComponent(deviceType: string, configuredIcon?: string): React.ElementType {
  if (configuredIcon) {
    const raw = configuredIcon.trim();
    const withoutPrefix = raw.replace(/^mdi:/i, '');

    // Legacy Spanish aliases stored before the shared MDI+Lucide catalog
    // existed; kept so previously saved icons keep resolving.
    const customMap: Record<string, string> = {
      gata: 'mdi:cat',
      cat: 'mdi:cat',
      luz: 'mdi:lightbulb',
      interruptor: 'mdi:power',
      enchuf: 'mdi:power-plug',
      enchufe: 'mdi:power-plug',
      camera: 'mdi:camera',
      camara: 'mdi:camera',
      recessed: 'mdi:lightbulb',
      'light-recessed': 'mdi:lightbulb',
    };

    const resolved = getDashboardIconComponent(customMap[withoutPrefix.toLowerCase()] ?? raw);
    if (resolved !== CircleHelp) return resolved;
  }

  switch (deviceType) {
    case 'light': return Lightbulb;
    case 'switch': return Power;
    default: return Power;
  }
}
