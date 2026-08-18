import { EventEmitter } from 'events';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { MediaService } from '../../../packages/shared/infrastructure/MediaService';
import { DashboardRoutes } from '../routes/DashboardRoutes';

class MockResponse extends EventEmitter {
  public readonly writeHead = jest.fn().mockReturnThis();
  public readonly end = jest.fn().mockReturnThis();

  public setHeader(): this {
    return this;
  }
}

function createRequest(body?: unknown): HomePilotRequest {
  const request = new EventEmitter() as HomePilotRequest;
  request.url = '/api/v1/dashboards';
  request.headers = { host: 'localhost' };
  request.socket = { remoteAddress: '127.0.0.1' } as HomePilotRequest['socket'];
  request.user = { id: 'owner-1', username: 'owner', role: 'admin', displayName: 'Owner', avatarDataUri: null };
  request._fastifyParsedBody = body === undefined ? undefined : JSON.stringify(body);
  return request;
}

function createContainer(isAuthorized = true): BootstrapContainer {
  return {
    guards: { authGuard: { protect: jest.fn().mockResolvedValue(isAuthorized) } },
    services: {
      dashboardService: {
        getDashboardsForUser: jest.fn().mockResolvedValue([]),
        createDashboard: jest.fn().mockResolvedValue({ id: 'dashboard-1', ownerId: 'owner-1', title: 'Main' }),
        exportDashboard: jest.fn().mockResolvedValue({ version: 1 }),
      },
    },
  } as unknown as BootstrapContainer;
}

function createMediaService(): MediaService {
  return {
    deleteTabBackground: jest.fn(),
    saveTabBackground: jest.fn(),
    deleteDashboardBackgrounds: jest.fn(),
  } as unknown as MediaService;
}

