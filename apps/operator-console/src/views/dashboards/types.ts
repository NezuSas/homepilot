// type-only import removed since unused

export type WidgetType = 
  | 'device_control' 
  | 'room_overview' 
  | 'room_summary'   // legacy alias â€” maps to RoomWidget
  | 'scene_shortcut' 
  | 'activity_feed' 
  | 'assistant_insight' 
  | 'system_status' 
  | 'energy_snapshot'
  | 'clock_display'
  | 'dashboard_title' | 'section';

export interface WidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  /**
   * Column-span within the flow-based canvas grid (1..3), Home Assistant
   * "Sections" style. x/y/w are kept for backward compatibility with data
   * persisted before this model existed, but no longer drive positioning.
   */
  span?: number;
}

export interface VisibilityRule {
  id: string;
  type: 'always' | 'device_on' | 'has_alerts' | 'time_range';
  value?: string; // entityId for device_on, or '08:00-22:00' for time_range
  action: 'show' | 'hide';
}

export interface DashboardWidgetConfig {
  layout: WidgetLayout;
  binding: {
    entityId: string;
    entityType: 'device' | 'room' | 'scene' | 'group' | 'system' | 'assistant' | 'energy';
    entityName?: string;
  };
  visibility: {
    rules: VisibilityRule[];
    defaultState: 'show' | 'hide';
  };
  appearance: {
    variant?: 'glass' | 'solid' | 'radiant' | 'outline' | 'flat';
    icon?: string;
    title?: string;
    showTitle?: boolean;
    accentColor?: string;
    colors?: { primary?: string; accent?: string };
  };
  extra?: Record<string, unknown>;
}

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  config: DashboardWidgetConfig;
}

export interface DashboardTab {
  id: string;
  title: string;
  widgets: DashboardWidget[];
  layout?: 'sections' | 'masonry' | 'sidebar' | 'panel';
  icon?: string;
  background?: string;
  backgroundOpacity?: number;
  visibility?: { users: string[] };
  /** When true, this tab opens automatically on page load/reload instead of the first tab. */
  isDefault?: boolean;
}

export interface Dashboard {
  id: string;
  ownerId: string;
  title: string;
  visibility: { roles: string[]; users: string[]; homes: string[] };
  tabs: DashboardTab[];
  createdAt: string;
  updatedAt: string;
}

export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  icon?: string;
  widgets: DashboardWidget[];
}
