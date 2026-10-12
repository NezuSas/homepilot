import type { FormEvent } from 'react';
import type { TFunction } from 'i18next';
import { CheckCircle2, Layers3, Loader2, Pencil, Trash2, X } from 'lucide-react';
import { IconButton } from '../../components/ui/IconButton';
import { Input, SearchInput } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Heading } from '../../components/ui/Heading';
import { cn } from '../../lib/utils';
import type { TopologyRoom } from './topologyPresentation';
import type { SnapshotDevice } from '../../stores/useDeviceSnapshotStore';
import { TopologyDeviceTile } from './TopologyDeviceTile';
import { RoomIcon } from './RoomIcon';
import { RoomSummaryLine } from './RoomSummaryLine';
import { buildRoomSummary, roomIconKey } from './roomSummaryModel';
import { getRoomDeviceGroup, type RoomDeviceGroup } from './topologyDeviceControl';

/** A search box for a handful of devices is noise; it appears when scanning starts to cost. */
export const ROOM_DEVICE_SEARCH_THRESHOLD = 8;

interface TopologyRoomDetailPanelProps {
  room: TopologyRoom;
  devices: SnapshotDevice[];
  visibleDevices: SnapshotDevice[];
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

/** Presents one space; data updates and permission checks remain with the parent. */
export function TopologyRoomDetailPanel({
  room, devices, visibleDevices, canManage, editing, draft,
  renameError, isRenaming, deviceSearch, isDeleting, t,
  onDraftChange, onRename, onStartRename, onCancelRename, onClose,
  onDeviceSearchChange, onDeviceCommand, onDelete,
}: TopologyRoomDetailPanelProps) {
  const deviceGroups = new Map<RoomDeviceGroup, SnapshotDevice[]>();
  for (const device of visibleDevices) {
    const kind = getRoomDeviceGroup(device);
    const group = deviceGroups.get(kind) ?? [];
    group.push(device);
    deviceGroups.set(kind, group);
  }
  const summary = buildRoomSummary(devices);
  const groupLabel = (kind: RoomDeviceGroup) => t(kind === 'media_player' ? 'device_types.media_player'
    : kind === 'other' ? 'device_types.none' : kind === 'action' ? 'topology.group_action' : `inbox.filters.${kind}`);
  return (
    <aside aria-label={t('topology.room_details')} data-room-detail="" className="min-w-0 self-start rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <RoomIcon iconKey={roomIconKey(summary)} className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            {editing ? (
              <form className="flex items-center gap-2" onSubmit={onRename}>
                <Input
                  autoFocus
                  containerClassName="min-w-0 flex-1"
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
                  className={cn('', isRenaming && '[&_svg]:animate-spin')}
                />
                <IconButton icon={X} label={t('common.cancel')} onClick={onCancelRename} disabled={isRenaming} variant="default" size="md" />
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <Heading variant="section" as="h4" className="text-foreground">{room.name}</Heading>
                {canManage && (
                  <IconButton
                    icon={Pencil}
                    label={t('topology.rename_room')}
                    onClick={onStartRename}
                    variant="default"
                    size="sm"
                    className="hover:border-primary/30 hover:text-primary"
                  />
                )}
              </div>
            )}
            {renameError && <p className="mt-2 text-caption font-semibold text-danger">{renameError}</p>}
            <RoomSummaryLine summary={summary} className="mt-1" />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canManage && (
            <IconButton
              icon={Trash2}
              label={t('topology.delete_room')}
              onClick={onDelete}
              disabled={isDeleting}
              variant="default"
              size="md"
              className="hover:border-danger/30 hover:text-danger"
            />
          )}
          <IconButton icon={X} label={t('topology.close_details')} onClick={onClose} variant="default" size="md" className="hover:text-foreground" />
        </div>
      </div>

      <div className="mt-5 border-t border-border/50 pt-5">
        {devices.length === 0 ? (
          <EmptyState variant="collection" icon={Layers3} title={t('topology.no_devices_in_room')} description={t('topology.assign_devices_hint')} />
        ) : (
          <div className="flex flex-col gap-3">
            {devices.length >= ROOM_DEVICE_SEARCH_THRESHOLD && (
              <SearchInput
                value={deviceSearch}
                onChange={(event) => onDeviceSearchChange(event.target.value)}
                placeholder={t('topology.search_devices')}
                aria-label={t('topology.search_devices')}
              />
            )}
            <div className="homepilot-room-devices space-y-4">
              {visibleDevices.length === 0 && (
                <p className="col-span-full text-body text-muted-foreground">
                  {t('topology.no_device_search_results')}
                </p>
              )}
              {Array.from(deviceGroups, ([kind, group]) => (
                <section key={kind} aria-label={groupLabel(kind)} className="space-y-2">
                  <h5 className="text-caption font-medium text-muted-foreground">{groupLabel(kind)}</h5>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,8.5rem),1fr))] items-start gap-3">
                    {group.map((device) => (
                      <TopologyDeviceTile
                        key={device.id}
                        device={device}
                        roomName={room.name}
                        onCommand={onDeviceCommand}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
