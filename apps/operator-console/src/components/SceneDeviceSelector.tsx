import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Plus } from 'lucide-react';
import { Button } from './ui/Button';
import { SearchInput } from './ui/Input';
import { SearchableSelectField } from './ui/SearchableSelectField';
import { SegmentedControl } from './ui/SegmentedControl';
import { humanize } from '../lib/naming-utils';
import { getRoutineDeviceCommands, isCameraDevice, type RoutineDeviceCommand } from '../lib/deviceCapabilities';
import type { SnapshotDevice } from '../stores/useDeviceSnapshotStore';
import { isDeviceOperational } from '../lib/deviceOperationalEligibility';

export interface SceneDeviceAction {
  deviceId: string;
  command: RoutineDeviceCommand;
}
interface Room { id: string; name: string; homeId?: string }
interface Props {
  devices: SnapshotDevice[];
  rooms: Room[];
  roomId: string | null;
  actions: SceneDeviceAction[];
  onToggle: (id: string) => void;
  onCommand: (id: string, command: RoutineDeviceCommand) => void;
}

export function getSceneDeviceGroups(devices: SnapshotDevice[], rooms: Room[], actions: SceneDeviceAction[], roomId: string | null, search: string, spaceFilter = '', locale?: string) {
  const selectedIds = new Set(actions.map(action => action.deviceId));
  const roomMap = new Map(rooms.map(room => [room.id, room.name]));
  const compare = (a: SnapshotDevice, b: SnapshotDevice) => humanize(a.id, a.name).localeCompare(humanize(b.id, b.name), locale, { numeric: true, sensitivity: 'base' });
  const eligible = devices.filter(device => isDeviceOperational(device, rooms) && !isCameraDevice(device) && (!roomId || device.roomId === roomId));
  const selected = eligible.filter(device => selectedIds.has(device.id)).sort(compare);
  const query = search.trim().toLocaleLowerCase(locale);
  const groups = new Map<string, SnapshotDevice[]>();
  for (const device of eligible) {
    if (selectedIds.has(device.id)) continue;
    const space = device.roomId && roomMap.has(device.roomId) ? device.roomId : '';
    if (spaceFilter && (spaceFilter === '__unassigned__' ? space !== '' : space !== spaceFilter)) continue;
    if (query && !`${humanize(device.id, device.name)} ${roomMap.get(space) ?? ''}`.toLocaleLowerCase(locale).includes(query)) continue;
    groups.set(space, [...(groups.get(space) ?? []), device]);
  }
  return {
    selected,
    groups: [...groups.entries()].sort(([a], [b]) => {
      if (!a) return 1;
      if (!b) return -1;
      return (roomMap.get(a) ?? '').localeCompare(roomMap.get(b) ?? '', locale, { sensitivity: 'base' });
    }).map(([id, items]) => ({ id, name: roomMap.get(id), devices: items.sort(compare) })),
  };
}

export function SceneDeviceSelector({ devices, rooms, roomId, actions, onToggle, onCommand }: Props) {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState('');
  const [spaceFilter, setSpaceFilter] = useState('');
  const result = getSceneDeviceGroups(devices, rooms, actions, roomId, search, spaceFilter, i18n.resolvedLanguage);
  const roomName = (device: SnapshotDevice) => rooms.find(room => room.id === device.roomId)?.name ?? t('scenes.builder.unassigned');
  const row = (device: SnapshotDevice) => {
    const action = actions.find(item => item.deviceId === device.id);
    const commands = getRoutineDeviceCommands(device);
    const canToggle = !!action || commands.length > 0;
    return (
      <div key={device.id} className="flex min-w-0 flex-col gap-2 border-b border-border/40 py-2 last:border-0 sm:flex-row sm:items-center">
        <Button type="button" variant="ghost" size="lg" className="min-w-0 flex-1 justify-start gap-3 px-2 text-left" aria-pressed={!!action} aria-disabled={!canToggle} disabled={!canToggle} onClick={() => onToggle(device.id)}>
          {action ? <Check aria-hidden="true" className="size-5 shrink-0 text-primary" /> : <Plus aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />}
          <span className="min-w-0 flex-1">
            <span className="block break-words text-body-compact font-semibold">{humanize(device.id, device.name)}</span>
            <span className="block text-caption font-normal text-muted-foreground">{roomName(device)} · {device.semanticType || device.type}</span>
            {!commands.length && <span className="block text-caption font-normal text-muted-foreground">{t('scenes.builder.no_compatible_command')}</span>}
          </span>
        </Button>
        {action && (['press', 'activate'].includes(action.command) ? (
          <span className="px-2 text-caption text-primary sm:max-w-56">{t('scenes.builder.momentary_action')}</span>
        ) : (
          <div className="min-w-0 sm:w-72 sm:shrink-0">
            <SegmentedControl<RoutineDeviceCommand>
              value={action.command}
              onChange={command => onCommand(device.id, command)}
              options={commands.map(command => ({ value: command, label: t(`automations.builder.commands.${command}`) }))}
              label={t('automations.form.action_type')}
              tone="primary"
              optionClassName="min-h-11 px-2 text-caption normal-case tracking-normal [&>span]:whitespace-nowrap [&>span]:break-normal"
            />
          </div>
        ))}
      </div>
    );
  };
  return (
    <div className="space-y-5">
      <section aria-label={t('scenes.builder.selected')}>
        <h3 className="text-body-compact font-semibold">{t('scenes.builder.selected')} <span className="text-muted-foreground">({actions.length})</span></h3>
        {actions.some(action => !devices.some(device => device.id === action.deviceId && isDeviceOperational(device, rooms))) &&
          <p role="status" className="mt-2 text-caption text-muted-foreground">{t('scenes.builder.saved_unassigned_hint')}</p>}
        {result.selected.length ? result.selected.map(row) : <p className="mt-2 text-caption text-muted-foreground">{t('scenes.builder.selected_empty')}</p>}
      </section>
      <section aria-label={t('scenes.builder.available')} className="space-y-3 border-t border-border/60 pt-4">
        <h3 className="text-body-compact font-semibold">{t('scenes.builder.available')}</h3>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          <SearchInput type="search" aria-label={t('scenes.builder.search_devices')} placeholder={t('scenes.builder.search_devices')} value={search} onChange={event => setSearch(event.target.value)} className="h-11" />
          <SearchableSelectField value={spaceFilter} onChange={setSpaceFilter} placeholder={t('scenes.builder.all_spaces')} options={[
            { value: '', label: t('scenes.builder.all_spaces') },
            ...rooms.filter(room => !roomId || room.id === roomId).map(room => ({ value: room.id, label: room.name })),
          ]} />
        </div>
        {!result.groups.length && <p className="py-3 text-caption text-muted-foreground">{t('dashboard.scene_no_devices')}</p>}
        {result.groups.map(group => (
          <details key={`${group.id}:${search}:${spaceFilter}`} open={!!search || !!spaceFilter || group.devices.length <= 8} className="border-b border-border/50 pb-2 last:border-0">
            <summary className="min-h-11 cursor-pointer content-center rounded-control px-2 text-body-compact font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
              {group.name ?? t('scenes.builder.unassigned')} <span className="text-caption font-normal text-muted-foreground">({group.devices.length})</span>
            </summary>
            {group.devices.map(row)}
          </details>
        ))}
      </section>
    </div>
  );
}
