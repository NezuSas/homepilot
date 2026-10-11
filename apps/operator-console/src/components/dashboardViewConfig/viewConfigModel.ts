export const MAX_BG_PX = 1920;
export const BG_QUALITY = 0.8;

export type ViewConfigTab = 'settings' | 'background' | 'visibility';

export type ViewColumns = 1 | 2 | 3 | 4;

export interface DashboardViewConfigTabData {
  maxColumns?: ViewColumns;
  title: string;
  icon?: string;
  background?: string;
  backgroundOpacity?: number;
  visibility?: { users: string[] };
  isDefault?: boolean;
}

export interface DashboardViewConfigSaveFields {
  maxColumns?: ViewColumns;
  title: string;
  icon?: string;
  background?: string | null;
  backgroundOpacity?: number;
  visibility?: { users: string[] };
  isDefault?: boolean;
}

export interface ViewConfigUser {
  id: string;
  username: string;
  displayName?: string | null;
}

/** URL slug shown for the view, derived from the draft title (accents stripped). */
export function buildRouteSlug(draftTitle: string, fallbackTitle: string): string {
  const source = draftTitle.trim() || fallbackTitle || 'view';
  return source
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'view';
}

/** Scales dimensions down so the longest side is at most `max`, keeping the aspect ratio. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  if (width <= max && height <= max) return { width, height };
  if (width > height) {
    return { width: max, height: Math.round((height / width) * max) };
  }
  return { width: Math.round((width / height) * max), height: max };
}
