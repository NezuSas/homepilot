import type { SnapshotRoom as Room } from '../stores/useDeviceSnapshotStore';
import type { DeviceCommand, InspectableDevice } from './deviceInspectorTypes';
import {
  DeviceInspectorActionsSection,
  DeviceInspectorIdentitySection,
  DeviceInspectorPlacementSection,
  DeviceInspectorRemoveImportSection,
  DeviceInspectorUnavailableNotice,
} from './DeviceInspectorInfoSections';

export type { ActivityLog, DeviceCommand, InspectableDevice } from './deviceInspectorTypes';
export { DeviceInspectorLogsTab, DeviceInspectorStateTab } from './DeviceInspectorDataTabs';

interface InfoTabProps {
  configurationOnly?: boolean;
  device: InspectableDevice;
  rooms: Room[];
  unavailable: boolean;
  isOnline: boolean;
  isActionLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  onSemanticTypeChange: (semanticType: string) => void;
  onInvertStateChange: (invertState: boolean) => void;
  onCommand: (command: DeviceCommand) => void;
  onRefresh: () => void;
  onMove: (roomId: string) => void;
  onUnassign: () => void;
  onDelete: () => void;
}

export function DeviceInspectorInfoTab({
  device, rooms, unavailable, isOnline, isActionLoading, isRefreshing, error,
  onSemanticTypeChange, onInvertStateChange, onCommand, onRefresh, onMove, onUnassign, onDelete, configurationOnly = false,
}: InfoTabProps) {
  return (
    <div className="flex flex-col gap-4">
      {unavailable && <DeviceInspectorUnavailableNotice />}
      <DeviceInspectorIdentitySection
        device={device}
        isOnline={isOnline}
        isActionLoading={isActionLoading}
        onSemanticTypeChange={onSemanticTypeChange}
        onInvertStateChange={onInvertStateChange}
      />
      <DeviceInspectorActionsSection
        configurationOnly={configurationOnly}
        device={device}
        unavailable={unavailable}
        isActionLoading={isActionLoading}
        isRefreshing={isRefreshing}
        error={error}
        onCommand={onCommand}
        onRefresh={onRefresh}
      />
      <DeviceInspectorPlacementSection
        device={device}
        rooms={rooms}
        isActionLoading={isActionLoading}
        onMove={onMove}
        onUnassign={onUnassign}
      />
      {(device.externalId.startsWith('ha:') || device.integrationSource === 'sonoff') && (
        <DeviceInspectorRemoveImportSection isActionLoading={isActionLoading} onDelete={onDelete} />
      )}
    </div>
  );
}
