import type { FormEvent } from 'react';
import type { TFunction } from 'i18next';
import { CheckCircle2, Layers3, Loader2, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { Input, SearchInput } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { cn } from '../../lib/utils';
import type { TopologyRoom } from './topologyPresentation';
import type { SnapshotDevice } from '../../stores/useDeviceSnapshotStore';
import { TopologyDeviceTile } from './TopologyDeviceTile';

interface TopologyRoomDetailPanelProps {
  room: TopologyRoom;
  devices: SnapshotDevice[];
  visibleDevices: SnapshotDevice[];
  activeLightCount: number;
  canManage: boolean;
  editing: boolean;
  draft: string;
  renameError: string;
  isRenaming: boolean;
  deviceSearch: string;
  isDeleting: boolean;
  t: TFunction;
  onDraftChange: (value: string) => void;
  onRename: (event: FormEvent) => void;
  onStartRename: () => void;
  onCancelRename: () => void;
  onClose: () => void;
  onDeviceSearchChange: (value: string) => void;
  onDeviceCommand: (deviceId: string, command: string, params?: Record<string, unknown>) => Promise<SnapshotDevice | null>;
  onDelete: () => void;
}

/** Presents one room; data updates and permission checks remain with the parent. */
export function TopologyRoomDetailPanel({
  room, devices, visibleDevices, activeLightCount, canManage, editing, draft,
  renameError, isRenaming, deviceSearch, isDeleting, t,
  onDraftChange, onRename, onStartRename, onCancelRename, onClose,
  onDeviceSearchChange, onDeviceCommand, onDelete,
}: TopologyRoomDetailPanelProps) {
  return (
    <aside aria-label={t('topology.room_details')} className="min-w-0 self-start rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-40">
          {editing ? (
            <form className="mt-2 flex items-center gap-2" onSubmit={onRename}>
              <Input
                autoFocus
                containerClassName="min-w-0 flex-1"
                className="rounded-xl border-primary/40 px-3 py-2 text-body font-bold ring-2 ring-primary/10"
                maxLength={80}
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                aria-label={t('topology.rename_room_title')}
              />
              <IconButton
                icon={isRenaming ? Loader2 : CheckCircle2}
                label={t('topology.rename_room_save')}
                type="submit"
                disabled={isRenaming || !draft.trim()}
                variant="primary"
                size="md"
                className={cn('h-10 w-10', isRenaming && '[&_svg]:animate-spin')}
              />
              <IconButton
                icon={X}
                label={t('common.cancel')}
                onClick={onCancelRename}
                disabled={isRenaming}
                variant="default"
                size="md"
                className="h-10 w-10"
              />
            </form>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <h4 className="min-w-0 break-words text-section-title font-black tracking-tight text-foreground">
                {room.name}
              </h4>
              {canManage && (
                <IconButton
                  icon={Pencil}
                  label={t('topology.rename_room')}
                  onClick={onStartRename}
                  variant="default"
                  size="sm"
                  className="h-8 w-8 rounded-lg hover:border-primary/30 hover:text-primary"
                />
              )}
            </div>
          )}
          {renameError && <p className="mt-2 text-caption font-semibold text-danger">{renameError}</p>}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <Layers3 className="h-5 w-5" />
          </div>
          <IconButton
            icon={X}
            label={t('topology.close_details')}
            onClick={onClose}
            variant="default"
            size="md"
            className="h-9 w-9 rounded-xl hover:text-foreground"
          />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
        <span>{t('topology.room_device_count', { count: devices.length })}</span>
        <span>{t('topology.active_device_count', { count: activeLightCount })}</span>
      </div>

      <div className="mt-5 border-t border-border/50 pt-5">
        <p className="mb-3 text-micro font-black uppercase tracking-widest text-muted-foreground/50">
          {t('topology.devices_in_room')}
        </p>
        {devices.length === 0 ? (
          <EmptyState variant="collection" icon={Layers3} title={t('topology.no_devices_in_room')} description={t('topology.assign_devices_hint')} />
        ) : (
          <div className="flex flex-col gap-3">
            <SearchInput
              value={deviceSearch}
              onChange={(event) => onDeviceSearchChange(event.target.value)}
              placeholder={t('topology.search_devices')}
              aria-label={t('topology.search_devices')}
            />
            <div className="homepilot-room-devices grid grid-cols-[repeat(auto-fill,minmax(min(100%,8.5rem),1fr))] items-start gap-3">
              {visibleDevices.length === 0 && (
                <p className="col-span-full text-body text-muted-foreground">
                  {t('topology.no_device_search_results')}
                </p>
              )}
              {visibleDevices.map((device) => (
                <TopologyDeviceTile
                  key={device.id}
                  device={device}
                  roomName={room.name}
                  onCommand={onDeviceCommand}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {canManage && (
        <Button
          onClick={onDelete}
          disabled={isDeleting}
          variant="ghost"
          size="md"
          className="mt-5 w-full border border-danger/20 bg-danger/5 text-danger hover:bg-danger/10 hover:text-danger sm:w-auto"
        >
          <Trash2 className="h-4 w-4" />
          {t('topology.delete_room')}
        </Button>
      )}
    </aside>
  );
}
