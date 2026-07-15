import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import { useDeviceSnapshotStore } from '../../../stores/useDeviceSnapshotStore';
import type { DashboardWidgetConfig } from '../types';
import { Home, Power, Loader2 } from 'lucide-react';
import { apiFetch } from '../../../lib/apiClient';
import { API_BASE_URL } from '../../../config';
import { isDeviceActive, getDevicesInRoom } from '../dashboardUtils';
import { DormantWidgetPlaceholder } from '../components/DormantWidgetPlaceholder';

const API = `${API_BASE_URL}/api/v1`;

export function RoomWidget({ config, isEditing, onConfigure }: { config: DashboardWidgetConfig; isEditing: boolean; onConfigure?: () => void }) {
  const { t } = useTranslation();
  const { devices, roomsByHome } = useDeviceSnapshotStore();
  const rooms = Object.values(roomsByHome).flat();
  const roomId = config.binding.entityId;
  const room = rooms.find(r => r.id === roomId);
  const [isProcessing, setIsProcessing] = useState(false);

  const roomDevices = useMemo(() => getDevicesInRoom(devices, roomId), [devices, roomId]);
  const activeDevices = useMemo(() => roomDevices.filter(isDeviceActive), [roomDevices]);
  const onCount = activeDevices.length;
  
  const activeTypes = useMemo(() => {
    return Array.from(new Set(activeDevices.map(d => d.type)));
  }, [activeDevices]);

  if (!room) {
    return (
      <DormantWidgetPlaceholder
        title={t('dashboards.widgets.room_summary.label')}
        icon={Home}
        message={t('dashboards.widgets.room_summary.placeholder')}
        isEditing={isEditing}
        onConfigure={onConfigure}
        variant={config.appearance.variant}
      />
    );
  }

  const handleToggleAll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCount === 0) return;
    setIsProcessing(true);
    try {
      await Promise.all(activeDevices.map(d => 
        apiFetch(`${API}/devices/${d.id}/command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: 'turn_off' })
        })
      ));
    } catch (err) {
      console.error('Failed to toggle room devices:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={cn(
      "relative h-full w-full min-h-0 flex flex-col overflow-hidden rounded-section border border-border/60 bg-room-card p-4 text-foreground shadow-surface-card ring-1 ring-background/70 transition-all duration-700 dark:border-primary/20 dark:bg-room-card-dark dark:shadow-primary-room @md:p-6 @lg:p-7",
      onCount > 0 && "border-primary/35 ring-primary/10"
    )}>
      <div className="pointer-events-none absolute inset-0 bg-room-card-aura opacity-80 dark:opacity-100" />
      <div className="flex items-center justify-between mb-3 @md:mb-6">
        <div className={cn(
          "relative w-10 h-10 @md:w-12 @md:h-12 rounded-2xl flex items-center justify-center border transition-all duration-500",
          onCount > 0 ? "bg-primary/10 border-primary/30 shadow-primary-room-icon" : "bg-background/90 border-border/70 shadow-sm"
        )}>
          <Home className={cn("w-5 h-5 @md:w-6 @md:h-6", onCount > 0 ? "text-primary" : "text-muted-foreground")} />
        </div>
        
        <div className="flex items-center gap-2">
           <span className="relative rounded-full border border-border/65 bg-background/85 px-2.5 py-1 text-micro font-black uppercase tracking-label text-muted-foreground shadow-sm dark:bg-background/45">{t('topology.room_select')}</span>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 space-y-3 @md:space-y-4">
        <div>
          <h4 className="text-body-lg @md:text-panel-title font-black tracking-tight text-foreground truncate">{config.appearance.title || room.name}</h4>
          <div className="flex items-center gap-2 mt-1">
             <span className={cn(
               "text-micro font-black uppercase tracking-widest",
               onCount > 0 ? "text-primary" : "text-muted-foreground/40"
             )}>
               {onCount > 0 
                 ? t('dashboards.widgets.room_summary.active_count', { count: onCount }) 
                 : t('dashboards.widgets.room_summary.all_off')}
             </span>
             <div className="h-1 w-1 rounded-full bg-border" />
             <span className="text-micro font-bold text-muted-foreground/30 uppercase tracking-tight">
               {t('dashboards.widgets.room_summary.units', { count: roomDevices.length })}
             </span>
          </div>
        </div>

        {onCount > 0 && (
          <div className="flex flex-wrap gap-2">
             {activeTypes.map(type => (
               <div key={type} className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/85 px-3 py-1.5 shadow-sm backdrop-blur-md dark:bg-background/45">
                  <span className="text-micro font-black uppercase tracking-tight text-muted-foreground/60">
                    {t(`device_types.${type}`, { defaultValue: type })}
                  </span>
               </div>
             ))}
          </div>
        )}
      </div>

      {onCount > 0 && (
        <button
          onClick={handleToggleAll}
          disabled={isProcessing}
          className="relative mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 py-3 text-micro font-black uppercase tracking-label text-destructive transition-all duration-300 hover:border-transparent hover:bg-destructive hover:text-destructive-foreground active:scale-95"
        >
          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
          {t('dashboards.widgets.room_summary.turn_off_all')}
        </button>
      )}
    </div>
  );
}
