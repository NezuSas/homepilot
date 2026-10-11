import { InformationCard } from './InformationCard';
import { cn } from '../../../lib/utils';
import { isMomentaryPlcCommand } from '../../../lib/plcUi';
import type { SnapshotDevice, SnapshotRoom } from '../../../stores/useDeviceSnapshotStore';
import type { CardGridOptions } from '../types';
import { isDeviceActive } from '../dashboardUtils';
import { getClockGridOptions } from './clock/clockRegistry';
import { getCardFrameClass, getCardGridHeight, getCardGridWidth, getCardPresentationStyle } from './cardGridResize';
import { SectionCardContent } from './SectionCardContent';
import { getBoundRoutineIcon } from './sectionCardEditing';
import {
  getDefaultIcon,
  getDefaultSpan,
  getEffectiveCardSpan,
  isClockKind,
  normalizeKind,
  type AssignableAutomation,
  type AssignableScene,
  type MediaVariant,
  type NormalizedSectionCardItem,
  type NormalizedSectionCardKind,
  type SectionCardIcon,
  type SectionCardKind,
  type SectionCardSpan,
  type SensorScale,
  type SensorVisualStyle,
} from './sectionCardCatalog';

/** Section state a catalog/editor preview needs to render a card the same way the section does. */
export interface SectionCatalogPreviewContext {
  badgeRow: boolean;
  devices: SnapshotDevice[];
  assignableRooms: SnapshotRoom[];
  scenes: AssignableScene[];
  automations: AssignableAutomation[];
  sectionGridWidth: number;
  editingCard: NormalizedSectionCardItem | undefined;
  catalogLabel: (kind: SectionCardKind) => string;
  catalogDescription: (kind: SectionCardKind) => string;
}

