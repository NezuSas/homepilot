import type { FormEvent } from 'react';
import type { TFunction } from 'i18next';
import { CheckCircle2, Layers3, Loader2, Pencil, Power, Trash2, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { Input, SearchInput } from '../../components/ui/Input';
import { cn } from '../../lib/utils';
import {
  getTopologyDeviceTypeKey,
  isActiveTopologyDevice,
  type TopologyDevice,
  type TopologyRoom,
} from './topologyPresentation';

interface TopologyRoomDetailPanelProps {
  room: TopologyRoom;
  lights: TopologyDevice[];
  visibleLights: TopologyDevice[];
  activeLightCount: number;
  canManage: boolean;
  editing: boolean;
  draft: string;
  renameError: string;
  isRenaming: boolean;
  deviceSearch: string;
  processingDeviceId: string | null;
  isDeleting: boolean;
  t: TFunction;
  onDraftChange: (value: string) => void;
  onRename: (event: FormEvent) => void;
  onStartRename: () => void;
  onCancelRename: () => void;
  onClose: () => void;
  onDeviceSearchChange: (value: string) => void;
  onToggleDevice: (device: TopologyDevice) => void;
  onDelete: () => void;
}

/** Presents one room; data updates and permission checks remain with the parent. */
export function TopologyRoomDetailPanel({
  room, lights, visibleLights, activeLightCount, canManage, editing, draft,
  renameError, isRenaming, deviceSearch, processingDeviceId, isDeleting, t,
  onDraftChange, onRename, onStartRename, onCancelRename, onClose,
  onDeviceSearchChange, onToggleDevice, onDelete,
}: TopologyRoomDetailPanelProps) {
  return (
    <aside className="self-start rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-micro font-black uppercase tracking-widest text-muted-foreground/50">
            {t('topology.room_details')}
          </p>
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
        <div className="flex items-center gap-2">
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

      <div className="mt-4 grid max-w-md grid-cols-2 gap-3">
        <Metric label={t('topology.lights_total')} value={lights.length} />
        <Metric label={t('topology.lights_on')} value={activeLightCount} accent />
      </div>

      <div className="mt-5 border-t border-border/50 pt-5">
        <p className="mb-3 text-micro font-black uppercase tracking-widest text-muted-foreground/50">
          {t('topology.lights_in_room')}
        </p>
        {lights.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-muted/10 p-4 text-body font-medium text-muted-foreground">
            {t('topology.no_lights_in_room')}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <SearchInput
              value={deviceSearch}
              onChange={(event) => onDeviceSearchChange(event.target.value)}
              placeholder={t('topology.search_lights')}
              aria-label={t('topology.search_lights')}
            />
            <div className="grid max-h-topology-list grid-cols-1 gap-2 overflow-y-auto pr-1 custom-scrollbar sm:grid-cols-2 xl:grid-cols-3">
              {visibleLights.length === 0 && (
                <p className="rounded-2xl border border-dashed border-border bg-muted/10 p-4 text-body font-medium text-muted-foreground">
                  {t('topology.no_light_search_results')}
                </p>
              )}
              {visibleLights.map((device) => (
                <TopologyDeviceCard
                  key={device.id}
                  device={device}
                  processing={processingDeviceId !== null}
                  isProcessing={processingDeviceId === device.id}
                  t={t}
                  onToggle={() => onToggleDevice(device)}
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

function Metric({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
      <p className="text-micro font-black uppercase tracking-widest text-muted-foreground/50">{label}</p>
      <p className={cn('mt-1 text-view-title font-black', accent ? 'text-primary' : 'text-foreground')}>{value}</p>
    </div>
  );
}

interface TopologyDeviceCardProps {
  device: TopologyDevice;
  processing: boolean;
  isProcessing: boolean;
  t: TFunction;
  onToggle: () => void;
}

function TopologyDeviceCard({ device, processing, isProcessing, t, onToggle }: TopologyDeviceCardProps) {
  const active = isActiveTopologyDevice(device);
  return (
    <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_2rem] items-center gap-2">
        <div className="min-w-0">
          <p className="truncate text-body font-bold text-foreground">{device.name}</p>
          <p className="text-micro font-black uppercase tracking-widest text-muted-foreground/50">
            {t(`device_types.${getTopologyDeviceTypeKey(device)}`, { defaultValue: t('device_types.none') })}
          </p>
        </div>
        <span
          className={cn(
            'inline-flex h-4 w-16 max-w-full items-center justify-center rounded-full px-1 font-medium uppercase',
            active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
          )}
          style={{ fontSize: '0.625rem', lineHeight: 1, letterSpacing: '0' }}
        >
          {active ? t('device_states.on') : t('device_states.off')}
        </span>
        <IconButton
          icon={isProcessing ? Loader2 : Power}
          label={active ? t('topology.turn_off_device') : t('topology.turn_on_device')}
          onClick={onToggle}
          disabled={processing}
          variant={active ? 'primary' : 'default'}
          size="sm"
          className={cn(
            'h-8 w-8 rounded-xl',
            active ? 'border-primary/30' : 'bg-muted/30 hover:text-primary',
            isProcessing && '[&_svg]:animate-spin',
          )}
        />
      </div>
    </div>
  );
}
