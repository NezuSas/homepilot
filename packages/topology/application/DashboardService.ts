import { Dashboard, DashboardRepository, DashboardTab } from '../domain/Dashboard';
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
    const dashboard: Dashboard = {
      id: randomUUID(),
      ownerId: userId,
      title,
      visibility: { roles: ['user', 'admin'], users: [userId], homes: [] },
      tabs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.dashboardRepository.saveDashboard(dashboard);
    return dashboard;
  }

  public async updateDashboard(
    userId: string, 
    userRole: string,
    dashboardId: string, 
    updates: { title?: string; tabs?: DashboardTab[]; visibility?: any }
  ): Promise<Dashboard> {
    const dashboard = await this.dashboardRepository.findDashboardById(dashboardId);
    if (!dashboard) throw new Error('DASHBOARD_NOT_FOUND');

    if (dashboard.ownerId !== userId && userRole !== 'admin') {
      throw new Error('FORBIDDEN');
    }

    if (updates.title) dashboard.title = updates.title;
    if (updates.tabs) dashboard.tabs = updates.tabs;
    if (updates.visibility) dashboard.visibility = updates.visibility;
    dashboard.updatedAt = new Date().toISOString();

    await this.dashboardRepository.saveDashboard(dashboard);
    return dashboard;
  }

  public async deleteDashboard(userId: string, userRole: string, dashboardId: string): Promise<void> {
    const dashboard = await this.dashboardRepository.findDashboardById(dashboardId);
    if (!dashboard) return;

    if (dashboard.ownerId !== userId && userRole !== 'admin') {
      throw new Error('FORBIDDEN');
    }

    await this.dashboardRepository.deleteDashboard(dashboardId);
  }
}
