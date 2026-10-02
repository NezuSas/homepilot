import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { apiFetch, readApiError } from '../lib/apiClient';
import { invalidateDiagnosticCatalog } from '../lib/diagnosticResourceRequests';
import { SearchableSelectField } from '../components/ui/SearchableSelectField';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { SceneDeviceSelector, type SceneDeviceAction } from '../components/SceneDeviceSelector';
import { RoutineSharingField } from '../components/RoutineSharingField';
import { IconPicker } from './dashboards/components/IconPicker';
import type { SnapshotDevice } from '../stores/useDeviceSnapshotStore';
import { getRoutineDeviceCommands, type RoutineDeviceCommand } from '../lib/deviceCapabilities';

const API_URL = `${API_BASE_URL}/api/v1`;
interface Room { id: string; name: string }
interface Scene {
  id: string;
  homeId: string;
  roomId: string | null;
  name: string;
  icon?: string;
  description?: string;
  sharedUserIds?: string[];
  actions: SceneDeviceAction[];
}
interface SceneBuilderModalProps {
  onClose: () => void;
  onSaved: () => void;
  homeId: string;
  rooms: Room[];
  devices: SnapshotDevice[];
  initialRoomId?: string | null;
  existingScene?: Scene | null;
}

export const SceneBuilderModal: React.FC<SceneBuilderModalProps> = ({ onClose, onSaved, homeId, rooms, devices, initialRoomId = null, existingScene }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(existingScene?.name || '');
  const [icon, setIcon] = useState(existingScene?.icon || '');
  const [description, setDescription] = useState(existingScene?.description || '');
  const [sharedUserIds, setSharedUserIds] = useState(existingScene?.sharedUserIds ?? []);
  const [roomId, setRoomId] = useState<string | null>(existingScene ? existingScene.roomId : initialRoomId);
  const [actions, setActions] = useState<SceneDeviceAction[]>(existingScene?.actions || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDevice = (deviceId: string) => {
    const exists = actions.find(action => action.deviceId === deviceId);
    if (exists) {
      setActions(actions.filter(action => action.deviceId !== deviceId));
    } else {
      const device = devices.find(candidate => candidate.id === deviceId);
      if (!device) return;
      const defaultCommand = getRoutineDeviceCommands(device)[0];
      if (defaultCommand) setActions([...actions, { deviceId, command: defaultCommand }]);
    }
  };
  const setCommand = (deviceId: string, command: RoutineDeviceCommand) => {
    setActions(actions.map(action => action.deviceId === deviceId ? { ...action, command } : action));
  };
  const handleSave = async () => {
    if (!name.trim()) return setError(t('scenes.builder.errors.no_name'));
    if (actions.length === 0) return setError(t('scenes.builder.errors.no_actions'));
    setSaving(true);
    setError(null);
    try {
      const payload = { homeId, roomId, name: name.trim(), icon: icon || undefined, description: description.trim(), actions, sharedUserIds };
      const url = existingScene ? `${API_URL}/scenes/${existingScene.id}` : `${API_URL}/scenes`;
      const res = await apiFetch(url, {
        method: existingScene ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await readApiError(res, t('scenes.builder.errors.sync_failed')));
      invalidateDiagnosticCatalog();
      onSaved();
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : t('common.errors.operation_failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={saving ? undefined : onClose}
      title={existingScene ? t('scenes.builder.title_edit') : t('scenes.builder.title_create')}
      description={t('scenes.builder.subtitle')}
      headerAlign="start"
      headerClassName="pb-3 sm:pb-4"
      contentClassName="pt-2 sm:pt-2"
      className="max-w-2xl"
      layerClassName="z-[200]"
      hideCloseButton={saving}
      footer={(
        <div className="flex w-full items-center justify-end gap-2 p-4 sm:px-6">
          <Button type="button" variant="ghost" size="lg" disabled={saving} onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="button" size="lg" disabled={!name.trim() || !actions.length || saving} onClick={handleSave} isLoading={saving}>
            {!saving && <Save aria-hidden="true" className="size-4" />}{t('scenes.builder.commit')}
          </Button>
        </div>
      )}
    >
      <div className="space-y-5">
        {error && <p role="alert" className="rounded-control bg-danger/10 p-3 text-caption text-danger">{error}</p>}
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label={t('routine_sharing.name')} value={name} onChange={event => setName(event.target.value)} placeholder={t('scenes.builder.placeholders.name')} className="h-11" autoFocus />
          <div className="space-y-1.5">
            <p className="text-micro font-semibold text-muted-foreground">{t('routine_sharing.space')}</p>
            <SearchableSelectField value={roomId || ''} onChange={value => { setRoomId(value || null); setActions([]); }} options={[
              { value: '', label: t('dashboard.scene_global') },
              ...rooms.map(room => ({ value: room.id, label: room.name })),
            ]} placeholder={t('dashboard.scene_global')} />
          </div>
        </div>
        <Input label={t('routine_sharing.description')} value={description} onChange={event => setDescription(event.target.value)} placeholder={t('scenes.builder.placeholders.description')} className="h-11" />
        <RoutineSharingField value={sharedUserIds} onChange={setSharedUserIds} />
        <IconPicker value={icon} onChange={setIcon} />
        <SceneDeviceSelector key={roomId ?? 'global'} devices={devices} rooms={rooms} roomId={roomId} actions={actions} onToggle={toggleDevice} onCommand={setCommand} />
      </div>
    </Modal>
  );
};
