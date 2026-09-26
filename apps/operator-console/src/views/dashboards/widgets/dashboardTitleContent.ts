import type { DashboardWidgetConfig } from '../types';
import { getDashboardUserDisplayName } from '../dashboardUtils';

export interface DashboardTitleTabRef {
  id: string;
  title: string;
  icon?: string;
}

export interface DashboardTitleWidgetProps {
  config: DashboardWidgetConfig;
  isEditing: boolean;
  isSelected?: boolean;
  /** Monotonic request from the card chrome to reopen the title editor. */
  editRequest?: number;
  onEditorOpenChange?: (isOpen: boolean) => void;
  onUpdate?: (config: Partial<DashboardWidgetConfig>) => void;
  /** Other tabs of this dashboard, so a badge can jump straight to one of them. */
  tabs?: DashboardTitleTabRef[];
  currentTabId?: string;
  onSelectTab?: (tabId: string) => void;
}

export type TitleAlign = 'left' | 'center' | 'right';
export type TitleWidthMode = 'full' | 'half' | 'third';

export interface TitleBadge {
  id: string;
  kind: 'weather' | 'time' | 'tab';
  tabId?: string;
}

export function parseBadges(value: unknown): TitleBadge[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is TitleBadge => {
    if (!item || typeof item !== 'object') return false;
    const record = item as Record<string, unknown>;
    return typeof record.id === 'string' && (record.kind === 'weather' || record.kind === 'time' || record.kind === 'tab');
  });
}

function getStoredUserName(fallback: string) {
  if (typeof window === 'undefined') return fallback;

  try {
    const storedContext = window.localStorage.getItem('hp_user_ctx');
    return getDashboardUserDisplayName(storedContext ? JSON.parse(storedContext) : null, fallback);
  } catch {
    return fallback;
  }
}

export function renderTemplate(markdown: string, fallbackUserName: string) {
  const user = getStoredUserName(fallbackUserName);

  return markdown
    .replace(/\{\{\s*user\s*\}\}/gi, user)
    .replace(/\{\{\s*usuario\s*\}\}/gi, user);
}

export function markdownToBlocks(markdown: string) {
  const lines = markdown.split(/\r?\n/);

  return lines.map((rawLine, index) => {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      return { key: index, type: 'space' as const, text: '' };
    }

    if (line.startsWith('### ')) {
      return { key: index, type: 'h3' as const, text: line.slice(4).trim() };
    }

    if (line.startsWith('## ')) {
      return { key: index, type: 'h2' as const, text: line.slice(3).trim() };
    }

    if (line.startsWith('# ')) {
      return { key: index, type: 'h1' as const, text: line.slice(2).trim() };
    }

    return { key: index, type: 'p' as const, text: line.trim() };
  });
}
