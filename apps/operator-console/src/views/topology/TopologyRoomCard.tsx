import { CheckCircle2 } from 'lucide-react';
import { SurfaceButton } from '../../components/ui/SurfaceButton';
import { cn } from '../../lib/utils';
import type { SnapshotDevice } from '../../stores/useDeviceSnapshotStore';
import type { TopologyRoom } from './topologyPresentation';
import { RoomIcon } from './RoomIcon';
import { RoomSummaryLine } from './RoomSummaryLine';
import { buildRoomSummary, roomIconKey } from './roomSummaryModel';
import { getAssignedRoomDevices } from './topologyViewModel';

interface TopologyRoomCardProps {
  room: TopologyRoom;
  devices: SnapshotDevice[];
  selected: boolean;
  onSelect: () => void;
}

/** One selectable space: an icon for what it holds, its name and how it is doing. */
export function TopologyRoomCard({ room, devices, selected, onSelect }: TopologyRoomCardProps) {
  const summary = buildRoomSummary(getAssignedRoomDevices(devices, room.id, room.homeId));
  const lit = summary.active > 0;

  return <SurfaceButton
    type="button"
    onClick={onSelect}
    aria-pressed={selected}
    className={cn(
      'group h-auto min-h-20 self-start justify-start rounded-xl border bg-card p-3 text-left hover:border-primary/50',
      selected ? 'border-primary bg-primary/5 shadow-primary/10' : 'border-border',
    )}
  >
    <div className="flex w-full items-center gap-3">
      <div className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors',
        lit ? 'bg-warning/15 text-warning shadow-warning-soft' : selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary',
      )}>
        <RoomIcon iconKey={roomIconKey(summary)} className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <span className="block line-clamp-2 font-semibold text-foreground">{room.name}</span>
        <RoomSummaryLine summary={summary} compact />
      </div>
      {selected && <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />}
    </div>
  </SurfaceButton>;
}

