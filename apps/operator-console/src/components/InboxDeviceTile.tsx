import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { isDeviceUnavailable } from '../lib/deviceAvailability';
import type { SnapshotDevice as Device, SnapshotRoom as Room } from '../stores/useDeviceSnapshotStore';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { SearchableSelectField } from './ui/SearchableSelectField';

interface InboxDeviceTileProps {
  device: Device;
  rooms: Room[];
  onUpdate?: (updated: Device) => void;
  onInspect?: () => void;
}

/** A pending configuration item, never an operational device control. */
export function InboxDeviceTile({ device, rooms, onUpdate, onInspect }: InboxDeviceTileProps) {
  const { t } = useTranslation();
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unavailable = isDeviceUnavailable(device);
  const handleAssign = async () => {
    if (!selectedRoomId || isProcessing || unavailable) return;
    setIsProcessing(true);
    setError(null);
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/v1/devices/${device.id}/assign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: selectedRoomId }),
      });
      if (!response.ok) throw new Error(t('common.errors.operation_failed'));
      onUpdate?.(await response.json() as Device);
    } catch {
      setError(t('common.errors.operation_failed'));
    } finally {
      setIsProcessing(false);
    }
  };
  return <article className="min-w-0 space-y-3 rounded-control border border-border bg-card p-3">
    <div className="flex items-center gap-3">
      <h4 className="min-w-0 flex-1 break-words text-body-compact font-semibold">{device.name}</h4>
      {onInspect && <IconButton icon={Settings2} size="lg" label={`${t('inbox.manage_device')}: ${device.name}`} onClick={onInspect} />}
    </div>
    <div className="flex min-w-0 items-center gap-2">
      <SearchableSelectField value={selectedRoomId} onChange={setSelectedRoomId}
        options={rooms.map(room => ({ value: room.id, label: room.name }))}
        placeholder={t('common.unassigned')}
        disabled={isProcessing || unavailable} className="min-w-0 flex-1" />
      <Button onClick={() => { void handleAssign(); }} size="lg" disabled={!selectedRoomId || isProcessing || unavailable} isLoading={isProcessing}>
        {t('common.save')}
      </Button>
    </div>
    {error && <p role="alert" className="text-caption text-danger">{error}</p>}
  </article>;
}
