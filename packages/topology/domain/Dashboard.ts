export interface DashboardWidget {
  id: string;
  type: 'room_summary' | 'selected_device' | 'scenes_shortcut' | 'assistant_insights' | 'energy_insight';
  config: Record<string, any>;
}

export interface DashboardTab {
  id: string;
  title: string;
  widgets: DashboardWidget[];
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

export interface DashboardRepository {
  saveDashboard(dashboard: Dashboard): Promise<void>;
  findDashboardById(id: string): Promise<Dashboard | null>;
  findAllVisibleTo(userId: string, userRole: string, homeIds: string[]): Promise<Dashboard[]>;
  deleteDashboard(id: string): Promise<void>;
}
