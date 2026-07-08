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
      "relative h-full w-full min-h-0 flex flex-col p-4 @md:p-6 @lg:p-7 transition-all duration-700 overflow-hidden",
      onCount > 0 && "bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent"
    )}>
      <div className="flex items-center justify-between mb-3 @md:mb-6">
        <div className={cn(
          "w-10 h-10 @md:w-12 @md:h-12 rounded-2xl flex items-center justify-center border transition-all duration-500",
          onCount > 0 ? "bg-primary/10 border-primary/20 shadow-lg" : "bg-muted border-border/40"
        )}>
          <Home className={cn("w-5 h-5 @md:w-6 @md:h-6", onCount > 0 ? "text-primary" : "text-muted-foreground/30")} />
        </div>
        
        <div className="flex items-center gap-2">
           <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/30">{t('topology.room_select')}</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 space-y-3 @md:space-y-4">
        <div>
          <h4 className="text-base @md:text-xl font-black tracking-tight text-foreground truncate">{config.appearance.title || room.name}</h4>
          <div className="flex items-center gap-2 mt-1">
             <span className={cn(
               "text-[10px] font-black uppercase tracking-widest",
               onCount > 0 ? "text-primary" : "text-muted-foreground/40"
             )}>
               {onCount > 0 
                 ? t('dashboards.widgets.room_summary.active_count', { count: onCount }) 
                 : t('dashboards.widgets.room_summary.all_off')}
             </span>
             <div className="w-1 h-1 rounded-full bg-border" />
             <span className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-tight">
               {t('dashboards.widgets.room_summary.units', { count: roomDevices.length })}
             </span>
          </div>
        </div>

        {onCount > 0 && (
          <div className="flex flex-wrap gap-2">
             {activeTypes.map(type => (
               <div key={type} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/60 border border-border/40 backdrop-blur-md">
                  <span className="text-[9px] font-black uppercase tracking-tight text-muted-foreground/60">
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
          className="mt-6 flex items-center justify-center gap-2 w-full py-3 bg-destructive/5 hover:bg-destructive text-destructive hover:text-destructive-foreground rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 border border-destructive/20 hover:border-transparent active:scale-95"
        >
          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
          {t('dashboards.widgets.room_summary.turn_off_all')}
        </button>
      )}
    </div>
  );
}
