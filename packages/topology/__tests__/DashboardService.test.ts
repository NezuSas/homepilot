import { DashboardService } from '../application/DashboardService';
import { Dashboard, DashboardRepository } from '../domain/Dashboard';
import { HomeRepository } from '../domain/repositories/HomeRepository';

describe('DashboardService', () => {
  it('creates a trimmed dashboard with a usable default tab', async () => {
    let savedDashboard: Dashboard | null = null;
    const dashboardRepository: DashboardRepository = {
      saveDashboard: async (dashboard) => { savedDashboard = dashboard; },
      findDashboardById: async () => null,
      findAllVisibleTo: async () => [],
      deleteDashboard: async () => undefined,
    };
    const homeRepository: HomeRepository = {
      saveHome: async () => undefined,
      findHomesByUserId: async () => [],
      findHomeById: async () => null,
      findAll: async () => [],
    };

    const service = new DashboardService(dashboardRepository, homeRepository);
    const dashboard = await service.createDashboard('user-1', '  Control principal  ');

    expect(dashboard.title).toBe('Control principal');
    expect(dashboard.tabs).toHaveLength(1);
    expect(dashboard.tabs[0]).toMatchObject({ title: 'Principal', widgets: [] });
    expect(savedDashboard).toEqual(dashboard);
  });

  it('rejects an empty dashboard title', async () => {
    const dashboardRepository: DashboardRepository = {
      saveDashboard: async () => undefined,
      findDashboardById: async () => null,
      findAllVisibleTo: async () => [],
      deleteDashboard: async () => undefined,
    };
    const homeRepository: HomeRepository = {
      saveHome: async () => undefined,
      findHomesByUserId: async () => [],
      findHomeById: async () => null,
      findAll: async () => [],
    };

    const service = new DashboardService(dashboardRepository, homeRepository);

    await expect(service.createDashboard('user-1', '   ')).rejects.toThrow('DASHBOARD_TITLE_REQUIRED');
  });
});
