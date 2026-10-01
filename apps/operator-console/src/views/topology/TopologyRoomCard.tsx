import { CheckCircle2, Lightbulb } from 'lucide-react';
import type { TFunction } from 'i18next';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/utils';
import type { TopologyDevice, TopologyRoom } from './topologyPresentation';
import { isActiveTopologyDevice, isTopologyLight } from './topologyPresentation';

interface TopologyRoomCardProps {
  room: TopologyRoom;
  devices: TopologyDevice[];
  selected: boolean;
  t: TFunction;
  onSelect: () => void;
}

/** One selectable room summary, isolated from the topology coordinator. */
export function TopologyRoomCard({ room, devices, selected, t, onSelect }: TopologyRoomCardProps) {
  const roomDevices = devices.filter(device => device.roomId === room.id && device.status === 'ASSIGNED');
  const hasActiveLight = roomDevices.some(device => isTopologyLight(device) && isActiveTopologyDevice(device));

  return <Button
    type="button"
    variant="ghost"
    size="sm"
    onClick={onSelect}
    aria-pressed={selected}
    className={cn(
      'group h-auto min-h-20 self-start justify-start rounded-xl border bg-card p-3 text-left hover:border-primary/50',
      selected ? 'border-primary bg-primary/5 shadow-primary/10' : 'border-border',
    )}
  >
    <div className="flex items-center gap-3">
      <div className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors',
        hasActiveLight ? 'bg-warning/15 text-warning shadow-warning-soft' : selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary',
      )}>
        <Lightbulb className={cn('h-5 w-5', hasActiveLight && 'fill-current')} />
      </div>
      <div className="min-w-0 flex-1">
        <span className="block line-clamp-2 font-semibold text-foreground">{room.name}</span>
        <span className="text-micro font-black uppercase tracking-widest text-muted-foreground/50">
          {t('topology.room_device_count', { count: roomDevices.length })}
        </span>
      </div>
      {selected && <CheckCircle2 className="h-4 w-4 text-primary" />}
    </div>
  </Button>;
}
