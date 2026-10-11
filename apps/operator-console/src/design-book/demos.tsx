import { actionsDemos } from './demosActions';
import { feedbackDemos } from './demosFeedback';
import { formsDemos } from './demosForms';
import { layoutDemos } from './demosLayout';
import { overlayDemos } from './demosOverlays';
import type { BookDemo } from './demoKit';

export type { BookDemo };

/** Registry: one entry per component file in components/ui, grouped by family in demos*.tsx. */
export const designBookDemos: Record<string, BookDemo> = {
  ...actionsDemos,
  ...feedbackDemos,
  ...formsDemos,
  ...layoutDemos,
  ...overlayDemos,
};
