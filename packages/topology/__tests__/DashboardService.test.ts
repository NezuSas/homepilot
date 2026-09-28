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
    expect(exported.dashboard.tabs[0].backgroundUnavailable).toBe(true);
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
    expect(savedDashboard).toEqual(expect.objectContaining({ id: imported.id, tabs: imported.tabs }));
    expect(imported.importReport).toEqual({ unresolvedBindings: [], nonPortableBackgrounds: 1 });
  });

  it.each([
    { existing: [], language: 'es', expected: 'Tech' },
    { existing: ['Tech'], language: 'es', expected: 'Tech · Importado' },
    { existing: ['Tech', 'Tech · Importado'], language: 'es', expected: 'Tech · Importado 2' },
    { existing: ['tech', 'Tech · Importado', 'TECH · IMPORTADO 2'], language: 'es', expected: 'Tech · Importado 3' },
    { existing: ['Tech', 'Tech · Imported'], language: 'en-US', expected: 'Tech · Imported 2' },
  ])('uses a recognizable, deterministic import title: $expected', async ({ existing, language, expected }) => {
    const dashboardRepository: DashboardRepository = {
      ...createDashboardRepository(null),
      findAllVisibleTo: async () => existing.map((title, index) => createDashboard(`existing-${index}`, title)),
    };
    const service = new DashboardService(dashboardRepository, createHomeRepository());
    const imported = await service.importDashboard('user-1', {
      format: DASHBOARD_TRANSFER_FORMAT,
      version: DASHBOARD_TRANSFER_VERSION,
      dashboard: { title: 'Tech', tabs: [{ id: 'tab-1', title: 'Principal', widgets: [] }] },
    }, language);

    expect(imported.title).toBe(expected);
    expect(imported.title).not.toMatch(/[0-9a-f]{8}-[0-9a-f-]{27,}|\d{4}-\d{2}-\d{2}/i);
  });

  it('rejects dashboard transfers with an unsupported version', async () => {
    const service = new DashboardService(createDashboardRepository(null), createHomeRepository());

    await expect(service.importDashboard('user-1', {
      format: DASHBOARD_TRANSFER_FORMAT,
      version: 99,
      dashboard: { title: 'Unsupported', tabs: [] },
    })).rejects.toThrow('DASHBOARD_IMPORT_UNSUPPORTED_VERSION');
  });

  it('round-trips multiple tabs and section cards without changing their order, icons, spans or appearance', async () => {
    const source: Dashboard = {
      id: 'source-dashboard', ownerId: 'user-1', title: 'Control principal',
      visibility: { roles: [], users: ['user-1'], homes: [] },
      tabs: [
        {
          id: 'tab-first', title: 'Planta baja', icon: 'mdi:home', widgets: [
            { id: 'section-first', type: 'room_summary', config: {
              appearance: { title: 'Sala', showTitle: true },
              extra: { cards: [
                { id: 'card-light', kind: 'light', title: 'Luz', span: 'small', icon: 'mdi:lightbulb' },
                { id: 'card-media', kind: 'media', title: 'Música', span: 'full', icon: 'mdi:music' },
              ] },
            } },
            { id: 'section-second', type: 'room_summary', config: {
              appearance: { title: 'Patio' }, extra: { cards: [{ id: 'card-camera', kind: 'camera', title: 'Cámara', span: 'medium', icon: 'mdi:cctv' }] },
            } },
          ],
        },
        { id: 'tab-second', title: 'Planta alta', widgets: [] },
      ],
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const service = new DashboardService(createDashboardRepository(source), createHomeRepository());
    const serialized = JSON.stringify(await service.exportDashboard('user-1', source.id));
    const imported = await service.importDashboard('user-1', JSON.parse(serialized) as unknown);

    expect(imported.id).not.toBe(source.id);
    expect(imported.title).toBe(source.title);
    expect(imported.tabs.map((tab) => tab.title)).toEqual(['Planta baja', 'Planta alta']);
    expect(imported.tabs[0]?.icon).toBe('mdi:home');
    expect(imported.tabs[0]?.widgets.map((widget) => widget.id)).not.toEqual(source.tabs[0]?.widgets.map((widget) => widget.id));
    expect(imported.tabs[0]?.widgets.map((widget) => widget.config)).toEqual(source.tabs[0]?.widgets.map((widget) => widget.config));
  });

  it('preserves compatible local bindings, unassigns missing targets without name remapping, and reports each one', async () => {
    const source = createDashboard('source', 'Control');
    source.tabs[0].widgets = [
      { id: 'room-widget', type: 'room_summary', config: {
        binding: { entityType: 'room', entityId: 'missing-room', entityName: 'Sala' },
        appearance: { title: 'Sala' },
        extra: { cards: [
          { id: 'valid', kind: 'light', title: 'Luz', entityId: 'existing-device', span: 'small', icon: 'mdi:lightbulb' },
          { id: 'missing', kind: 'light', title: 'Luz', entityId: 'missing-device', span: 'small', icon: 'mdi:lightbulb' },
        ] },
      } },
    ];
    const resolver = { exists: jest.fn(async (_homes: ReadonlySet<string>, target: { id: string }) => target.id === 'existing-device') };
    const service = new DashboardService(createDashboardRepository(source), createHomeRepository(), resolver);
    const imported = await service.importDashboard('user-1', JSON.parse(JSON.stringify(await service.exportDashboard('user-1', 'source'))) as unknown);
    const config = imported.tabs[0].widgets[0].config;
    const binding = config.binding as { entityId: string };
    const cards = (config.extra as { cards: Array<{ entityId?: string; title: string }> }).cards;

    expect(binding.entityId).toBe('');
    expect(cards.map((card) => card.title)).toEqual(['Luz', 'Luz']);
    expect(cards[0].entityId).toBe('existing-device');
    expect(cards[1].entityId).toBeUndefined();
    expect(imported.importReport?.unresolvedBindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ targetType: 'room', title: 'Sala' }),
      expect.objectContaining({ targetType: 'device', cardId: 'missing', title: 'Luz' }),
    ]));
    expect(imported.importReport?.unresolvedBindings).toHaveLength(2);
    expect(resolver.exists).toHaveBeenCalledWith(expect.any(Set), expect.objectContaining({ id: 'missing-device' }));
  });

  it('imports fail-closed when no binding resolver is injected', async () => {
    const source = createDashboard('source', 'Control');
    const targetTypes = ['device', 'room', 'scene', 'automation'] as const;
    source.tabs[0].widgets = targetTypes.map((entityType) => ({
      id: `widget-${entityType}`,
      type: 'selected_device',
      config: { binding: { entityType, entityId: `foreign-${entityType}`, entityName: 'Same name in destination' } },
    }));
    const service = new DashboardService(createDashboardRepository(source), createHomeRepository());

    const imported = await service.importDashboard('user-1', await service.exportDashboard('user-1', 'source'));

    expect(imported.tabs[0].widgets).toHaveLength(targetTypes.length);
    for (const widget of imported.tabs[0].widgets) {
      expect(widget.config.binding).toEqual(expect.objectContaining({ entityId: '', entityName: undefined }));
    }
    expect(imported.importReport?.unresolvedBindings.map((item) => item.targetType)).toEqual(targetTypes);
    for (const entityType of targetTypes) {
      expect(JSON.stringify(imported)).not.toContain(`foreign-${entityType}`);
    }
  });

  it('round-trips a bundled background by logical ID and omits an uploaded path', async () => {
    const source = createDashboard('source', 'Control');
    source.tabs = [
      { id: 'preset', title: 'Preset', widgets: [], background: '/dashboard-backgrounds/mineral-dawn.png', backgroundOpacity: 65 },
      { id: 'upload', title: 'Upload', widgets: [], background: '/media/dashboards/private.jpg', backgroundOpacity: 25 },
    ];
    const service = new DashboardService(createDashboardRepository(source), createHomeRepository());
    const transfer = await service.exportDashboard('user-1', 'source');

    expect(transfer.dashboard.tabs[0]).toMatchObject({ backgroundPresetId: 'mineral-dawn', backgroundOpacity: 65 });
    expect(transfer.dashboard.tabs[1]).toMatchObject({ backgroundUnavailable: true });
    expect(JSON.stringify(transfer)).not.toContain('/media/dashboards/private.jpg');

    const imported = await service.importDashboard('user-1', JSON.parse(JSON.stringify(transfer)) as unknown);
    expect(imported.tabs[0]).toMatchObject({ background: '/dashboard-backgrounds/mineral-dawn.png', backgroundOpacity: 65 });
    expect(imported.tabs[1].background).toBeUndefined();
    expect(imported.tabs[1].backgroundOpacity).toBeUndefined();
    expect(imported.importReport?.nonPortableBackgrounds).toBe(1);
  });

  it('rebases internal section and tab-badge references to the imported IDs', async () => {
    const source = createDashboard('source', 'Control');
    source.tabs = [
      { id: 'old-first', title: 'Inicio', widgets: [{ id: 'old-section', type: 'room_summary', config: {
        binding: { entityType: 'system', entityId: 'old-section' },
        extra: { badges: [{ id: 'badge-1', kind: 'tab', tabId: 'old-second' }] },
      } }] },
      { id: 'old-second', title: 'Patio', widgets: [] },
    ];
    const service = new DashboardService(createDashboardRepository(source), createHomeRepository());
    const imported = await service.importDashboard('user-1', await service.exportDashboard('user-1', 'source'));
    const config = imported.tabs[0].widgets[0].config;
    expect((config.binding as { entityId: string }).entityId).toBe(imported.tabs[0].widgets[0].id);
    expect((config.extra as { badges: Array<{ tabId: string }> }).badges[0].tabId).toBe(imported.tabs[1].id);
  });

  it('keeps an unresolved device visibility rule without retaining its foreign target ID', async () => {
    const source = createDashboard('source', 'Control');
    source.tabs[0].widgets = [{ id: 'conditional', type: 'selected_device', config: {
      visibility: { defaultState: 'hide', rules: [{ id: 'rule-1', type: 'device_on', value: 'foreign-device', action: 'show' }] },
    } }];
    const service = new DashboardService(createDashboardRepository(source), createHomeRepository(), {
      exists: async () => false,
    });

    const imported = await service.importDashboard('user-1', await service.exportDashboard('user-1', 'source'));
    const visibility = imported.tabs[0].widgets[0].config.visibility as {
      defaultState: string; rules: Array<{ id: string; value: string; action: string }>;
    };
    expect(visibility.defaultState).toBe('hide');
    expect(visibility.rules).toEqual([{ id: 'rule-1', type: 'device_on', value: '', action: 'show' }]);
    expect(imported.importReport?.unresolvedBindings).toEqual([
      expect.objectContaining({ targetType: 'device', widgetId: imported.tabs[0].widgets[0].id }),
    ]);
  });

  it.each([
    { title: 'Control', tabs: [null] },
    { title: 'Control', tabs: [{ id: 'tab', title: 'Sala' }] },
    { title: 'Control', tabs: [{ id: 'tab', title: 'Sala', widgets: [null] }] },
    { title: 'Control', tabs: [{ id: 'tab', title: 'Sala', widgets: [{ id: 'widget', type: 'room_summary', config: null }] }] },
  ])('rejects a malformed transfer structure with a controlled import error', async (dashboard) => {
    const service = new DashboardService(createDashboardRepository(null), createHomeRepository());
    await expect(service.importDashboard('user-1', {
      format: DASHBOARD_TRANSFER_FORMAT,
      version: DASHBOARD_TRANSFER_VERSION,
      dashboard,
    })).rejects.toThrow('DASHBOARD_IMPORT_INVALID');
  });

  it('rejects duplicate tab IDs and unknown bundled background IDs', async () => {
    const service = new DashboardService(createDashboardRepository(null), createHomeRepository());
    const transfer = (tabs: unknown[]) => ({
      format: DASHBOARD_TRANSFER_FORMAT, version: DASHBOARD_TRANSFER_VERSION,
      dashboard: { title: 'Control', tabs },
    });
    await expect(service.importDashboard('user-1', transfer([
      { id: 'same', title: 'Uno', widgets: [] }, { id: 'same', title: 'Dos', widgets: [] },
    ]))).rejects.toThrow('DASHBOARD_IMPORT_INVALID');
    await expect(service.importDashboard('user-1', transfer([
      { id: 'tab', title: 'Uno', widgets: [], backgroundPresetId: 'unknown-preset' },
    ]))).rejects.toThrow('DASHBOARD_IMPORT_INVALID');
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
