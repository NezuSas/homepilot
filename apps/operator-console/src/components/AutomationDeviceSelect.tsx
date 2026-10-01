import { useTranslation } from 'react-i18next';
import { SearchableSelectField } from './ui/SearchableSelectField';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';
import type { AutomationBuilderDevice } from './AutomationBuilderTypes';
import { humanize } from '../lib/naming-utils';
import { isDeviceOperational } from '../lib/deviceOperationalEligibility';

export function getAutomationDeviceOptions(
  devices: AutomationBuilderDevice[],
  rooms: { id: string; name: string; homeId?: string }[],
  unassigned: string,
  locale?: string,
) {
  const roomNames = new Map(rooms.map(room => [room.id, room.name]));
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  return devices.filter(device => isDeviceOperational(device, rooms)).map(device => {
    const room = device.roomId ? roomNames.get(device.roomId) : undefined;
    return {
      value: device.id,
      label: humanize(device.id, device.name),
      description: `${room ?? unassigned} · ${device.semanticType || device.type}`,
      group: room ?? unassigned,
      unassigned: room === undefined,
    };
  }).sort((a, b) => Number(a.unassigned) - Number(b.unassigned)
    || collator.compare(a.group, b.group)
    || collator.compare(a.label, b.label)
  ).map(({ value, label, description, group }) => ({ value, label, description, group }));
}

interface AutomationDeviceSelectProps {
  devices: AutomationBuilderDevice[];
  value: string;
  label: string;
  onChange: (value: string) => void;
}

export function AutomationDeviceSelect({ devices, value, label, onChange }: AutomationDeviceSelectProps) {
  const { t, i18n } = useTranslation();
  const roomsByHome = useDeviceSnapshotStore(state => state.roomsByHome);
  const options = getAutomationDeviceOptions(devices, Object.values(roomsByHome).flat(), t('scenes.builder.unassigned'), i18n.resolvedLanguage);
  return <SearchableSelectField label={label} value={value} onChange={onChange} options={options} placeholder={t('automations.form.select_device')} />;
}
