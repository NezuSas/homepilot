import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { API_ENDPOINTS } from '../config';
import { apiFetch } from '../lib/apiClient';
import type { AssistantFindingAction } from '../stores/useAssistantStore';
import { AlertBanner } from './ui/AlertBanner';
import { Button } from './ui/Button';
import { StatusPill } from './ui/StatusPill';
import { SelectableOptionCard } from './ui/SelectableOptionCard';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';

interface AssistantActionModalProps {
  findingId: string;
  action: AssistantFindingAction;
  deviceName?: string;
  onClose: () => void;
  onSuccess: () => void;
}

function getPayloadText(payload: Record<string, unknown> | undefined, key: string): string {
  const value = payload?.[key];
  return typeof value === 'string' ? value : '';
}

export const AssistantActionModal: React.FC<AssistantActionModalProps> = ({
  findingId,
  action,
  deviceName,
  onClose,
  onSuccess
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState<{ id: string; name: string }[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [newName, setNewName] = useState(getPayloadText(action.payload, 'currentName'));

  useEffect(() => {
    if (action.type === 'assign_room') {
      apiFetch(API_ENDPOINTS.topology.rooms)
        .then(res => res.json())
        .then(data => { if (Array.isArray(data)) setRooms(data); })
        .catch(console.error);
    }
  }, [action.type]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload: Record<string, string> = {};
      if (action.type === 'assign_room') payload.roomId = selectedRoomId;
      if (action.type === 'rename_device') payload.newName = newName;
      if (action.type === 'activate_draft') payload.draftId = getPayloadText(action.payload, 'draftId');

      const resp = await apiFetch(API_ENDPOINTS.assistant.executeAction, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          findingId,
          actionType: action.type,
          payload
        })
      });

      if (resp.ok) {
        onSuccess();
        onClose();
      }
    } catch (e) {
      console.error('[Assistant] Action failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={loading ? undefined : onClose}
      title={t(action.label)}
      description={deviceName}
      headerAlign="start"
      headerClassName="pb-4"
      className="max-w-md"
      hideCloseButton={loading}
      footer={(
        <div className="grid w-full grid-cols-1 gap-3 p-5 min-[380px]:grid-cols-2 sm:p-6">
          <Button
            disabled={loading}
            onClick={onClose}
            variant="ghost"
            className="w-full"
          >
            {t('common.cancel')}
          </Button>
          <Button
            disabled={(action.type === 'assign_room' && !selectedRoomId) || (action.type === 'rename_device' && !newName)}
            onClick={handleSubmit}
            isLoading={loading}
            className="w-full"
          >
            {!loading && <ChevronRight className="h-4 w-4" />}
            {t('common.confirm')}
          </Button>
        </div>
      )}
    >
      <div className="space-y-6">
          {action.type === 'assign_room' && (
            <div className="space-y-3">
              <label className="text-caption font-black uppercase tracking-widest text-muted-foreground">
                {t('topology.room_select')}
              </label>
              <div role="radiogroup" aria-label={t('topology.room_select')} className="grid gap-2 max-h-picker overflow-y-auto pr-2 custom-scrollbar">
                {rooms.map(room => (
                  <SelectableOptionCard
                    key={room.id}
                    type="button"
                    checked={selectedRoomId === room.id}
                    title={room.name}
                    onClick={() => setSelectedRoomId(room.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {action.type === 'rename_device' && (
            <Input
                label={t('devices.new_name')}
                autoFocus
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder={t('devices.name_placeholder')}
              />
          )}

          {action.type === 'import_device' && (
            <div className="py-4 text-center space-y-3">
              <p className="text-body font-medium text-muted-foreground leading-relaxed">
                {t('assistant.actions.import_confirm')}
              </p>
              <StatusPill variant="primary" size="lg" className="px-4 py-2">
                {deviceName}
              </StatusPill>
            </div>
          )}

          {action.type === 'activate_draft' && (
            <AlertBanner
              variant="info"
              title={t('assistant.draft.ready')}
              message={t('assistant.draft.created_automatically')}
            />
          )}

      </div>
    </Modal>
  );
};
