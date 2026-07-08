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
      <div className="h-full w-full overflow-hidden rounded-[2rem]">
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
          "relative h-full w-full flex flex-row items-center gap-3 px-3 py-1.5 transition-all duration-300 select-none group focus:outline-none"
        )}
        onClick={handleToggle}
        disabled={isProcessing}
      >
        <div className={cn(
          "flex shrink-0 items-center justify-center transition-all duration-300",
          isOn 
            ? device.type === 'light' 
              ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] scale-110" 
              : "text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.5)] scale-110"
            : "text-muted-foreground/50 scale-100 group-hover:text-muted-foreground/70"
        )}>
          <IconComponent className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <h4 className={cn(
            "text-xs sm:text-sm font-bold tracking-tight leading-none truncate",
            isOn ? "text-foreground" : "text-muted-foreground/80"
          )}>
            {config.appearance.title || config.binding.entityName || device.name}
          </h4>
        </div>

        {/* Loading state overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] flex items-center justify-center rounded-[inherit] z-10">
            <Icons.Loader2 className="w-4 h-4 animate-spin text-primary" />
          </div>
        )}
      </button>
    );
  }

  return (
    <button
      className={cn(
        "relative h-full w-full flex flex-col items-center justify-center p-3 transition-all duration-300 select-none group focus:outline-none"
      )}
      onClick={handleToggle}
      disabled={isProcessing}
    >
      <div className={cn(
        "flex-1 flex items-center justify-center transition-all duration-300",
        isOn 
          ? device.type === 'light' 
            ? "text-amber-400 drop-shadow-[0_0_16px_rgba(251,191,36,0.6)] scale-110" 
            : "text-primary drop-shadow-[0_0_16px_rgba(var(--primary),0.6)] scale-110"
          : "text-muted-foreground/50 scale-100 group-hover:text-muted-foreground/70"
      )}>
        <IconComponent className="w-[72%] h-[72%] max-w-[7rem] max-h-[7rem]" />
      </div>
      <div className="w-full text-center mt-auto pb-1">
        <h4 className={cn(
          "text-[clamp(0.7rem,3cqi,1rem)] font-bold tracking-tight leading-tight truncate px-1",
          isOn ? "text-foreground" : "text-muted-foreground/80"
        )}>
          {config.appearance.title || config.binding.entityName || device.name}
        </h4>
      </div>

      {/* Loading state overlay */}
      {isProcessing && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] flex items-center justify-center rounded-[inherit] z-10">
          <Icons.Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}
    </button>
  );
}
