import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import { useDeviceSnapshotStore } from '../../../stores/useDeviceSnapshotStore';
import type { DashboardWidgetConfig } from '../types';
import { Power, Lightbulb, Cpu, Loader2, Tv, Fan, Speaker, Zap, Flame, Droplets, Thermometer, Wind, Monitor, Music, Shield, Lock, Unlock } from 'lucide-react';
import { apiFetch } from '../../../lib/apiClient';
import { API_BASE_URL } from '../../../config';
import { isDeviceActive } from '../dashboardUtils';
import { DormantWidgetPlaceholder } from '../components/DormantWidgetPlaceholder';
import { CameraDeviceTile } from '../../../components/CameraDeviceTile';

const API = `${API_BASE_URL}/api/v1`;

const ICON_MAP: Record<string, React.ElementType> = {
  power: Power,
  lightbulb: Lightbulb,
  light: Lightbulb,
  cpu: Cpu,
  tv: Tv,
  fan: Fan,
  speaker: Speaker,
  zap: Zap,
  flame: Flame,
  droplets: Droplets,
  thermometer: Thermometer,
  wind: Wind,
  monitor: Monitor,
  music: Music,
  shield: Shield,
  lock: Lock,
  unlock: Unlock
};

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

  if (device.type === 'camera') {
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

  const getIcon = () => {
    if (config.appearance.icon) {
      const searchKey = config.appearance.icon.toLowerCase().replace('mdi:', '').replace(/[^a-z]/g, '');
      const match = Object.keys(ICON_MAP).find(k => searchKey.includes(k) || k.includes(searchKey));
      if (match) return ICON_MAP[match];
    }
    switch (device.type) {
      case 'light': return Lightbulb;
      case 'switch': return Power;
      default: return Power;
    }
  };
  
  const IconComponent = getIcon();

  return (
    <button
      className={cn(
        "relative h-full w-full flex flex-col items-center justify-center p-2 sm:p-3 transition-all duration-300 select-none group focus:outline-none",
        isOn && "bg-primary/5"
      )}
      onClick={handleToggle}
      disabled={isProcessing}
    >
      <div className={cn(
        "flex-1 flex items-center justify-center transition-all duration-300",
        isOn 
          ? device.type === 'light' 
            ? "text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)] scale-110" 
            : "text-primary drop-shadow-[0_0_12px_rgba(var(--primary),0.5)] scale-110"
          : "text-muted-foreground/50 scale-100 group-hover:text-muted-foreground/70"
      )}>
        <IconComponent className="w-[40%] h-[40%] max-w-[4rem] max-h-[4rem]" />
      </div>
      <div className="w-full text-center mt-auto pb-1">
        <h4 className={cn(
          "text-[clamp(0.7rem,2.8cqi,1rem)] font-bold tracking-tight leading-tight truncate px-1",
          isOn ? "text-foreground" : "text-muted-foreground/80"
        )}>
          {config.appearance.title || device.name}
        </h4>
      </div>

      {/* Loading state overlay */}
      {isProcessing && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] flex items-center justify-center rounded-[inherit] z-10">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}
    </button>
  );
}
