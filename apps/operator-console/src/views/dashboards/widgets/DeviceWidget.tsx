import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Icons from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useDeviceSnapshotStore } from '../../../stores/useDeviceSnapshotStore';
import type { DashboardWidgetConfig } from '../types';
import { apiFetch } from '../../../lib/apiClient';
import { API_BASE_URL } from '../../../config';
import { isDeviceActive } from '../dashboardUtils';
import { DormantWidgetPlaceholder } from '../components/DormantWidgetPlaceholder';
import { CameraDeviceTile } from '../../../components/CameraDeviceTile';

const API = `${API_BASE_URL}/api/v1`;

export function DeviceWidget({ config, isEditing, onConfigure }: { config: DashboardWidgetConfig; isEditing: boolean; onConfigure?: () => void }) {
  const { t } = useTranslation();
  const devices = useDeviceSnapshotStore((state) => state.devices);
  const device = devices.find(d => d.id === config.binding.entityId);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!device) {
    return (
      <DormantWidgetPlaceholder
        title={t('dashboards.widgets.selected_device.label')}
        icon={Icons.Cpu}
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

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsProcessing(true);
    try {
      await apiFetch(`${API}/devices/${device.id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: isOn ? 'turn_off' : 'turn_on' })
      });
    } catch (err) {
      console.error('Failed to toggle device:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const getIcon = (): React.ElementType => {
    if (config.appearance.icon) {
      let name = config.appearance.icon.trim();
      
      // Remove mdi: prefix
      if (name.toLowerCase().startsWith('mdi:')) {
        name = name.substring(4);
      }
      
      const customMap: Record<string, string> = {
        gata: 'Cat',
        cat: 'Cat',
        luz: 'Lightbulb',
        interruptor: 'Power',
        enchuf: 'Plug',
        enchufe: 'Plug',
        camera: 'Camera',
        camara: 'Camera',
        recessed: 'Lightbulb',
        'light-recessed': 'Lightbulb'
      };
      
      const lower = name.toLowerCase();
      let pascalName = '';
      if (customMap[lower]) {
        pascalName = customMap[lower];
      } else {
        // Convert kebab-case or snake_case to PascalCase
        pascalName = name
          .replace(/[-_]([a-z])/g, (_, g) => g.toUpperCase())
          .replace(/^\w/, (c) => c.toUpperCase());
      }

      const ResolvedIcon = (Icons as any)[pascalName];
      if (ResolvedIcon) return ResolvedIcon;
    }

    switch (device.type) {
      case 'light': return Icons.Lightbulb;
      case 'switch': return Icons.Power;
      default: return Icons.Power;
    }
  };
  
  const IconComponent = getIcon();
  const isCompact = config.layout.h === 1;

  if (isCompact) {
    return (
      <button
        className={cn(
          "relative h-full w-full min-w-0 min-h-0 flex flex-row items-center gap-3 px-3 py-2 @md:px-4 transition-all duration-300 select-none group focus:outline-none"
        )}
        onClick={handleToggle}
        disabled={isProcessing}
      >
        <div className={cn(
          "flex shrink-0 items-center justify-center transition-all duration-300",
          isOn 
            ? device.type === 'light' 
              ? "text-amber-400 drop-shadow-none shadow-light-warm-sm scale-110" 
              : "text-primary drop-shadow-primary-beacon scale-110"
            : "text-muted-foreground/50 scale-100 group-hover:text-muted-foreground/70"
        )}>
          <IconComponent className="h-device-icon-sm w-device-icon-sm" />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden text-left">
          <h4 className={cn(
            "text-widget-body-fluid font-bold tracking-tight leading-none truncate",
            isOn ? "text-foreground" : "text-muted-foreground/80"
          )}>
            {config.appearance.title || config.binding.entityName || device.name}
          </h4>
        </div>

        {/* Loading state overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-surface flex items-center justify-center rounded-[inherit] z-10">
            <Icons.Loader2 className="w-4 h-4 animate-spin text-primary" />
          </div>
        )}
      </button>
    );
  }

  return (
    <button
      className={cn(
        "relative h-full w-full min-w-0 min-h-0 flex flex-col items-center justify-center p-3 @md:p-4 transition-all duration-300 select-none group focus:outline-none"
      )}
      onClick={handleToggle}
      disabled={isProcessing}
    >
      <div className={cn(
        "flex-1 flex items-center justify-center transition-all duration-300",
        isOn 
          ? device.type === 'light' 
            ? "text-amber-400 drop-shadow-none shadow-light-warm-lg scale-110" 
            : "text-primary drop-shadow-none shadow-primary-glow scale-110"
          : "text-muted-foreground/50 scale-100 group-hover:text-muted-foreground/70"
      )}>
        <IconComponent className="h-device-icon-lg w-device-icon-lg" />
      </div>
      <div className="w-full min-w-0 overflow-hidden text-center mt-auto pb-1">
        <h4 className={cn(
          "text-widget-body-lg-fluid font-bold tracking-tight leading-tight truncate px-1",
          isOn ? "text-foreground" : "text-muted-foreground/80"
        )}>
          {config.appearance.title || config.binding.entityName || device.name}
        </h4>
      </div>

      {/* Loading state overlay */}
      {isProcessing && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-surface flex items-center justify-center rounded-[inherit] z-10">
          <Icons.Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}
    </button>
  );
}
