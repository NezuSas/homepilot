import {
  Dashboard,
  DashboardRepository,
  DashboardRevision,
  DashboardRevisionSnapshot,
  DashboardTab,
  DashboardTransferPackage,
  DashboardVisibility,
  DASHBOARD_TRANSFER_FORMAT,
  DASHBOARD_TRANSFER_VERSION,
} from '../domain/Dashboard';
import { HomeRepository } from '../domain/repositories/HomeRepository';
import { randomUUID } from 'crypto';

export class DashboardService {
  constructor(
    private readonly dashboardRepository: DashboardRepository,
    private readonly homeRepository: HomeRepository
  ) {}

  public async getDashboardsForUser(userId: string, userRole: string): Promise<Dashboard[]> {
    const homes = await this.homeRepository.findHomesByUserId(userId);
    const homeIds = homes.map(h => h.id);
    return this.dashboardRepository.findAllVisibleTo(userId, userRole, homeIds);
  }

  public async createDashboard(userId: string, title: string): Promise<Dashboard> {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) throw new Error('DASHBOARD_TITLE_REQUIRED');
    const now = new Date().toISOString();
    const dashboard: Dashboard = {
      id: randomUUID(),
      ownerId: userId,
      title: normalizedTitle,
      visibility: { roles: [], users: [userId], homes: [] },
      tabs: [{ id: randomUUID(), title: 'Principal', widgets: [] }],
      createdAt: now,
      updatedAt: now,
    };
    await this.dashboardRepository.saveDashboard(dashboard);
    return dashboard;
  }

  public async exportDashboard(userId: string, dashboardId: string): Promise<DashboardTransferPackage> {
    const dashboard = await this.getOwnedDashboard(userId, dashboardId);
    return {
      format: DASHBOARD_TRANSFER_FORMAT,
      version: DASHBOARD_TRANSFER_VERSION,
      exportedAt: new Date().toISOString(),
      dashboard: {
        title: dashboard.title,
        tabs: dashboard.tabs.map(tab => ({
          id: tab.id,
          title: tab.title,
          widgets: tab.widgets,
          layout: tab.layout,
          icon: tab.icon,
        })),
      },
    };
  }

  public async importDashboard(userId: string, transfer: unknown): Promise<Dashboard> {
    if (!isDashboardTransferPackage(transfer)) {
      throw new Error('DASHBOARD_IMPORT_INVALID');
    }
    if (transfer.version !== DASHBOARD_TRANSFER_VERSION) {
      throw new Error('DASHBOARD_IMPORT_UNSUPPORTED_VERSION');
    }

    const title = transfer.dashboard.title.trim();
    if (!title || transfer.dashboard.tabs.length === 0) {
      throw new Error('DASHBOARD_IMPORT_INVALID');
    }

    const now = new Date().toISOString();
    const dashboard: Dashboard = {
      id: randomUUID(),
      ownerId: userId,
      title,
      visibility: { roles: [], users: [userId], homes: [] },
      tabs: transfer.dashboard.tabs.map(tab => ({
        ...tab,
        id: randomUUID(),
        background: undefined,
        visibility: undefined,
        isDefault: false,
        widgets: tab.widgets.map(widget => ({ ...widget, id: randomUUID() })),
      })),
      createdAt: now,
      updatedAt: now,
    };

    await this.dashboardRepository.saveDashboard(dashboard);
    return dashboard;
  }

  public async updateDashboard(
    userId: string, 
    _userRole: string,
    dashboardId: string, 
    updates: { title?: string; tabs?: DashboardTab[]; visibility?: DashboardVisibility }
  ): Promise<Dashboard> {
    const dashboard = await this.dashboardRepository.findDashboardById(dashboardId);
    if (!dashboard) throw new Error('DASHBOARD_NOT_FOUND');

    if (dashboard.ownerId !== userId) {
      throw new Error('FORBIDDEN');
    }

    const now = new Date().toISOString();
    await this.dashboardRepository.saveRevision({
      id: randomUUID(),
      dashboardId: dashboard.id,
      createdAt: now,
      snapshot: createRevisionSnapshot(dashboard),
    });

    const updated: Dashboard = {
      ...dashboard,
      title: updates.title ?? dashboard.title,
      tabs: updates.tabs ?? dashboard.tabs,
      visibility: updates.visibility ?? dashboard.visibility,
      updatedAt: now,
    };

    await this.dashboardRepository.saveDashboard(updated);
    return updated;
  }

  public async getDashboardRevisions(userId: string, dashboardId: string): Promise<DashboardRevision[]> {
    await this.getOwnedDashboard(userId, dashboardId);
    return this.dashboardRepository.findRevisionsByDashboardId(dashboardId);
  }

  public async restoreDashboardRevision(userId: string, dashboardId: string, revisionId: string): Promise<Dashboard> {
    const dashboard = await this.getOwnedDashboard(userId, dashboardId);
    const revisions = await this.dashboardRepository.findRevisionsByDashboardId(dashboardId);
    const revision = revisions.find((candidate) => candidate.id === revisionId);
    if (!revision) throw new Error('DASHBOARD_REVISION_NOT_FOUND');

    const now = new Date().toISOString();
    await this.dashboardRepository.saveRevision({
      id: randomUUID(),
      dashboardId: dashboard.id,
      createdAt: now,
      snapshot: createRevisionSnapshot(dashboard),
    });

    const currentBackgroundByTabId = new Map(
      dashboard.tabs.map((tab) => [tab.id, tab.background]),
    );
    const restored: Dashboard = {
      ...dashboard,
      title: revision.snapshot.title,
      visibility: cloneValue(revision.snapshot.visibility),
      tabs: revision.snapshot.tabs.map((tab) => ({
        ...cloneValue(tab),
        background: currentBackgroundByTabId.get(tab.id),
      })),
      updatedAt: now,
    };

    await this.dashboardRepository.saveDashboard(restored);
    return restored;
  }

  public async getOwnedDashboard(userId: string, dashboardId: string): Promise<Dashboard> {
    const dashboard = await this.dashboardRepository.findDashboardById(dashboardId);
    if (!dashboard) throw new Error('DASHBOARD_NOT_FOUND');

    if (dashboard.ownerId !== userId) {
      throw new Error('FORBIDDEN');
    }

    return dashboard;
  }

  public async deleteDashboard(userId: string, _userRole: string, dashboardId: string): Promise<void> {
    const dashboard = await this.dashboardRepository.findDashboardById(dashboardId);
    if (!dashboard) return;

    if (dashboard.ownerId !== userId) {
      throw new Error('FORBIDDEN');
    }

    await this.dashboardRepository.deleteDashboard(dashboardId);
  }
}

function createRevisionSnapshot(dashboard: Dashboard): DashboardRevisionSnapshot {
  return {
    title: dashboard.title,
    visibility: cloneValue(dashboard.visibility),
    tabs: dashboard.tabs.map((tab) => {
      const { background: _background, backgroundOpacity: _backgroundOpacity, ...restorableTab } = tab;
      return cloneValue(restorableTab);
    }),
  };
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isDashboardTransferPackage(value: unknown): value is DashboardTransferPackage {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DashboardTransferPackage>;
  return candidate.format === DASHBOARD_TRANSFER_FORMAT
    && typeof candidate.version === 'number'
    && Boolean(candidate.dashboard)
    && typeof candidate.dashboard?.title === 'string'
    && Array.isArray(candidate.dashboard?.tabs);
}
