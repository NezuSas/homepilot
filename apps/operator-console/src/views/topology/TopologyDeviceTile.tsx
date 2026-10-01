import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SnapshotDevice } from '../../stores/useDeviceSnapshotStore';
import { resolveManagedDeviceKind } from '../../lib/devicePresentation';
import { isDeviceUnavailable } from '../../lib/deviceAvailability';
import { cn } from '../../lib/utils';
import { CurtainDeviceTile } from '../../components/CurtainDeviceTile';
import { CameraDeviceTile } from '../../components/CameraDeviceTile';
import { RoomDisplayControls } from './RoomDisplayControls';
import { SensorMetricCard } from '../dashboards/widgets/SensorMetricCard';
import { SectionActionCard } from '../dashboards/widgets/SectionActionCard';
import { SectionDeviceCard } from '../dashboards/widgets/SectionDeviceCard';
import { getDefaultIcon } from '../dashboards/widgets/sectionCardCatalog';
import { MediaPlayerCard } from '../dashboards/widgets/MediaPlayerCard';
import { useMomentaryActionFeedback } from '../dashboards/widgets/useMomentaryActionFeedback';
import { getRoomDeviceCommand, getRoomDeviceState, isRoomDeviceMomentary } from './topologyDeviceControl';

interface TopologyDeviceTileProps {
  device: SnapshotDevice;
  roomName?: string;
  onCommand: (deviceId: string, command: string, params?: Record<string, unknown>) => Promise<SnapshotDevice | null>;
}

/** Room adapter: uses the Dashboard presenters, without its configurable wrappers. */
export function TopologyDeviceTile({ device, roomName, onCommand }: TopologyDeviceTileProps) {
  const { t } = useTranslation();
  const { actionFeedback, clearActionFeedback, showActionFeedback } = useMomentaryActionFeedback();
  const kind = resolveManagedDeviceKind(device);
  const command = getRoomDeviceCommand(device);
  const momentary = isRoomDeviceMomentary(device);
  const active = getRoomDeviceState(device);
  const feedback = actionFeedback?.status;
  // Each tile owns its pending lifecycle; neighboring devices remain usable.
  const [processing, setProcessing] = useState(false);
  const lock = useRef(false);
  const execute = async (requestedCommand = command, params?: Record<string, unknown>) => {
    if (!requestedCommand || lock.current) return;
    lock.current = true;
    setProcessing(true);
    clearActionFeedback();
    try { showActionFeedback(device.id, await onCommand(device.id, requestedCommand, params) ? 'success' : 'error'); }
    catch { showActionFeedback(device.id, 'error'); }
    finally { lock.current = false; setProcessing(false); }
  };

  if (kind === 'sensor' && !command) return <div className="grid min-w-0 max-w-44" style={{ containerType: 'inline-size' }}>
    <SensorMetricCard device={device} title={device.name} roomName={roomName} />
  </div>;
  if (kind === 'camera') return <div className="col-span-full min-w-0 sm:col-span-2"><CameraDeviceTile device={device} title={device.name} roomName={roomName} dashboard /></div>;
  if (kind === 'smart_display') return <RoomDisplayControls device={device} />;
  if (kind === 'cover') return <div className="col-span-full min-w-0 sm:col-span-2">
    <CurtainDeviceTile device={device} roomName={roomName} layout="dashboard" density="compact" onCommand={onCommand} />
  </div>;
  if (device.type === 'media_player' || device.profile?.domain === 'media_player' || device.capabilities?.some(capability => capability.type === 'media_player')) {
    return <div className="col-span-full min-w-0 sm:col-span-2" style={{ containerType: 'inline-size' }}>
      <MediaPlayerCard device={device} title={device.name} compact isProcessing={processing}
        onCommand={(mediaCommand, params) => { void execute(mediaCommand, params); }} />
    </div>;
  }

  const stateLabel = momentary ? t('topology.momentary_action')
    : isDeviceUnavailable(device) ? t('device_states.unavailable')
      : active === null ? t('dashboard.editor.sections.sensor_unavailable') : t(`device_states.${active ? 'on' : 'off'}`);
  return <div className="flex h-28 min-w-0 max-w-44 flex-col gap-1" style={{ containerType: 'inline-size' }}>
    <div className={cn('grid min-h-0 flex-1 overflow-hidden rounded-section border border-transparent',
      (momentary ? processing || feedback === 'success' : active === true) && 'homepilot-section-light-tile-active')}>
      {command || ['light', 'switch'].includes(kind) || momentary ? <SectionActionCard
        kind={momentary ? 'action' : 'light'} title={device.name} isAssigned={Boolean(command)}
        isActive={momentary ? processing || feedback === 'success' : active === true}
        pressed={momentary || active === null ? undefined : active} subtitle={stateLabel}
        ariaLabel={momentary ? undefined : `${t(command === 'toggle' ? 'topology.toggle_device' : active ? 'topology.turn_off_device' : 'topology.turn_on_device')}: ${device.name}`}
        onAction={command ? () => { void execute(); } : undefined}
        actionFeedback={processing ? 'pending' : feedback}
      /> : <SectionDeviceCard kind="device" title={device.name} icon={getDefaultIcon('device')} isAssigned />}
    </div>
    <span className="text-center text-micro text-muted-foreground">{command || ['light', 'switch'].includes(kind) || momentary
      ? stateLabel : t(`device_types.${device.semanticType || device.type}`, { defaultValue: t('device_types.none') })}</span>
  </div>;
}
