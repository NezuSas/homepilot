import { DashboardService } from '../application/DashboardService';
import {
  Dashboard,
  DashboardRevision,
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
      saveRevision: async () => undefined,
      findRevisionsByDashboardId: async () => [],
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
      saveRevision: async () => undefined,
      findRevisionsByDashboardId: async () => [],
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
      saveRevision: async () => undefined,
      findRevisionsByDashboardId: async () => [],
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

  it('archives the previous state before updating a dashboard', async () => {
    const stored = createDashboard('dashboard-1', 'Original');
    const revisions: DashboardRevision[] = [];
    const dashboardRepository: DashboardRepository = {
      ...createDashboardRepository(stored),
      saveDashboard: async () => undefined,
      saveRevision: async (revision) => { revisions.push(revision); },
      findRevisionsByDashboardId: async () => revisions,
    };
    const service = new DashboardService(dashboardRepository, createHomeRepository());

    const updated = await service.updateDashboard('user-1', 'admin', stored.id, { title: 'Actualizado' });

    expect(updated.title).toBe('Actualizado');
    expect(revisions).toHaveLength(1);
    expect(revisions[0].snapshot.title).toBe('Original');
    expect(revisions[0].snapshot.tabs[0].background).toBeUndefined();
  });

  it('publishes a shared tab through its dashboard and revokes it when removed', async () => {
    const stored = createDashboard('dashboard-1', 'Oscar');
    stored.tabs = [
      { id: 'tab-private', title: 'Privada', widgets: [], visibility: { users: ['user-1'] } },
      { id: 'tab-gustavo', title: 'Compartida', widgets: [], visibility: { users: ['gustavo-user'] } },
    ];
    const dashboardRepository = createDashboardRepository(stored);
    const service = new DashboardService(dashboardRepository, createHomeRepository());

    const shared = await service.updateDashboard('user-1', 'admin', stored.id, { tabs: stored.tabs });
    expect(shared.visibility.users).toEqual(['user-1', 'gustavo-user']);

    const revoked = await service.updateDashboard('user-1', 'admin', stored.id, {
      tabs: [{ id: 'tab-private', title: 'Privada', widgets: [], visibility: { users: ['user-1'] } }],
    });
    expect(revoked.visibility.users).toEqual(['user-1']);
  });

  it('returns only tabs explicitly shared with a non-owner', async () => {
    const sharedDashboard = createDashboard('dashboard-1', 'Oscar');
    sharedDashboard.visibility.users = ['user-1', 'gustavo-user'];
    sharedDashboard.tabs = [
      { id: 'tab-private', title: 'Privada', widgets: [], visibility: { users: ['user-1'] } },
      { id: 'tab-gustavo', title: 'Compartida', widgets: [], visibility: { users: ['gustavo-user'] } },
    ];
    const dashboardRepository: DashboardRepository = {
      ...createDashboardRepository(sharedDashboard),
      findAllVisibleTo: async () => [sharedDashboard],
    };
    const service = new DashboardService(dashboardRepository, createHomeRepository());

    const dashboards = await service.getDashboardsForUser('gustavo-user', 'admin');
    expect(dashboards).toHaveLength(1);
    expect(dashboards[0].tabs.map((tab) => tab.id)).toEqual(['tab-gustavo']);
  });

  it('restores a selected revision and archives the current state first', async () => {
    const stored = createDashboard('dashboard-1', 'Actual');
    stored.tabs[0].background = '/media/current-background.jpg';
    const revisions: DashboardRevision[] = [{
      id: 'revision-1',
      dashboardId: stored.id,
      createdAt: '2026-01-01T00:00:00.000Z',
      snapshot: {
        title: 'Anterior',
        visibility: { roles: [], users: ['user-1'], homes: [] },
        tabs: [{ id: stored.tabs[0].id, title: 'Inicio anterior', widgets: [] }],
      },
    }];
    const dashboardRepository: DashboardRepository = {
      ...createDashboardRepository(stored),
      saveDashboard: async () => undefined,
      saveRevision: async (revision) => { revisions.unshift(revision); },
      findRevisionsByDashboardId: async () => revisions,
    };
    const service = new DashboardService(dashboardRepository, createHomeRepository());

    const restored = await service.restoreDashboardRevision('user-1', stored.id, 'revision-1');

    expect(restored.title).toBe('Anterior');
    expect(restored.tabs[0]).toMatchObject({
      title: 'Inicio anterior',
      background: '/media/current-background.jpg',
    });
    expect(revisions).toHaveLength(2);
    expect(revisions[0].snapshot.title).toBe('Actual');
  });
});

  it('preserves owner tabs, hides unshared dashboards, and validates transfer payloads', async () => {
    const ownerDashboard = createDashboard('owner-dashboard', 'Owner');
    const hiddenDashboard = createDashboard('hidden-dashboard', 'Hidden');
    hiddenDashboard.ownerId = 'other-user';
    hiddenDashboard.tabs = [{ id: 'private-tab', title: 'Private', widgets: [], visibility: { users: ['other-user'] } }];
    const dashboardRepository: DashboardRepository = {
      ...createDashboardRepository(ownerDashboard),
      findAllVisibleTo: async () => [ownerDashboard, hiddenDashboard],
    };
    const homeRepository: HomeRepository = {
      ...createHomeRepository(),
      findHomesByUserId: async () => [{ id: 'home-1', name: 'Home', ownerId: 'user-1', entityVersion: 1, createdAt: '', updatedAt: '' }],
    };
    const service = new DashboardService(dashboardRepository, homeRepository);

    const dashboards = await service.getDashboardsForUser('user-1', 'admin');
    expect(dashboards.map((dashboard) => dashboard.id)).toEqual(['owner-dashboard']);

    await expect(service.importDashboard('user-1', null)).rejects.toThrow('DASHBOARD_IMPORT_INVALID');
    await expect(service.importDashboard('user-1', {
      format: DASHBOARD_TRANSFER_FORMAT,
      version: DASHBOARD_TRANSFER_VERSION,
      dashboard: { title: '   ', tabs: [] },
    })).rejects.toThrow('DASHBOARD_IMPORT_INVALID');
  });

  it('enforces ownership and handles absent dashboards consistently', async () => {
    const otherDashboard = createDashboard('other-dashboard', 'Other');
    otherDashboard.ownerId = 'other-user';
    const deleteDashboard = jest.fn().mockResolvedValue(undefined);
    const repository: DashboardRepository = {
      ...createDashboardRepository(otherDashboard),
      deleteDashboard,
    };
    const service = new DashboardService(repository, createHomeRepository());

    await expect(service.updateDashboard('user-1', 'admin', otherDashboard.id, {})).rejects.toThrow('FORBIDDEN');
    await expect(service.getOwnedDashboard('user-1', otherDashboard.id)).rejects.toThrow('FORBIDDEN');
    await expect(service.deleteDashboard('user-1', 'admin', otherDashboard.id)).rejects.toThrow('FORBIDDEN');

    const missingRepository: DashboardRepository = { ...createDashboardRepository(null), deleteDashboard };
    const missingService = new DashboardService(missingRepository, createHomeRepository());
    await expect(missingService.getOwnedDashboard('user-1', 'missing')).rejects.toThrow('DASHBOARD_NOT_FOUND');
    await expect(missingService.restoreDashboardRevision('user-1', 'missing', 'revision-1')).rejects.toThrow('DASHBOARD_NOT_FOUND');
    await missingService.deleteDashboard('user-1', 'admin', 'missing');
    expect(deleteDashboard).not.toHaveBeenCalled();
  });

  it('rejects unknown revisions without mutating the dashboard', async () => {
    const stored = createDashboard('dashboard-1', 'Current');
    const saveRevision = jest.fn().mockResolvedValue(undefined);
    const service = new DashboardService({
      ...createDashboardRepository(stored),
      saveRevision,
      findRevisionsByDashboardId: async () => [],
    }, createHomeRepository());

    await expect(service.restoreDashboardRevision('user-1', stored.id, 'unknown')).rejects.toThrow('DASHBOARD_REVISION_NOT_FOUND');
    expect(saveRevision).not.toHaveBeenCalled();
  });
function createDashboardRepository(dashboard: Dashboard | null): DashboardRepository {
  return {
    saveDashboard: async () => undefined,
    findDashboardById: async () => dashboard,
    findAllVisibleTo: async () => [],
    deleteDashboard: async () => undefined,
    saveRevision: async () => undefined,
    findRevisionsByDashboardId: async () => [],
  };
}

function createDashboard(id: string, title: string): Dashboard {
  return {
    id,
    ownerId: 'user-1',
    title,
    visibility: { roles: [], users: ['user-1'], homes: [] },
    tabs: [{ id: 'tab-1', title: 'Inicio', widgets: [] }],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
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