describe('Feature: dashboard route contract', () => {
  it('Scenario: Given an unauthenticated request When a dashboard is requested Then the route does not call the dashboard service', async () => {
    const routes = new DashboardRoutes(createMediaService());
    const container = createContainer(false);

    await routes.handle(createRequest(), new MockResponse() as unknown as http.ServerResponse, '/api/v1/dashboards', 'GET', container);

    expect(container.services.dashboardService.getDashboardsForUser).not.toHaveBeenCalled();
  });

  it('Scenario: Given a missing title When creating a dashboard Then validation rejects it before persistence', async () => {
    const routes = new DashboardRoutes(createMediaService());
    const container = createContainer();
    const response = new MockResponse();

    await routes.handle(createRequest({}), response as unknown as http.ServerResponse, '/api/v1/dashboards', 'POST', container);

    expect(container.services.dashboardService.createDashboard).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('VALIDATION_ERROR'));
  });

  it('Scenario: Given a valid title When creating a dashboard Then the current user becomes its owner', async () => {
    const routes = new DashboardRoutes(createMediaService());
    const container = createContainer();
    const response = new MockResponse();

    await routes.handle(createRequest({ title: 'Main' }), response as unknown as http.ServerResponse, '/api/v1/dashboards', 'POST', container);

    expect(container.services.dashboardService.createDashboard).toHaveBeenCalledWith('owner-1', 'Main');
    expect(response.writeHead).toHaveBeenCalledWith(201, expect.any(Object));
  });

  it('Scenario: Given a forbidden export When exporting another dashboard Then the route preserves the authorization response', async () => {
    const routes = new DashboardRoutes(createMediaService());
    const container = createContainer();
    container.services.dashboardService.exportDashboard = jest.fn().mockRejectedValue(new Error('FORBIDDEN'));
    const response = new MockResponse();

    await routes.handle(createRequest(), response as unknown as http.ServerResponse, '/api/v1/dashboards/other/export', 'GET', container);

    expect(response.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('FORBIDDEN'));
  });
  it('Scenario: Given an owner without a dashboard When listing dashboards Then it creates and returns the owner dashboard', async () => {
    const routes = new DashboardRoutes(createMediaService());
    const container = createContainer();
    const dashboard = { id: 'dashboard-1', ownerId: 'owner-1', title: 'Owner', tabs: [] };
    (container.services.dashboardService.getDashboardsForUser as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([dashboard]);
    const response = new MockResponse();

    await routes.handle(createRequest(), response as unknown as http.ServerResponse, '/api/v1/dashboards', 'GET', container);

    expect(container.services.dashboardService.createDashboard).toHaveBeenCalledWith('owner-1', 'Owner');
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('"dashboard-1"'));
  });

  it('Scenario: Given an import package When importing it Then it delegates it to the authenticated owner', async () => {
    const routes = new DashboardRoutes(createMediaService());
    const container = createContainer();
    const transfer = { version: 1, dashboard: { title: 'Imported', tabs: [] } };
    container.services.dashboardService.importDashboard = jest.fn().mockResolvedValue({ id: 'imported-1' });
    const response = new MockResponse();

    await routes.handle(createRequest(transfer), response as unknown as http.ServerResponse, '/api/v1/dashboards/import', 'POST', container);

    expect(container.services.dashboardService.importDashboard).toHaveBeenCalledWith('owner-1', transfer);
    expect(response.writeHead).toHaveBeenCalledWith(201, expect.any(Object));
  });

  it('Scenario: Given dashboard revision requests When history is loaded and restored Then the owner receives both responses', async () => {
    const routes = new DashboardRoutes(createMediaService());
    const container = createContainer();
    container.services.dashboardService.getDashboardRevisions = jest.fn().mockResolvedValue([{ id: 'revision-1' }]);
    container.services.dashboardService.restoreDashboardRevision = jest.fn().mockResolvedValue({ id: 'dashboard-1' });
    const historyResponse = new MockResponse();
    const restoreResponse = new MockResponse();

    await routes.handle(createRequest(), historyResponse as unknown as http.ServerResponse, '/api/v1/dashboards/dashboard-1/history', 'GET', container);
    await routes.handle(createRequest(), restoreResponse as unknown as http.ServerResponse, '/api/v1/dashboards/dashboard-1/history/revision-1/restore', 'POST', container);

    expect(container.services.dashboardService.getDashboardRevisions).toHaveBeenCalledWith('owner-1', 'dashboard-1');
    expect(container.services.dashboardService.restoreDashboardRevision).toHaveBeenCalledWith('owner-1', 'dashboard-1', 'revision-1');
    expect(historyResponse.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(restoreResponse.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });

  it('Scenario: Given a dashboard with a removed background tab When updating it Then obsolete media is removed before persistence', async () => {
    const mediaService = createMediaService();
    const routes = new DashboardRoutes(mediaService);
    const container = createContainer();
    container.services.dashboardService.getOwnedDashboard = jest.fn().mockResolvedValue({
      id: 'dashboard-1',
      tabs: [{ id: 'tab-1', title: 'Old tab', widgets: [], background: '/media/old.jpg' }],
    });
    container.services.dashboardService.updateDashboard = jest.fn().mockResolvedValue({ id: 'dashboard-1' });
    const response = new MockResponse();

    await routes.handle(
      createRequest({ tabs: [{ id: 'tab-1', title: 'Old tab', widgets: [] }] }),
      response as unknown as http.ServerResponse,
      '/api/v1/dashboards/dashboard-1',
      'PATCH',
      container,
    );

    expect(mediaService.deleteTabBackground).toHaveBeenCalledWith('dashboard-1', 'tab-1');
    expect(container.services.dashboardService.updateDashboard).toHaveBeenCalledWith(
      'owner-1',
      'admin',
      'dashboard-1',
      expect.objectContaining({ tabs: expect.any(Array) }),
    );
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });
  it('Scenario: Given an invalid import package When importing it Then the route returns a validation error', async () => {
    const routes = new DashboardRoutes(createMediaService());
    const container = createContainer();
    container.services.dashboardService.importDashboard = jest.fn().mockRejectedValue(new Error('DASHBOARD_IMPORT_INVALID'));
    const response = new MockResponse();

    await routes.handle(createRequest({ version: 0 }), response as unknown as http.ServerResponse, '/api/v1/dashboards/import', 'POST', container);

    expect(response.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('DASHBOARD_IMPORT_INVALID'));
  });

  it('Scenario: Given an owned dashboard When deleting it Then related media is removed before the dashboard', async () => {
    const mediaService = createMediaService();
    const routes = new DashboardRoutes(mediaService);
    const container = createContainer();
    container.services.dashboardService.deleteDashboard = jest.fn().mockResolvedValue(undefined);
    const response = new MockResponse();

    await routes.handle(createRequest(), response as unknown as http.ServerResponse, '/api/v1/dashboards/dashboard-1', 'DELETE', container);

    expect(mediaService.deleteDashboardBackgrounds).toHaveBeenCalledWith('dashboard-1');
    expect(container.services.dashboardService.deleteDashboard).toHaveBeenCalledWith('owner-1', 'admin', 'dashboard-1');
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('"success":true'));
  });
});


  it('Scenario: Given a new inline tab background When the owner updates the dashboard Then it stores the media and persists its cache-busted local path', async () => {
    const media = createMediaService();
    (media.saveTabBackground as jest.Mock).mockResolvedValue('/media/dashboards/dashboard-1/tab-1.jpg');
    const routes = new DashboardRoutes(media);
    const container = createContainer();
    container.services.dashboardService.getOwnedDashboard = jest.fn().mockResolvedValue({ id: 'dashboard-1', tabs: [] });
    container.services.dashboardService.updateDashboard = jest.fn().mockResolvedValue({ id: 'dashboard-1' });
    const response = new MockResponse();

    await routes.handle(
      createRequest({ tabs: [{ id: 'tab-1', title: 'Main', widgets: [], background: 'data:image/jpeg;base64,YmFja2dyb3VuZA==' }] }),
      response as unknown as http.ServerResponse,
      '/api/v1/dashboards/dashboard-1',
      'PATCH',
      container,
    );

    expect(media.saveTabBackground).toHaveBeenCalledWith('dashboard-1', 'tab-1', 'data:image/jpeg;base64,YmFja2dyb3VuZA==');
    expect(container.services.dashboardService.updateDashboard).toHaveBeenCalledWith(
      'owner-1', 'admin', 'dashboard-1', expect.objectContaining({
        tabs: [expect.objectContaining({ background: expect.stringMatching(/^\/media\/dashboards\/dashboard-1\/tab-1\.jpg\?v=\d+$/) })],
      }),
    );
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });describe('Feature: dashboard mutation failure contracts', () => {
  it('maps history and restore authorization failures to their public status codes', async () => {
    const routes = new DashboardRoutes(createMediaService());
    const container = createContainer();
    container.services.dashboardService.getDashboardRevisions = jest.fn().mockRejectedValue(new Error('DASHBOARD_NOT_FOUND'));
    container.services.dashboardService.restoreDashboardRevision = jest.fn().mockRejectedValue(new Error('FORBIDDEN'));

    const history = new MockResponse();
    await routes.handle(createRequest(), history as unknown as http.ServerResponse, '/api/v1/dashboards/missing/history', 'GET', container);
    expect(history.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(history.end).toHaveBeenCalledWith(expect.stringContaining('DASHBOARD_NOT_FOUND'));

    const restore = new MockResponse();
    await routes.handle(createRequest(), restore as unknown as http.ServerResponse, '/api/v1/dashboards/dashboard-1/history/revision-1/restore', 'POST', container);
    expect(restore.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    expect(restore.end).toHaveBeenCalledWith(expect.stringContaining('FORBIDDEN'));
  });

  it('keeps update and deletion errors within their existing public contracts', async () => {
    const media = createMediaService();
    const routes = new DashboardRoutes(media);
    const container = createContainer();
    container.services.dashboardService.updateDashboard = jest.fn().mockRejectedValue(new Error('DASHBOARD_NOT_FOUND'));
    const update = new MockResponse();
    await routes.handle(createRequest({ title: 'Changed' }), update as unknown as http.ServerResponse, '/api/v1/dashboards/missing', 'PATCH', container);
    expect(update.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(update.end).toHaveBeenCalledWith(expect.stringContaining('DASHBOARD_NOT_FOUND'));

    container.services.dashboardService.deleteDashboard = jest.fn().mockRejectedValue(new Error('FORBIDDEN'));
    const remove = new MockResponse();
    await routes.handle(createRequest(), remove as unknown as http.ServerResponse, '/api/v1/dashboards/dashboard-1', 'DELETE', container);
    expect(media.deleteDashboardBackgrounds).toHaveBeenCalledWith('dashboard-1');
    expect(remove.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    expect(remove.end).toHaveBeenCalledWith(expect.stringContaining('FORBIDDEN'));
  });
});
describe('Feature: dashboard list resilience contracts', () => {
  it('uses the account username when a user has no usable display name while provisioning the first dashboard', async () => {
    const routes = new DashboardRoutes(createMediaService());
    const container = createContainer();
    (container.services.dashboardService.getDashboardsForUser as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'owner-dashboard', ownerId: 'owner-1', title: 'owner', tabs: [] }]);
    const request = createRequest();
    request.user = { ...request.user!, displayName: '   ' };
    const response = new MockResponse();

    await routes.handle(request, response as unknown as http.ServerResponse, '/api/v1/dashboards', 'GET', container);

    expect(container.services.dashboardService.createDashboard).toHaveBeenCalledWith('owner-1', 'owner');
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });

  it('returns the stable dashboard error when loading the user inventory fails', async () => {
    const routes = new DashboardRoutes(createMediaService());
    const container = createContainer();
    (container.services.dashboardService.getDashboardsForUser as jest.Mock).mockRejectedValue(new Error('dashboard store unavailable'));
    const response = new MockResponse();

    await routes.handle(createRequest(), response as unknown as http.ServerResponse, '/api/v1/dashboards', 'GET', container);

    expect(response.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('DASHBOARD_ERROR'));
  });
});
describe('Feature: dashboard list ordering contracts', () => {
  it('keeps the current owner dashboard first and orders the remaining dashboards by title', async () => {
    const routes = new DashboardRoutes(createMediaService());
    const container = createContainer();
    const dashboards = [
      { id: 'shared-z', ownerId: 'other-user', title: 'Zulu', tabs: [] },
      { id: 'owner', ownerId: 'owner-1', title: 'Owner', tabs: [] },
      { id: 'shared-a', ownerId: 'other-user', title: 'Alpha', tabs: [] },
    ];
    (container.services.dashboardService.getDashboardsForUser as jest.Mock).mockResolvedValue(dashboards);
    const response = new MockResponse();

    await routes.handle(createRequest(), response as unknown as http.ServerResponse, '/api/v1/dashboards', 'GET', container);

    expect(container.services.dashboardService.createDashboard).not.toHaveBeenCalled();
    expect(JSON.parse(response.end.mock.calls[0][0] as string).map((item: { id: string }) => item.id)).toEqual(['owner', 'shared-a', 'shared-z']);
  });
});