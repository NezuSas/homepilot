import { useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { assignDevicesInOrder, type BulkAssignOutcome } from '../lib/bulkAssign';
import { isDeviceUnavailable } from '../lib/deviceAvailability';
import type { SnapshotDevice as Device, SnapshotRoom as Room } from '../stores/useDeviceSnapshotStore';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { IconButton } from './ui/IconButton';
import { SearchableSelectField } from './ui/SearchableSelectField';

interface BulkAssignBarProps {
  devices: Device[];
  rooms: Room[];
  onUpdate: (updated: Device) => void;
  onFinished: (outcome: BulkAssignOutcome) => void;
}

/** One room for every pending device in the list, so a new installation is not assigned one tile at a time. */
export function BulkAssignBar({ devices, rooms, onUpdate, onFinished }: BulkAssignBarProps) {
  const { t } = useTranslation();
  const [roomId, setRoomId] = useState('');
  const [running, setRunning] = useState(false);
  const assignable = devices.filter(device => !isDeviceUnavailable(device));

  const assignAll = async () => {
    if (!roomId || running || assignable.length === 0) return;
    setRunning(true);
    try {
      onFinished(await assignDevicesInOrder(devices, device => !isDeviceUnavailable(device), async device => {
        const response = await apiFetch(`${API_BASE_URL}/api/v1/devices/${device.id}/assign`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId }),
        });
        if (!response.ok) return false;
        onUpdate(await response.json() as Device);
        return true;
      }));
    } finally {
      setRunning(false);
    }
  };

  return <Card variant="flat" as="section" aria-label={t('inbox.bulk.title')} className="space-y-3 p-3 sm:p-4">
    <div>
      <p className="text-body-compact font-semibold">{t('inbox.bulk.title')}</p>
      <p className="text-caption text-muted-foreground">{t('inbox.bulk.hint')}</p>
    </div>
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
      <SearchableSelectField value={roomId} onChange={setRoomId} options={rooms.map(room => ({ value: room.id, label: room.name }))}
        placeholder={t('inbox.choose_room')} disabled={running} className="min-w-0 flex-1" />
      <Button size="lg" onClick={() => { void assignAll(); }} disabled={!roomId || assignable.length === 0} isLoading={running}>
        {running ? t('inbox.bulk.running') : t('inbox.bulk.button', { count: assignable.length })}
      </Button>
    </div>
  </Card>;
}

/** What the last bulk assignment did; it outlives the bar, which disappears once nothing is left to assign. */
export function BulkAssignSummary({ outcome, onDismiss }: { outcome: BulkAssignOutcome; onDismiss: () => void }) {
  const { t } = useTranslation();
  return <Card variant="flat" as="div" role="status" className="flex items-start gap-3 p-3 sm:p-4">
    <div className="min-w-0 flex-1 space-y-1 text-caption">
      {outcome.assigned > 0 && <p className="font-semibold text-foreground">{t('inbox.bulk.done', { count: outcome.assigned })}</p>}
      {outcome.skipped > 0 && <p className="text-muted-foreground">{t('inbox.bulk.skipped', { count: outcome.skipped })}</p>}
      {outcome.failed > 0 && <p className="text-danger">{t('inbox.bulk.failed', { count: outcome.failed })}</p>}
    </div>
    <IconButton icon={X} size="lg" label={t('common.close')} onClick={onDismiss} />
  </Card>;
}
