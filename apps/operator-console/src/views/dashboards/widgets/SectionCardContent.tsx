import { CurtainDeviceTile, CurtainDeviceTilePreview } from '../../../components/CurtainDeviceTile';
import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';
import { MediaPlayerCard, type MediaPlayerCommand } from './MediaPlayerCard';
import { SectionActionCard } from './SectionActionCard';
import { SectionAssistantCard } from './SectionAssistantCard';
import { SectionCameraPreview } from './SectionCameraPreview';
import { SectionClockPreview } from './SectionClockPreview';
import { SectionDeviceCard } from './SectionDeviceCard';
import { SectionEnergyCard } from './SectionEnergyCard';
import { SectionRoomCard } from './SectionRoomCard';
import { SectionSceneCard } from './SectionSceneCard';
import { SensorMetricCard } from './SensorMetricCard';
import { isClockKind, normalizeKind, type SectionCardIcon, type SectionCardKind, type SectionCardSpan } from './sectionCardCatalog';

interface SectionCardContentProps {
  kind: SectionCardKind;
  title: string;
  subtitle?: string;
  span: SectionCardSpan;
  icon?: SectionCardIcon;
  isAssigned?: boolean;
  isActive?: boolean;
  device?: SnapshotDevice;
  isPreview?: boolean;
  isEditorPreview?: boolean;
  isMediaProcessing?: boolean;
  onMediaCommand?: (command: MediaPlayerCommand, params?: Record<string, unknown>) => void;
  roomDeviceCount?: number;
  roomActiveCount?: number;
  onDeviceUpdate?: (device: SnapshotDevice) => void;
  onDeviceCommand?: (deviceId: string, command: string, params?: Record<string, unknown>) => Promise<SnapshotDevice | null>;
  onAction?: () => void;
  actionFeedback?: 'pending' | 'success' | 'error';
}

export function SectionCardContent({
  kind,
  title,
  subtitle,
  span,
  icon,
  isAssigned,
  isActive,
  device,
  isPreview,
  isEditorPreview,
  isMediaProcessing,
  onMediaCommand,
  roomDeviceCount,
  roomActiveCount,
  onDeviceUpdate,
  onDeviceCommand,
  onAction,
  actionFeedback,
}: SectionCardContentProps) {
  const normalized = normalizeKind(kind);
  const isSmall = span === 'small';

  if (isClockKind(normalized)) return <SectionClockPreview kind={normalized} title={title} />;
  if (normalized === 'camera') return <SectionCameraPreview device={device} title={title} subtitle={subtitle} />;
  if (normalized === 'sensor') return <SensorMetricCard device={device} title={title} isPreview={isPreview} />;
  if (normalized === 'media') return <MediaPlayerCard device={device} title={title} isPreview={isPreview} isProcessing={isMediaProcessing} onCommand={onMediaCommand} compact={isSmall} />;
  if (normalized === 'cover') {
    const density = isSmall ? 'compact' : 'standard';
    return device && !isPreview
      ? <CurtainDeviceTile device={device} roomName={subtitle} onUpdate={onDeviceUpdate} onCommand={onDeviceCommand} layout="dashboard" density={density} />
      : <CurtainDeviceTilePreview title={title} roomName={subtitle} layout="dashboard" density={density} />;
  }
  if (normalized === 'action') return <SectionActionCard kind={kind} title={title} subtitle={subtitle} icon={icon} isAssigned={isAssigned} isActive={isActive} isPreview={isPreview} isEditorPreview={isEditorPreview} onAction={onAction} actionFeedback={actionFeedback} />;
  if (normalized === 'energy') return <SectionEnergyCard />;
  if (normalized === 'room') return <SectionRoomCard title={title} roomDeviceCount={roomDeviceCount} roomActiveCount={roomActiveCount} />;
  if (normalized === 'scene') return <SectionSceneCard title={title} subtitle={subtitle} />;
  if (normalized === 'assistant') return <SectionAssistantCard kind={kind} title={title} icon={icon} />;

  return <SectionDeviceCard kind={kind} title={title} subtitle={subtitle} icon={icon} isAssigned={isAssigned} isActive={isActive} isPreview={isPreview} />;
}
