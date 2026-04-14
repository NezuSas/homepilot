import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Check, Loader2, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { API_ENDPOINTS } from '../config';

interface AssistantActionModalProps {
  findingId: string;
  action: {
    type: string;
    label: string;
    payload?: any;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export const AssistantActionModal: React.FC<AssistantActionModalProps> = ({
  findingId,
  action,
  onClose,
  onSuccess
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState<{ id: string; name: string }[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [newName, setNewName] = useState(action.payload?.currentName || '');

  useEffect(() => {
    if (action.type === 'assign_room') {
      fetch(API_ENDPOINTS.topology.rooms)
        .then(res => res.json())
        .then(data => setRooms(data))
        .catch(console.error);
    }
  }, [action.type]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload: any = {};
      if (action.type === 'assign_room') payload.roomId = selectedRoomId;
      if (action.type === 'rename_device') payload.newName = newName;
      if (action.type === 'activate_draft') payload.draftId = action.payload?.draftId;

      const resp = await fetch(API_ENDPOINTS.assistant.executeAction, {
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-background/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-card border border-muted rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <header className="flex items-center justify-between p-6 border-b border-muted">
          <h2 className="text-xl font-black tracking-tight">{t(action.label)}</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-8 space-y-6">
          {action.type === 'assign_room' && (
            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                {t('topology.room_select')}
              </label>
              <div className="grid gap-2 max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
                {rooms.map(room => (
                  <button
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-2xl border transition-all font-bold text-sm",
                      selectedRoomId === room.id 
                        ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]" 
                        : "bg-muted/30 border-muted hover:border-primary/40"
                    )}
                  >
                    {room.name}
                    {selectedRoomId === room.id && <Check className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {action.type === 'rename_device' && (
            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                {t('devices.new_name')}
              </label>
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder={t('devices.name_placeholder')}
                className="w-full bg-muted/50 border-2 border-muted focus:border-primary rounded-2xl px-5 py-4 font-bold outline-none transition-all"
              />
            </div>
          )}

          {action.type === 'import_device' && (
            <p className="text-muted-foreground font-medium text-center py-4">
              {t('assistant.actions.import_confirm')}
            </p>
          )}

          {action.type === 'activate_draft' && (
            <div className="p-6 rounded-3xl bg-primary/5 border-2 border-primary/10 text-center space-y-2">
              <p className="text-primary font-black uppercase tracking-widest text-[10px]">
                {t('assistant.draft.ready')}
              </p>
              <p className="text-muted-foreground text-sm font-medium leading-relaxed">
                {t('assistant.draft.created_automatically')}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button 
              onClick={onClose}
              className="flex-1 py-4 rounded-2xl font-black uppercase tracking-wider text-xs hover:bg-muted transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button 
              disabled={loading || (action.type === 'assign_room' && !selectedRoomId) || (action.type === 'rename_device' && !newName)}
              onClick={handleSubmit}
              className="flex-1 py-4 rounded-2xl bg-primary text-primary-foreground font-black uppercase tracking-wider text-xs hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              {t('common.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
