import { useRef, useState } from 'react';
import { Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SnapshotDevice } from '../../stores/useDeviceSnapshotStore';
import { apiFetch } from '../../lib/apiClient';
import { isDeviceUnavailable } from '../../lib/deviceAvailability';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useDisplayControlCatalog } from '../../components/useDisplayControlCatalog';
import type { DisplayCatalogCommand, DisplayControlCatalog } from '../../components/SmartDisplayControls';
import { SectionActionCard } from '../dashboards/widgets/SectionActionCard';
import { executeDeviceActionTarget, toDeviceActionEntityId } from '../dashboards/widgets/sectionCardAssignments';
import { useMomentaryActionFeedback } from '../dashboards/widgets/useMomentaryActionFeedback';
import { DisplayControlsSkeleton } from '../../components/ui/ComponentSkeletons';

function DisplayCommand({ device, command }: { device: SnapshotDevice; command: DisplayCatalogCommand }) {
  const { actionFeedback, clearActionFeedback, showActionFeedback } = useMomentaryActionFeedback();
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const execute = async () => {
    if (lock.current || isDeviceUnavailable(device)) return;
    lock.current = true;
    setPending(true);
    clearActionFeedback();
    try {
      await executeDeviceActionTarget(toDeviceActionEntityId(device.id, command.key), apiFetch);
      showActionFeedback(command.key, 'success');
    } catch { showActionFeedback(command.key, 'error'); }
    finally { lock.current = false; setPending(false); }
  };
  return <div className={cn('grid h-28 min-w-0 overflow-hidden rounded-section border border-transparent',
    (pending || actionFeedback?.status === 'success') && 'homepilot-section-light-tile-active')} style={{ containerType: 'inline-size' }}>
    <SectionActionCard kind="action" title={command.displayName} isAssigned isActive={pending || actionFeedback?.status === 'success'}
      isBlocked={isDeviceUnavailable(device)} onAction={() => { void execute(); }}
      actionFeedback={pending ? 'pending' : actionFeedback?.status} />
  </div>;
}

export function RoomDisplayCatalog({ device, catalog }: { device: SnapshotDevice; catalog: DisplayControlCatalog }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const commands = catalog.commands.filter(command => command.visibility === 'visible'
    && command.displayName.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <div className="space-y-3">
    <Input value={search} onChange={event => setSearch(event.target.value)} aria-label={t('topology.search_display_commands')} placeholder={t('topology.search_display_commands')} />
    <div className="homepilot-room-devices grid max-h-96 grid-cols-[repeat(auto-fill,minmax(min(100%,8.5rem),1fr))] gap-3 overflow-y-auto p-1">
      {commands.map(command => command.controlType === 'button' && command.executableInHomePilot && command.dashboardEligible
        ? <DisplayCommand key={command.key} device={device} command={command} />
        : <div key={command.key} className="flex min-w-0 flex-col justify-center gap-2 rounded-section border border-border bg-muted/30 p-3">
          <p className="break-words text-caption font-semibold">{command.displayName}</p>
          <p className="text-micro text-muted-foreground">{t(command.controlType === 'slider' ? 'inbox.smart_display.control_available' : 'inbox.smart_display.included_in_plan')}</p>
        </div>)}
    </div>
    {!commands.length && <p role="status" className="text-caption text-muted-foreground">{t(search.trim() ? 'common.no_results' : 'inbox.smart_display.no_actions')}</p>}
  </div>;
}

export function RoomDisplayControls({ device }: { device: SnapshotDevice }) {
  const { t } = useTranslation();
  const { catalog, loading, loadError, retry } = useDisplayControlCatalog(device.id);
  return <section aria-label={device.name} className="col-span-full min-w-0 space-y-4 rounded-section border border-border bg-card p-4">
    <div className="flex items-center gap-3"><Monitor className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><h3 className="break-words text-card-title font-semibold">{device.name}</h3></div>
    {loadError ? <div role="alert" className="space-y-2"><p>{t('inbox.smart_display.load_error')}</p><Button variant="outline" onClick={retry}>{t('inbox.smart_display.retry')}</Button></div>
      : catalog ? <RoomDisplayCatalog device={device} catalog={catalog} />
        : loading ? <DisplayControlsSkeleton label={t('inbox.smart_display.loading')} /> : null}
  </section>;
}
