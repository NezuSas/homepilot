import { DashboardService } from '../application/DashboardService';
import {
  Dashboard,
  DashboardRepository,
  DASHBOARD_TRANSFER_FORMAT,
  DASHBOARD_TRANSFER_VERSION,
} from '../domain/Dashboard';
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

  it('exports owned dashboard layout without local backgrounds or visibility', async () => {
    const stored: Dashboard = {
      id: 'dashboard-1', ownerId: 'user-1', title: 'Control principal',
      visibility: { roles: [], users: ['user-1', 'user-2'], homes: [] },
      tabs: [{
        id: 'tab-1', title: 'Inicio', widgets: [],
        background: '/media/dashboards/dashboard-1/tab-1/background.jpg',
        visibility: { users: ['user-2'] },
        isDefault: true,
      }],
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const dashboardRepository = createDashboardRepository(stored);
    const service = new DashboardService(dashboardRepository, createHomeRepository());

    const exported = await service.exportDashboard('user-1', 'dashboard-1');

    expect(exported).toMatchObject({
      format: DASHBOARD_TRANSFER_FORMAT,
      version: DASHBOARD_TRANSFER_VERSION,
      dashboard: { title: 'Control principal', tabs: [{ title: 'Inicio', widgets: [] }] },
    });
    expect(exported.dashboard.tabs[0].background).toBeUndefined();
    expect(exported.dashboard.tabs[0].visibility).toBeUndefined();
    expect(exported.dashboard.tabs[0].isDefault).toBeUndefined();
  });

  it('imports a versioned dashboard as a private copy with new identifiers', async () => {
    let savedDashboard: Dashboard | null = null;
    const dashboardRepository: DashboardRepository = {
      saveDashboard: async (dashboard) => { savedDashboard = dashboard; },
      findDashboardById: async () => null,
      findAllVisibleTo: async () => [],
      deleteDashboard: async () => undefined,
    };
    const service = new DashboardService(dashboardRepository, createHomeRepository());

    const imported = await service.importDashboard('user-2', {
      format: DASHBOARD_TRANSFER_FORMAT,
      version: DASHBOARD_TRANSFER_VERSION,
      exportedAt: '2026-01-01T00:00:00.000Z',
      dashboard: {
        title: 'Control importado',
        tabs: [{
          id: 'source-tab', title: 'Principal', background: '/media/source.jpg',
          visibility: { users: ['user-1'] }, isDefault: true,
          widgets: [{ id: 'source-widget', type: 'selected_device', config: {} }],
        }],
      },
    });

    expect(imported.ownerId).toBe('user-2');
    expect(imported.visibility).toEqual({ roles: [], users: ['user-2'], homes: [] });
    expect(imported.tabs[0]).toMatchObject({ title: 'Principal', background: undefined, visibility: undefined, isDefault: false });
    expect(imported.tabs[0].id).not.toBe('source-tab');
    expect(imported.tabs[0].widgets[0].id).not.toBe('source-widget');
    expect(savedDashboard).toEqual(imported);
  });

  it('rejects dashboard transfers with an unsupported version', async () => {
    const service = new DashboardService(createDashboardRepository(null), createHomeRepository());

    await expect(service.importDashboard('user-1', {
      format: DASHBOARD_TRANSFER_FORMAT,
      version: 99,
      dashboard: { title: 'Unsupported', tabs: [] },
    })).rejects.toThrow('DASHBOARD_IMPORT_UNSUPPORTED_VERSION');
  });
});

function createDashboardRepository(dashboard: Dashboard | null): DashboardRepository {
  return {
    saveDashboard: async () => undefined,
    findDashboardById: async () => dashboard,
    findAllVisibleTo: async () => [],
    deleteDashboard: async () => undefined,
  };
}

function createHomeRepository(): HomeRepository {
  return {
    saveHome: async () => undefined,
    findHomesByUserId: async () => [],
    findHomeById: async () => null,
    findAll: async () => [],
  };
}
