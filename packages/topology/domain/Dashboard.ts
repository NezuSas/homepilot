/** Canonical widget vocabulary, including persisted V1 aliases. */
export type DashboardWidgetType =
  | 'device_control' | 'action_button' | 'room_overview' | 'room_summary'
  | 'scene_shortcut' | 'activity_feed' | 'assistant_insight' | 'system_status'
  | 'energy_snapshot' | 'clock_display' | 'dashboard_title' | 'section'
  | 'selected_device' | 'scenes_shortcut' | 'assistant_insights' | 'energy_insight';

export interface DashboardWidget {
  id: string;
  type: DashboardWidgetType;
  config: Record<string, unknown>;
}

export interface DashboardTab {
  id: string;
  title: string;
  widgets: DashboardWidget[];
  maxColumns?: 1 | 2 | 3 | 4;
  /** Sparse section IDs for each effective responsive column count. */
  sectionLayout?: Partial<Record<'columns1' | 'columns2' | 'columns3' | 'columns4', Array<string | null>>>;
  icon?: string;
  background?: string;
  backgroundOpacity?: number;
  visibility?: { users: string[] };
  /** When true, this tab opens automatically on page load/reload instead of the first tab. */
  isDefault?: boolean;
}

export interface DashboardVisibility {
  roles: string[];
  users: string[];
  homes: string[];
}

export interface Dashboard {
  id: string;
  ownerId: string;
  title: string;
  visibility: DashboardVisibility;
  tabs: DashboardTab[];
  createdAt: string;
  updatedAt: string;
}

export const DASHBOARD_TRANSFER_FORMAT = 'homepilot-dashboard';
export const DASHBOARD_TRANSFER_VERSION = 1;
export const DASHBOARD_TAB_TRANSFER_FORMAT = 'homepilot-dashboard-tab';

export interface DashboardTabTransferPackage {
  format: typeof DASHBOARD_TAB_TRANSFER_FORMAT;
  version: typeof DASHBOARD_TRANSFER_VERSION;
  exportedAt: string;
  tab: DashboardTransferPackage['dashboard']['tabs'][number];
}

/**
 * Portable dashboard representation. It deliberately excludes ownership,
 * visibility and locally stored background paths. Bundled backgrounds travel
 * by logical preset ID; uploaded assets are represented only as unavailable.
 */
export interface DashboardTransferPackage {
  format: typeof DASHBOARD_TRANSFER_FORMAT;
  version: typeof DASHBOARD_TRANSFER_VERSION;
  exportedAt: string;
  dashboard: {
    title: string;
    tabs: Array<Omit<DashboardTab, 'background'> & {
      background?: never;
      /** Bundled asset identifier, never an appliance-local media path. */
      backgroundPresetId?: string;
      /** Indicates an uploaded background was omitted from this JSON transfer. */
      backgroundUnavailable?: true;
    }>;
  };
}

export interface DashboardImportReport {
  unresolvedBindings: Array<{
    tabTitle: string;
    widgetId: string;
    cardId?: string;
    title: string;
    targetType: string;
  }>;
  nonPortableBackgrounds: number;
}

export type DashboardImportResponse = Dashboard & { importReport?: DashboardImportReport };

export interface DashboardImportTarget {
  type: 'device' | 'room' | 'scene' | 'automation' | 'action' | 'device-action';
  id: string;
  userId?: string;
  cardKind?: string;
  actionKey?: string;
}

/** Infrastructure resolves only targets inside a home accessible to the importer. */
export interface DashboardImportBindingResolver {
  exists(authorizedHomeIds: ReadonlySet<string>, target: DashboardImportTarget): Promise<boolean>;
}

/**
 * A local, reversible checkpoint created immediately before a dashboard is
 * changed. Background assets are intentionally excluded: their storage is
 * local to the appliance and can be removed independently of dashboard data.
 */
export interface DashboardRevisionSnapshot {
  title: string;
  visibility: DashboardVisibility;
  tabs: DashboardTab[];
}

export interface DashboardRevision {
  id: string;
  dashboardId: string;
  createdAt: string;
  snapshot: DashboardRevisionSnapshot;
}

export interface DashboardRepository {
  /** When supplied, revision and dashboard must commit in a single transaction. */
  saveDashboard(dashboard: Dashboard, revision?: DashboardRevision): Promise<void>;
  findDashboardById(id: string): Promise<Dashboard | null>;
  findAllVisibleTo(userId: string, userRole: string, homeIds: string[]): Promise<Dashboard[]>;
  deleteDashboard(id: string): Promise<void>;
  saveRevision(revision: DashboardRevision): Promise<void>;
  findRevisionsByDashboardId(dashboardId: string): Promise<DashboardRevision[]>;
}
