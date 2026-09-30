import {
  Dashboard,
  DashboardRepository,
  DashboardRevision,
  DashboardRevisionSnapshot,
  DashboardTab,
  DashboardTransferPackage,
  DashboardImportBindingResolver,
  DashboardImportReport,
  DashboardImportResponse,
  DashboardVisibility,
  DASHBOARD_TRANSFER_FORMAT,
  DASHBOARD_TRANSFER_VERSION,
} from '../domain/Dashboard';
import { HomeRepository } from '../domain/repositories/HomeRepository';
import {
  getDashboardBackgroundPreset,
  getDashboardBackgroundPresetIdBySource,
  isDashboardBackgroundPresetId,
} from '../domain/DashboardBackgroundPresets';
import { randomUUID } from 'crypto';
import { normalizeImportedWidgets } from './DashboardImportNormalizer';

export class DashboardService {
  constructor(
    private readonly dashboardRepository: DashboardRepository,
    private readonly homeRepository: HomeRepository,
    private readonly importBindingResolver?: DashboardImportBindingResolver,
  ) {}

  public async getDashboardsForUser(userId: string, userRole: string): Promise<Dashboard[]> {
    const homes = await this.homeRepository.findHomesByUserId(userId);
    const homeIds = homes.map(h => h.id);
    const dashboards = await this.dashboardRepository.findAllVisibleTo(userId, userRole, homeIds);
    return dashboards.map((dashboard) => {
      if (dashboard.ownerId === userId) return dashboard;

      const hasTabVisibility = dashboard.tabs.some((tab) => tab.visibility !== undefined);
      if (!hasTabVisibility) return dashboard;

      return {
        ...dashboard,
        tabs: dashboard.tabs.filter((tab) => tab.visibility?.users.includes(userId)),
      };
    }).filter((dashboard) => dashboard.ownerId === userId || dashboard.tabs.length > 0);
  }

  public async createDashboard(userId: string, title: string): Promise<Dashboard> {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) throw new Error('DASHBOARD_TITLE_REQUIRED');
    const owned = (await this.dashboardRepository.findAllVisibleTo(userId, '', []))
      .filter((candidate) => candidate.ownerId === userId);
    if (owned.length > 0) throw new Error('DASHBOARD_OWNER_EXISTS');
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
        tabs: dashboard.tabs.map(tab => {
          const presetId = getDashboardBackgroundPresetIdBySource(tab.background);
          return {
            id: tab.id,
            title: tab.title,
            widgets: tab.widgets,
            sectionLayout: tab.sectionLayout,
            icon: tab.icon,
            isDefault: tab.isDefault === true,
            ...(presetId ? { backgroundPresetId: presetId, backgroundOpacity: tab.backgroundOpacity } : {}),
            ...(tab.background && !presetId ? { backgroundUnavailable: true as const } : {}),
          };
        }),
      },
    };
  }

  public async importDashboard(userId: string, transfer: unknown, language = 'es'): Promise<DashboardImportResponse> {
    if (!isDashboardTransferPackage(transfer)) {
      throw new Error('DASHBOARD_IMPORT_INVALID');
    }
    if (transfer.version !== DASHBOARD_TRANSFER_VERSION) {
      throw new Error('DASHBOARD_IMPORT_UNSUPPORTED_VERSION');
    }

    const sourceTitle = transfer.dashboard.title.trim();
    if (!sourceTitle || transfer.dashboard.tabs.length === 0) {
      throw new Error('DASHBOARD_IMPORT_INVALID');
    }
    if (new Set(transfer.dashboard.tabs.map((tab) => tab.id)).size !== transfer.dashboard.tabs.length
      || transfer.dashboard.tabs.some((tab) => new Set(tab.widgets.map((widget) => widget.id)).size !== tab.widgets.length)) {
      throw new Error('DASHBOARD_IMPORT_INVALID');
    }

    const visibleDashboards = await this.dashboardRepository.findAllVisibleTo(userId, '', []);
    const ownedDashboards = visibleDashboards.filter((candidate) => candidate.ownerId === userId);
    if (ownedDashboards.length > 1) throw new Error('DASHBOARD_OWNER_CONFLICT');
    if (transfer.dashboard.tabs.filter((tab) => tab.isDefault).length > 1) {
      throw new Error('DASHBOARD_MULTIPLE_DEFAULT_TABS');
    }
    const existingTitles = new Set(visibleDashboards.map((dashboard) => dashboard.title.trim().toLowerCase()));
    const suffix = language.toLowerCase().startsWith('en') ? 'Imported' : 'Importado';
    let title = sourceTitle;
    if (existingTitles.has(title.toLowerCase())) {
      title = `${sourceTitle} · ${suffix}`;
      for (let number = 2; existingTitles.has(title.toLowerCase()); number += 1) {
        title = `${sourceTitle} · ${suffix} ${number}`;
      }
    }

    const report: DashboardImportReport = { unresolvedBindings: [], nonPortableBackgrounds: 0 };
    const authorizedHomeIds = new Set((await this.homeRepository.findHomesByUserId(userId)).map((home) => home.id));
    const tabIds = new Map(transfer.dashboard.tabs.map((tab) => [tab.id, randomUUID()]));
    const tabs = await Promise.all(transfer.dashboard.tabs.map(async (tab) => {
      const widgetIds = new Map(tab.widgets.map((widget) => [widget.id, randomUUID()]));
      const legacyBackground = (tab as unknown as Record<string, unknown>).background;
      const presetId = tab.backgroundPresetId
        ?? (typeof legacyBackground === 'string' ? getDashboardBackgroundPresetIdBySource(legacyBackground) : undefined);
      if (presetId !== undefined && !isDashboardBackgroundPresetId(presetId)) throw new Error('DASHBOARD_IMPORT_INVALID');
      if (tab.backgroundUnavailable === true || (typeof legacyBackground === 'string' && !presetId)) {
        report.nonPortableBackgrounds += 1;
      }
      const { backgroundPresetId: _presetId, backgroundUnavailable: _unavailable, ...portableTab } = tab;
      return {
        ...portableTab,
        id: tabIds.get(tab.id)!,
        sectionLayout: tab.sectionLayout && Object.fromEntries(Object.entries(tab.sectionLayout).map(([key, slots]) => [
          key, slots?.map((id) => id === null ? null : widgetIds.get(id) ?? null),
        ])),
        background: presetId ? getDashboardBackgroundPreset(presetId)?.src : undefined,
        backgroundOpacity: presetId && typeof tab.backgroundOpacity === 'number'
          && Number.isFinite(tab.backgroundOpacity) && tab.backgroundOpacity >= 0 && tab.backgroundOpacity <= 100
          ? tab.backgroundOpacity : undefined,
        visibility: undefined,
        isDefault: tab.isDefault === true,
        widgets: await normalizeImportedWidgets(
          tab.widgets, tab.title, authorizedHomeIds, tabIds, this.importBindingResolver, report, widgetIds,
        ),
      };
    }));
    const now = new Date().toISOString();
    const owned = ownedDashboards[0];
    const importedHasDefault = tabs.some((tab) => tab.isDefault);
    const dashboard: Dashboard = owned ? {
      ...owned,
      tabs: [
        ...owned.tabs.map((tab) => importedHasDefault ? { ...tab, isDefault: false } : tab),
        ...tabs,
      ],
      updatedAt: now,
    } : {
      id: randomUUID(),
      ownerId: userId,
      title,
      visibility: { roles: [], users: [userId], homes: [] },
      tabs,
      createdAt: now,
      updatedAt: now,
    };
    if (owned) {
      dashboard.visibility = createVisibilityForTabs(userId, dashboard.tabs, owned.visibility);
      await this.dashboardRepository.saveRevision({
        id: randomUUID(),
        dashboardId: owned.id,
        createdAt: now,
        snapshot: createRevisionSnapshot(owned),
      });
    }

    await this.dashboardRepository.saveDashboard(dashboard);
    return { ...dashboard, importReport: report };
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
    if (updates.tabs && updates.tabs.filter((tab) => tab.isDefault).length > 1) {
      throw new Error('DASHBOARD_MULTIPLE_DEFAULT_TABS');
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
      visibility: updates.tabs
        ? createVisibilityForTabs(dashboard.ownerId, updates.tabs, updates.visibility ?? dashboard.visibility)
        : updates.visibility ?? dashboard.visibility,
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
    if (restored.tabs.filter((tab) => tab.isDefault).length > 1) {
      throw new Error('DASHBOARD_MULTIPLE_DEFAULT_TABS');
    }

    await this.dashboardRepository.saveRevision({
      id: randomUUID(),
      dashboardId: dashboard.id,
      createdAt: now,
      snapshot: createRevisionSnapshot(dashboard),
    });
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
    throw new Error('DASHBOARD_OWNED_REQUIRED');
  }
}

