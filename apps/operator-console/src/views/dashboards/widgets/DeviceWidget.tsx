import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import { useDeviceSnapshotStore } from '../../../stores/useDeviceSnapshotStore';
import type { DashboardWidgetConfig } from '../types';
import { Power, Lightbulb, ToggleRight, Cpu, Loader2 } from 'lucide-react';
import { apiFetch } from '../../../lib/apiClient';
import { API_BASE_URL } from '../../../config';
import { isDeviceActive } from '../dashboardUtils';
import { DormantWidgetPlaceholder } from '../components/DormantWidgetPlaceholder';

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
        icon={Cpu}
        message={t('dashboards.widgets.selected_device.placeholder')}
        isEditing={isEditing}
        onConfigure={onConfigure}
        variant={config.appearance.variant}
      />
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

  const getIcon = () => {
    switch (device.type) {
      case 'light': return <Lightbulb className={cn("w-6 h-6", isOn ? "text-amber-400" : "text-muted-foreground/40")} />;
      case 'switch': return <ToggleRight className={cn("w-6 h-6", isOn ? "text-primary" : "text-muted-foreground/40")} />;
      default: return <Cpu className={cn("w-6 h-6", isOn ? "text-primary" : "text-muted-foreground/40")} />;
    }
  };

  return (
    <div className={cn(
      "relative h-full w-full flex flex-col justify-between p-7 transition-all duration-700",
      isOn && "bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent"
    )}>
      {/* Background Radiance */}
      {isOn && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -z-10 animate-pulse" />
      )}

      <div className="flex items-start justify-between">
        <div className={cn(
          "p-4 rounded-3xl border transition-all duration-500",
          isOn ? "bg-primary/10 border-primary/20 shadow-lg shadow-primary/10 scale-110" : "bg-muted/40 border-border/40"
        )}>
          {getIcon()}
        </div>
        
        <div className="flex flex-col items-end">
           <span className={cn(
             "text-[9px] font-black uppercase tracking-[0.2em] mb-1 px-2 py-0.5 rounded-full border",
             isOn ? "bg-primary/20 border-primary/30 text-primary" : "bg-muted/50 border-border/40 text-muted-foreground/40"
           )}>
             {isOn ? t('device_states.on') : t('device_states.off')}
           </span>
        </div>
      </div>

      <div className="space-y-1">
        <h4 className="text-lg font-black tracking-tight text-foreground truncate">{config.appearance.title || device.name}</h4>
        <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">{device.type}</p>
      </div>

      <button
        onClick={handleToggle}
        disabled={isProcessing}
        className={cn(
          "absolute bottom-6 right-6 w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-xl",
          isOn 
            ? "bg-primary text-primary-foreground shadow-primary/30 hover:scale-105 active:scale-95" 
            : "bg-muted text-muted-foreground/30 hover:bg-muted-foreground/10 hover:text-muted-foreground shadow-depth-1 active:scale-95"
        )}
      >
        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Power className="w-5 h-5" />}
      </button>
    </div>
  );
}
