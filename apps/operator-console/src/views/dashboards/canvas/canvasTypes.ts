import type { ReactNode } from 'react';
import type { DashboardWidget } from '../types';
import type { SectionLayout } from '../sectionSlots';

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
}

/** Geometry and content of the floating drag overlay. */
export interface CanvasDragPreview {
  content?: ReactNode;
  node?: HTMLElement;
  radius?: string;
  width: number;
  height: number;
}