function createVisibilityForTabs(
  ownerId: string,
  tabs: DashboardTab[],
  existingVisibility: DashboardVisibility,
): DashboardVisibility {
  const sharedUsers = new Set<string>([ownerId]);
  for (const tab of tabs) {
    for (const userId of tab.visibility?.users ?? []) {
      sharedUsers.add(userId);
    }
  }

  return {
    ...existingVisibility,
    users: [...sharedUsers],
  };
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
    && candidate.dashboard !== null
    && typeof candidate.dashboard === 'object'
    && !Array.isArray(candidate.dashboard)
    && typeof candidate.dashboard?.title === 'string'
    && Array.isArray(candidate.dashboard?.tabs)
    && candidate.dashboard.tabs.every((tab) =>
      tab !== null
      && typeof tab === 'object'
      && !Array.isArray(tab)
      && typeof tab.id === 'string' && Boolean(tab.id.trim())
      && typeof tab.title === 'string' && Boolean(tab.title.trim())
      && (tab.backgroundPresetId === undefined || (typeof tab.backgroundPresetId === 'string' && Boolean(tab.backgroundPresetId.trim())))
      && (tab.backgroundUnavailable === undefined || tab.backgroundUnavailable === true)
      && (tab.isDefault === undefined || typeof tab.isDefault === 'boolean')
      && (tab.sectionLayout === undefined || (tab.sectionLayout !== null
        && typeof tab.sectionLayout === 'object' && !Array.isArray(tab.sectionLayout)
        && Object.entries(tab.sectionLayout).every(([key, slots]) =>
          /^columns[1-4]$/.test(key) && Array.isArray(slots)
          && slots.length <= 200 && slots.every((id) => id === null || typeof id === 'string'))))
      && (tab.backgroundOpacity === undefined || (typeof tab.backgroundOpacity === 'number' && Number.isFinite(tab.backgroundOpacity) && tab.backgroundOpacity >= 0 && tab.backgroundOpacity <= 100))
      && Array.isArray(tab.widgets)
      && tab.widgets.every((widget) =>
        widget !== null
        && typeof widget === 'object'
        && !Array.isArray(widget)
        && typeof widget.id === 'string' && Boolean(widget.id.trim())
        && typeof widget.type === 'string' && Boolean(widget.type.trim())
        && widget.config !== null
        && typeof widget.config === 'object'
        && !Array.isArray(widget.config)));
}
