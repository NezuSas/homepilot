import { Blinds, Cable, Cctv, Gauge, LayoutGrid, Lightbulb, Monitor, MousePointerClick, Power, Speaker, type LucideIcon } from 'lucide-react';
import type { RoomIconKey } from './roomSummaryModel';

const ICONS: Record<RoomIconKey, LucideIcon> = {
  plc: Cable,
  light: Lightbulb,
  switch: Power,
  action: MousePointerClick,
  cover: Blinds,
  media_player: Speaker,
  sensor: Gauge,
  smart_display: Monitor,
  camera: Cctv,
  other: LayoutGrid,
  empty: LayoutGrid,
};

/** The icon of a space follows what it holds, so it is recognised before its name is read. */
export function RoomIcon({ iconKey, className }: { iconKey: RoomIconKey; className?: string }) {
  const Icon = ICONS[iconKey];
  return <Icon aria-hidden="true" className={className} />;
}
