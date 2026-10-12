import type { ReactNode } from 'react';
import type { DashboardWidget } from '../types';
import type { SectionLayout } from '../sectionSlots';
import type { SectionCardPlacement } from '../sectionCardDrag';

/** Temporary layout that follows the pointer while dragging; persisted only on drop. */
export interface CanvasDragLayout {
  widgets: DashboardWidget[];
  layout?: SectionLayout;
}

/** Mutable bookkeeping for the drag gesture currently in flight. */
export interface CanvasDragSession extends CanvasDragLayout {
  sourceSectionId?: string;
  lastTarget?: string;
  identities: Record<string, string>;
  /** A card dragged over pinned sections previews every cell from the layout as it was when the drag began. */
  originWidgets?: DashboardWidget[];
  originPlacements?: Record<string, SectionCardPlacement[]>;
  originSourceId?: string;
  /** The `section:column:row` cell last previewed; set only while a pinned-section preview is on screen. */
  lastCell?: string;
}

/** Geometry and content of the floating drag overlay. */
export interface CanvasDragPreview {
  content?: ReactNode;
  node?: HTMLElement;
  radius?: string;
  width: number;
  height: number;
}
