export interface DashboardWidget {
  id: string;
  type: 'room_summary' | 'selected_device' | 'scenes_shortcut' | 'assistant_insights' | 'energy_insight';
  config: Record<string, unknown>;
}

export interface DashboardTab {
  id: string;
  title: string;
  widgets: DashboardWidget[];
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

/**
 * Portable dashboard representation. It deliberately excludes ownership,
 * visibility and locally stored backgrounds so importing it cannot disclose
 * another resident's access policy or leave media references broken.
 */
export interface DashboardTransferPackage {
  format: typeof DASHBOARD_TRANSFER_FORMAT;
  version: typeof DASHBOARD_TRANSFER_VERSION;
  exportedAt: string;
  dashboard: {
    title: string;
    tabs: DashboardTab[];
  };
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
  saveDashboard(dashboard: Dashboard): Promise<void>;
  findDashboardById(id: string): Promise<Dashboard | null>;
  findAllVisibleTo(userId: string, userRole: string, homeIds: string[]): Promise<Dashboard[]>;
  deleteDashboard(id: string): Promise<void>;
  saveRevision(revision: DashboardRevision): Promise<void>;
  findRevisionsByDashboardId(dashboardId: string): Promise<DashboardRevision[]>;
}
