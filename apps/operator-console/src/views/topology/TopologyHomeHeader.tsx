import React, { useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle2, Pencil, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { ActionMenu } from '../../components/ui/ActionMenu';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { Input } from '../../components/ui/Input';
import type { TopologyHome as Home } from './topologyPresentation';

interface TopologyHomeHeaderProps {
  home: Home;
  roomCount: number;
  canManage: boolean;
  editing: boolean;
  nameDraft: string;
  isRenaming: boolean;
  newRoomName: string;
  isCreatingRoom: boolean;
  onNameDraftChange: (name: string) => void;
  onBeginRename: () => void;
  onCancelRename: () => void;
  onRename: (event: React.FormEvent) => void;
  onNewRoomNameChange: (name: string) => void;
  onAddRoom: () => void;
}

/**
 * A quiet line with the home's name and how many spaces it has, and the one action people come here for:
 * adding a space. Renaming the home is rare, so it lives in a menu instead of sitting next to the title.
 */
export const TopologyHomeHeader: React.FC<TopologyHomeHeaderProps> = ({
  home, roomCount, canManage, editing, nameDraft, isRenaming, newRoomName, isCreatingRoom,
  onNameDraftChange, onBeginRename, onCancelRename, onRename, onNewRoomNameChange, onAddRoom,
}) => {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const wasCreating = useRef(false);

  // The form closes once a space was created (the name is cleared on success); a failure keeps it open.
  useEffect(() => {
    if (wasCreating.current && !isCreatingRoom && newRoomName === '') setAdding(false);
    wasCreating.current = isCreatingRoom;
  }, [isCreatingRoom, newRoomName]);

  const closeAdding = () => { onNewRoomNameChange(''); setAdding(false); };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {editing ? (
          <form className="flex items-center gap-2" onSubmit={onRename}>
            <Input
              autoFocus
              value={nameDraft}
              onChange={(event) => onNameDraftChange(event.target.value)}
              containerClassName="min-w-0 flex-1"
              aria-label={t('topology.rename_home')}
            />
            <IconButton
              icon={isRenaming ? Loader2 : CheckCircle2}
              label={t('common.save')}
              type="submit"
              disabled={isRenaming || !nameDraft.trim()}
              variant="primary"
              size="sm"
              className={cn('', isRenaming && '[&_svg]:animate-spin')}
            />
            <IconButton icon={X} label={t('common.cancel')} onClick={onCancelRename} disabled={isRenaming} variant="default" size="sm" />
          </form>
        ) : (
          <>
            <p className="min-w-0 truncate text-body-compact text-muted-foreground">
              <span className="font-semibold text-foreground">{home.name}</span> · {t('topology.room_count', { count: roomCount })}
            </p>
            {canManage && <ActionMenu label={t('topology.home_actions')} compact items={[{ label: t('topology.rename_home'), icon: Pencil, onSelect: onBeginRename }]} />}
          </>
        )}
      </div>
      {canManage && (adding ? (
        <form
          className="flex w-full items-center gap-2 sm:w-auto"
          onSubmit={(event) => { event.preventDefault(); onAddRoom(); }}
        >
          <Input
            autoFocus
            type="text"
            containerClassName="min-w-0 flex-1 sm:w-60"
            placeholder={t('topology.placeholder')}
            value={newRoomName}
            onChange={(event) => onNewRoomNameChange(event.target.value)}
            aria-label={t('topology.placeholder')}
          />
          <Button type="submit" disabled={isCreatingRoom || !newRoomName.trim()} isLoading={isCreatingRoom} size="md" className="shrink-0">
            {t('topology.create_room')}
          </Button>
          <IconButton icon={X} label={t('common.cancel')} onClick={closeAdding} disabled={isCreatingRoom} variant="default" size="md" />
        </form>
      ) : (
        <Button onClick={() => setAdding(true)} size="md" className="shrink-0">
          <Plus aria-hidden="true" className="size-4" />{t('topology.add_room')}
        </Button>
      ))}
    </div>
  );
};
