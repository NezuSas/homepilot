import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Check, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { API_ENDPOINTS } from '../config';
import { apiFetch } from '../lib/apiClient';
import type { AssistantFindingAction } from '../stores/useAssistantStore';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { Input } from './ui/Input';

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

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-background/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-card border border-muted rounded-modal shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <header className="p-6 border-b border-muted">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-panel-title font-black tracking-tight">{t(action.label)}</h2>
            <IconButton icon={X} label={t('common.close')} onClick={onClose} variant="ghost" size="md" className="rounded-full" />
          </div>
          {deviceName && (
            <p className="text-micro font-bold text-muted-foreground uppercase tracking-label px-1">
              {deviceName}
            </p>
          )}
        </header>

        <div className="p-8 space-y-6">
          {action.type === 'assign_room' && (
            <div className="space-y-3">
              <label className="text-caption font-black uppercase tracking-widest text-muted-foreground">
                {t('topology.room_select')}
              </label>
              <div className="grid gap-2 max-h-picker overflow-y-auto pr-2 custom-scrollbar">
                {rooms.map(room => (
                  <Button
                    key={room.id}
                    variant="outline"
                    size="md"
                    onClick={() => setSelectedRoomId(room.id)}
                    className={cn(
                      "w-full justify-between min-h-14 rounded-2xl p-4 font-bold text-body",
                      selectedRoomId === room.id 
                        ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]" 
                        : "bg-muted/30 border-muted hover:border-primary/40"
                    )}
                  >
                    {room.name}
                    {selectedRoomId === room.id && <Check className="w-4 h-4" />}
                  </Button>
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
                className="h-14 rounded-2xl bg-muted/50 px-5 font-bold"
              />
          )}

          {action.type === 'import_device' && (
            <div className="py-4 text-center space-y-3">
              <p className="text-body font-medium text-muted-foreground leading-relaxed">
                {t('assistant.actions.import_confirm')}
              </p>
              <div className="inline-block px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold text-caption">
                {deviceName}
              </div>
            </div>
          )}

          {action.type === 'activate_draft' && (
            <div className="p-6 rounded-3xl bg-primary/5 border-2 border-primary/10 text-center space-y-2">
              <p className="text-primary font-black uppercase tracking-widest text-micro">
                {t('assistant.draft.ready')}
              </p>
              <p className="text-muted-foreground text-body font-medium leading-relaxed">
                {t('assistant.draft.created_automatically')}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              onClick={onClose}
              variant="ghost"
              className="flex-1 rounded-2xl py-4 font-black uppercase tracking-wider text-caption"
            >
              {t('common.cancel')}
            </Button>
            <Button
              disabled={(action.type === 'assign_room' && !selectedRoomId) || (action.type === 'rename_device' && !newName)}
              onClick={handleSubmit}
              isLoading={loading}
              className="flex-1 rounded-2xl py-4 font-black uppercase tracking-wider text-caption shadow-xl shadow-primary/20"
            >
              {!loading && <ChevronRight className="w-4 h-4" />}
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
