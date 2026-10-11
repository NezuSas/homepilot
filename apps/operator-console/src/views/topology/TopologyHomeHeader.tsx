import React from 'react';
import { Home as HomeIcon, Loader2, CheckCircle2, Pencil, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Heading } from '../../components/ui/Heading';
import { IconButton } from '../../components/ui/IconButton';
import { Input } from '../../components/ui/Input';
import type { TopologyHome as Home } from './topologyPresentation';

interface TopologyHomeHeaderProps {
  home: Home;
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

/** Home title with inline rename and the new-room form for its owner. */
export const TopologyHomeHeader: React.FC<TopologyHomeHeaderProps> = ({
  home, canManage, editing, nameDraft, isRenaming, newRoomName, isCreatingRoom,
  onNameDraftChange, onBeginRename, onCancelRename, onRename, onNewRoomNameChange, onAddRoom,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4 border-b border-border/70 pb-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
          <HomeIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
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
              <IconButton
                icon={X}
                label={t('common.cancel')}
                onClick={onCancelRename}
                disabled={isRenaming}
                variant="default"
                size="sm"

              />
            </form>
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <Heading variant="section" className="truncate text-foreground">{home.name}</Heading>
              {canManage && (
                <IconButton
                  icon={Pencil}
                  label={t('topology.rename_home')}
                  onClick={onBeginRename}
                  variant="default"
                  size="sm"
                  className="shrink-0 hover:border-primary/30 hover:text-primary"
                />
              )}
            </div>
          )}
          <p className="mt-1 text-caption text-muted-foreground">{t('topology.home_workspace_description')}</p>
        </div>
      </div>
      {canManage && (
        <div className="flex w-full items-center gap-2 lg:w-auto">
          <Input
            type="text"
            containerClassName="min-w-0 flex-1 lg:w-60"
            placeholder={t('topology.placeholder')}
            value={newRoomName}
            onChange={(e) => onNewRoomNameChange(e.target.value)}
            aria-label={t('topology.placeholder')}
            onKeyDown={(e) => e.key === 'Enter' && onAddRoom()}
          />
          <Button
            onClick={onAddRoom}
            disabled={isCreatingRoom || !newRoomName.trim()}
            isLoading={isCreatingRoom}
            size="md"
            className="shrink-0"
          >
            {t('topology.add_room')}
          </Button>
        </div>
      )}
    </div>
  );
};
