import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Blinds,
  Box,
  Cpu,
  Loader2,
  RadioTower,
  RefreshCw,
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { cn } from '../lib/utils';
import type { SnapshotDevice as Device, SnapshotRoom as Room } from '../stores/useDeviceSnapshotStore';
import { Button } from './ui/Button';
import { SelectField } from './ui/SelectField';

interface DeviceState {
  on?: boolean;
  state?: 'on' | 'off';
  brightness?: number;
  power?: number;
  [key: string]: unknown;
}

interface InboxDeviceTileProps {
  device: Device;
  rooms: Room[];
  onUpdate?: (updated: Device) => void;
  onInspect?: () => void;
  hideControls?: boolean;
}

const API_URL = `${API_BASE_URL}/api/v1`;

/**
 * Appliance-style compact device tile for inbox and device manager lists.
 */
export const InboxDeviceTile: React.FC<InboxDeviceTileProps> = ({
  device,
  rooms,
  onUpdate,
  onInspect,
  hideControls,
}) => {
  const { t } = useTranslation();
  const isAssigned = device.status === 'ASSIGNED';
  const isPending = device.status === 'PENDING';
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState('');

  const lastState = (device.lastKnownState || {}) as DeviceState;
  const isOn = lastState.on === true
    || lastState.state === 'on'
    || Number(lastState.brightness) > 0
    || Number(lastState.power) > 0;

  const supportsCommands = device.type === 'light' || device.type === 'switch' || device.type === 'cover';

  const isSonoff = device.integrationSource === 'sonoff';
  const isOnline = Date.now() - new Date(device.updatedAt || new Date()).getTime() < 300000;

  useEffect(() => {
    if (isPending && rooms.length > 0 && !selectedRoomId) {
      setSelectedRoomId(rooms[0].id);
    }
  }, [rooms, isPending, selectedRoomId]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isProcessing || !supportsCommands) return;

    setIsProcessing(true);
    setError(null);
    try {
      const command = isOn ? 'turn_off' : 'turn_on';
      const res = await apiFetch(`${API_URL}/devices/${device.id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      if (res.ok && onUpdate) {
        onUpdate(await res.json());
      } else {
        const data = await res.json();
        setError(data?.error?.message || t('common.errors.operation_failed'));
      }
    } catch {
      setError(t('common.errors.connection_error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAssign = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedRoomId || isProcessing) return;
    setIsProcessing(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_URL}/devices/${device.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: selectedRoomId }),
      });
      if (res.ok && onUpdate) {
        onUpdate(await res.json());
      } else {
        setError(t('common.errors.operation_failed'));
      }
    } catch {
      setError(t('common.errors.connection_error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const Icon = device.type === 'light'
    ? RadioTower
    : (device.type === 'switch' ? Box : (device.type === 'cover' ? Blinds : Cpu));

  return (
    <div
      onClick={onInspect}
      className={cn(
        'relative group cursor-pointer transition-all duration-500',
        'aspect-square min-w-[140px] p-4 rounded-2xl flex flex-col justify-between border-2 hover:-translate-y-1 hover:shadow-xl',
        'bg-card hover:border-border',
        isOn && isAssigned ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10 hover:shadow-primary/20' : 'border-border shadow-md',
        (!isAssigned && isSonoff) ? 'border-success/30 bg-success/5 shadow-lg shadow-success/10 animate-in fade-in zoom-in-95 duration-700' : '',
        isProcessing && 'opacity-70 scale-[0.98] bg-muted/50 hover:translate-y-0 hover:shadow-none',
        error && 'border-destructive/40 bg-destructive/5 hover:translate-y-0',
      )}
    >
      <div className="flex justify-between items-start">
        <div className={cn(
          'p-2.5 rounded-xl transition-all duration-300',
          isOn && isAssigned ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'bg-muted text-muted-foreground',
          isProcessing && 'animate-pulse',
        )}>
          <Icon className="w-5 h-5" />
        </div>

        {supportsCommands && isAssigned && !hideControls && (
          <button
            onClick={handleToggle}
            disabled={isProcessing}
            className={cn(
              'p-2 rounded-full border-2 transition-all flex items-center justify-center',
              isOn ? 'bg-primary border-primary text-primary-foreground shadow-md' : 'bg-background border-border text-muted-foreground hover:border-primary/50',
              isProcessing && 'bg-muted border-primary/20',
            )}
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className={cn('w-4 h-4', isOn && 'rotate-180')} />}
          </button>
        )}
      </div>

      {error && !isProcessing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-destructive/10 backdrop-blur-[1px] rounded-2xl p-2 text-center">
          <AlertCircle className="w-5 h-5 text-destructive mb-1" />
          <span className="text-micro font-black uppercase text-destructive leading-tight">{error}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setError(null); }}
            className="mt-1 text-micro font-black uppercase text-muted-foreground border-b border-muted-foreground/30"
          >
            {t('common.cancel')}
          </button>
        </div>
      )}

      <div className={cn('flex flex-col gap-1 overflow-hidden transition-opacity', (isProcessing || error) && 'opacity-30')}>
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-caption font-black uppercase tracking-tighter truncate opacity-60">{device.type}</span>
          {isSonoff && (
            <span className="text-micro font-black uppercase tracking-[0.1em] bg-success/20 text-success border border-success/30 px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.1)] shrink-0">{t('inbox.native_local')}</span>
          )}
        </div>
        <h4 className="text-card-title font-bold truncate">{device.name}</h4>
        {!isAssigned && isSonoff && (
          <span className="text-micro font-black uppercase tracking-widest text-success/70 mt-0.5 animate-pulse">
            {t('inbox.discovered_locally')}
          </span>
        )}

        {isAssigned ? (
          <div className="flex items-center gap-1.5 mt-1">
            <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', isOn ? 'bg-primary animate-pulse' : 'bg-muted-foreground/30')} />
            <span className={cn('text-label font-black uppercase tracking-widest min-w-0 truncate', isOn ? 'text-primary' : 'text-muted-foreground')}>
              {isOn ? t('device_states.on') : t('device_states.off')}
            </span>
            {isSonoff && (
              <>
                <span className="w-1 h-1 bg-border rounded-full shrink-0" />
                <span className={cn('text-micro font-black uppercase tracking-widest shrink-0', isOnline ? 'text-success' : 'text-destructive opacity-80')}>
                  {isOnline ? t('common.online') : t('common.offline')}
                </span>
              </>
            )}
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            <SelectField
              variant="small"
              fullWidth
              disabled={isProcessing}
              value={selectedRoomId}
              onChange={setSelectedRoomId}
              options={Array.isArray(rooms) ? rooms.map((room) => ({ value: room.id, label: room.name })) : []}
              placeholder={t('common.unassigned')}
              className="mt-1"
            />
            <Button
              size="sm"
              onClick={handleAssign}
              disabled={!selectedRoomId || isProcessing}
              className={cn(
                'w-full text-label py-1 h-auto font-black uppercase tracking-widest shadow-sm transition-all',
                isSonoff ? 'bg-success text-success-foreground hover:bg-success/90 shadow-success/10' : '',
              )}
              isLoading={isProcessing}
            >
              {t('common.save')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