export function renderSectionCatalogPreview(
  { badgeRow, devices, assignableRooms, scenes, automations, sectionGridWidth, editingCard, catalogLabel, catalogDescription }: SectionCatalogPreviewContext,
  kind: NormalizedSectionCardKind,
  titleOverride?: string,
  spanOverride?: SectionCardSpan,
  iconOverride?: SectionCardIcon,
  deviceIdOverride?: string,
  isEditorPreview = false,
  mediaVariantOverride?: MediaVariant,
  sensorScaleOverride?: SensorScale,
  sensorDecimalsOverride?: boolean,
  visualStyleOverride?: SensorVisualStyle,
  gridOptionsOverride?: CardGridOptions,
) {
  const title = titleOverride || catalogLabel(kind);
  const span = gridOptionsOverride
    ? gridOptionsOverride.columns === 'full' || gridOptionsOverride.columns > 6 ? 'full' : gridOptionsOverride.columns <= 3 ? 'small' : 'medium'
    : getEffectiveCardSpan(kind, spanOverride ?? getDefaultSpan(kind));
  const normalizedPreviewKind = normalizeKind(kind);
  const isCameraPreview = normalizedPreviewKind === 'camera';
  const isClockPreview = isClockKind(normalizedPreviewKind);
  if (isClockPreview) gridOptionsOverride = getClockGridOptions(gridOptionsOverride);
  const isScenePreview = normalizedPreviewKind === 'scene';
  const isRoomPreview = normalizedPreviewKind === 'room';
  const isCoverPreview = normalizedPreviewKind === 'cover';
  const roomDevices = isRoomPreview && deviceIdOverride
    ? devices.filter((device) => device.roomId === deviceIdOverride)
    : [];
  const previewDevice = deviceIdOverride
    ? devices.find((device) => device.id === deviceIdOverride)
    : undefined;
  const previewRoomName = previewDevice?.roomId
    ? assignableRooms.find((room) => room.id === previewDevice.roomId)?.name
    : undefined;

  if (badgeRow && (normalizedPreviewKind === 'info_time' || normalizedPreviewKind === 'info_weather' || normalizedPreviewKind === 'info_sensor')) {
    return <div className="w-max max-w-full"><InformationCard pill source={normalizedPreviewKind} title={title} icon={iconOverride ?? getDefaultIcon(kind)} device={previewDevice} /></div>;
  }

  return (
    <div style={isEditorPreview ? {
      ...getCardPresentationStyle(gridOptionsOverride?.rows),
      ...(isClockKind(kind) ? { containerName: 'clock-card' } : {}),
      width: sectionGridWidth > 0 ? getCardGridWidth(sectionGridWidth, gridOptionsOverride?.columns ?? (span === 'small' ? 3 : span === 'medium' ? 6 : 12)) : undefined,
      minHeight: getCardGridHeight(gridOptionsOverride?.rows),
      ...((normalizedPreviewKind === 'sensor' || isClockKind(kind)) && typeof gridOptionsOverride?.rows === 'number' ? { height: getCardGridHeight(gridOptionsOverride.rows), minHeight: 0, ...(isClockKind(kind) ? { containerType: 'size' as const, containerName: 'clock-card' } : {}) } : {}),
    } : isClockPreview ? { height: getCardGridHeight(gridOptionsOverride?.rows), containerType: 'size', containerName: 'clock-card' } : undefined} className={isEditorPreview || normalizedPreviewKind.startsWith('info_') ? cn('homepilot-sized-card relative grid shrink-0 min-w-0 overflow-hidden shadow-sm', normalizedPreviewKind === 'sensor' && typeof gridOptionsOverride?.rows === 'number' && 'homepilot-bounded-sensor', getCardFrameClass(normalizedPreviewKind, span, previewDevice && !isMomentaryPlcCommand(previewDevice) ? isDeviceActive(previewDevice) : false)) : cn(
      "grid overflow-hidden rounded-section transition-[height,width,max-width] duration-200",
      !isClockPreview && "bg-background/40",
      isClockPreview && (isEditorPreview ? 'homepilot-clock-preview-host homepilot-clock-preview-host--editor' : 'homepilot-clock-preview-host homepilot-clock-preview-host--catalog'),
      span === 'small' && (normalizedPreviewKind === 'device' || normalizedPreviewKind === 'light' || normalizedPreviewKind === 'action' ? "h-device-card-compact w-device-card-compact justify-self-center" : "h-section-card-sm w-full max-w-[12rem] justify-self-center"),
      span === 'medium' && !isCoverPreview && "h-section-card-md w-full max-w-form-md",
      span === 'medium' && isCoverPreview && "h-curtain-card w-full max-w-form-md justify-self-center",
      span === 'full' && "w-full",
      isCameraPreview ? 'min-h-60' : isClockPreview ? '' : isRoomPreview ? 'h-52' : isScenePreview ? 'h-44' : isCoverPreview && span === 'full' ? 'h-curtain-card-lg' : normalizedPreviewKind === 'media' ? 'h-media-card-preview' : span === 'full' ? 'h-40' : ''
    )}>
      <div className={isEditorPreview ? 'grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)]' : 'contents'}><SectionCardContent
        kind={kind}
        title={title}
        subtitle={isEditorPreview ? isCameraPreview ? previewRoomName : editingCard?.entityName || editingCard?.description : normalizedPreviewKind === 'cover' ? previewRoomName || catalogDescription(kind) : catalogDescription(kind)}
        span={span}
        icon={(normalizedPreviewKind === 'action' ? getBoundRoutineIcon(deviceIdOverride, scenes, automations) : undefined) ?? iconOverride ?? getDefaultIcon(kind)}
        isAssigned={Boolean(deviceIdOverride)}
        isActive={previewDevice && !isMomentaryPlcCommand(previewDevice) ? isDeviceActive(previewDevice) : false}
        device={previewDevice}
        mediaVariant={mediaVariantOverride}
        sensorScale={sensorScaleOverride}
        sensorDecimals={sensorDecimalsOverride}
        visualStyle={visualStyleOverride}
        isPreview={isEditorPreview ? false : normalizedPreviewKind === 'sensor' ? !deviceIdOverride : true}
        isEditorPreview={isEditorPreview}
        roomDeviceCount={roomDevices.length}
        roomActiveCount={roomDevices.filter(isDeviceActive).length}
      /></div>
    </div>
  );
}

/** Preview arguments after the context, as the catalog and editor modals pass them. */
export type SectionCatalogPreviewArgs = Parameters<typeof renderSectionCatalogPreview> extends [unknown, ...infer Rest] ? Rest : never;
