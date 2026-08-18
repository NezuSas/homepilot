import { EventEmitter } from 'events';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { SystemRoutes } from '../routes/SystemRoutes';

class MockResponse extends EventEmitter {
  public readonly writeHead = jest.fn().mockReturnThis();
  public readonly end = jest.fn().mockReturnThis();

  public setHeader(): this {
    return this;
  }
}

function createRequest(): HomePilotRequest {
  const request = new EventEmitter() as HomePilotRequest;
  request.url = '/api/v1/system/diagnostics';
  request.headers = { host: 'localhost' };
  request.socket = { remoteAddress: '127.0.0.1' } as HomePilotRequest['socket'];
  request.user = { id: 'admin-1', username: 'admin', role: 'admin', displayName: null, avatarDataUri: null };
  return request;
}

function createContainer(isAuthenticated: boolean): BootstrapContainer {
  return {
    guards: {
      authGuard: {
        protect: jest.fn().mockResolvedValue(isAuthenticated),
      },
    },
    services: {
      diagnosticsService: {
        getSnapshot: jest.fn().mockResolvedValue({ overallStatus: 'healthy', issues: [] }),
        getRecentEvents: jest.fn().mockResolvedValue([{ eventType: 'AUTOMATION_EXECUTED' }]),
      },
    },
  } as unknown as BootstrapContainer;
}

describe('Feature: system diagnostics API', () => {
  it('Scenario: Given an unauthenticated request When diagnostics is requested Then the service is not exposed', async () => {
    const routes = new SystemRoutes();
    const container = createContainer(false);

    await routes.handle(createRequest(), new MockResponse() as unknown as http.ServerResponse, '/api/v1/system/diagnostics', 'GET', container);

    expect(container.guards.authGuard.protect).toHaveBeenCalledWith(expect.anything(), expect.anything(), true);
    expect(container.services.diagnosticsService.getSnapshot).not.toHaveBeenCalled();
  });

  it('Scenario: Given an authenticated request When the snapshot endpoint is requested Then it delegates to DiagnosticsService', async () => {
    const routes = new SystemRoutes();
    const container = createContainer(true);

    await routes.handle(createRequest(), new MockResponse() as unknown as http.ServerResponse, '/api/v1/system/diagnostics', 'GET', container);

    expect(container.services.diagnosticsService.getSnapshot).toHaveBeenCalledTimes(1);
  });

  it('Scenario: Given an authenticated request When the events endpoint is requested Then it limits the diagnostic timeline to fifty records', async () => {
    const routes = new SystemRoutes();
    const container = createContainer(true);

    await routes.handle(createRequest(), new MockResponse() as unknown as http.ServerResponse, '/api/v1/system/diagnostics/events', 'GET', container);

    expect(container.services.diagnosticsService.getRecentEvents).toHaveBeenCalledWith(50);
  });
});
function systemRequest(url: string, body?: unknown): HomePilotRequest {
  const request = createRequest();
  request.url = url;
  request._fastifyParsedBody = body === undefined ? undefined : JSON.stringify(body);
  return request;
}

function completeSystemContainer(overrides?: { protected?: boolean; admin?: boolean }): BootstrapContainer {
  return {
    guards: {
      authGuard: {
        protect: jest.fn().mockResolvedValue(overrides?.protected ?? true),
        requireRole: jest.fn().mockReturnValue(overrides?.admin ?? true),
      },
    },
    services: {
      systemSetupService: { getSetupStatus: jest.fn().mockResolvedValue({ hasAdminUser: false }), completeOnboarding: jest.fn().mockResolvedValue(undefined) },
      authService: { bootstrapFirstAdmin: jest.fn().mockResolvedValue({ token: 'token-1', user: { id: 'admin-1', username: 'admin', displayName: null, avatarDataUri: null, role: 'admin', isActive: true } }) },
      diagnosticsService: { getSnapshot: jest.fn(), getRecentEvents: jest.fn() },
      systemVariableService: { getSystemTimezone: jest.fn().mockResolvedValue('America/Guayaquil'), set: jest.fn().mockResolvedValue(undefined) },
      databaseBackupService: { listBackups: jest.fn().mockResolvedValue([{ id: 'backup-1' }]), createBackup: jest.fn().mockResolvedValue({ success: true, backup: { id: 'backup-1' } }) },
    },
    repositories: { activityLogRepository: { saveActivity: jest.fn().mockResolvedValue(undefined) } },
  } as unknown as BootstrapContainer;
}

describe('Feature: system setup and appliance management routes', () => {
  const routes = new SystemRoutes();

  it('keeps health public and makes setup status protected only after an admin exists', async () => {
    const healthResponse = new MockResponse();
    await routes.handle(systemRequest('/health'), healthResponse as unknown as http.ServerResponse, '/health', 'GET', completeSystemContainer());
    expect(healthResponse.end).toHaveBeenCalledWith(expect.stringContaining('"ok"'));

    const firstRun = completeSystemContainer();
    const firstResponse = new MockResponse();
    await routes.handle(systemRequest('/api/v1/system/setup-status'), firstResponse as unknown as http.ServerResponse, '/api/v1/system/setup-status', 'GET', firstRun);
    expect(firstRun.guards.authGuard.protect).not.toHaveBeenCalled();

    const configured = completeSystemContainer({ protected: false });
    (configured.services.systemSetupService.getSetupStatus as jest.Mock).mockResolvedValue({ hasAdminUser: true });
    await routes.handle(systemRequest('/api/v1/system/setup-status'), new MockResponse() as unknown as http.ServerResponse, '/api/v1/system/setup-status', 'GET', configured);
    expect(configured.guards.authGuard.protect).toHaveBeenCalled();
  });

  it('validates bootstrap input, returns conflicts, and records successful first admin setup', async () => {
    const container = completeSystemContainer();
    const invalid = new MockResponse();
    await routes.handle(systemRequest('/api/v1/system/bootstrap-admin', {}), invalid as unknown as http.ServerResponse, '/api/v1/system/bootstrap-admin', 'POST', container);
    expect(invalid.end).toHaveBeenCalledWith(expect.stringContaining('INVALID_INPUT'));

    const conflict = completeSystemContainer();
    (conflict.services.authService.bootstrapFirstAdmin as jest.Mock).mockResolvedValue(null);
    const conflictResponse = new MockResponse();
    await routes.handle(systemRequest('/api/v1/system/bootstrap-admin', { username: 'admin', password: 'long-enough-password' }), conflictResponse as unknown as http.ServerResponse, '/api/v1/system/bootstrap-admin', 'POST', conflict);
    expect(conflictResponse.end).toHaveBeenCalledWith(expect.stringContaining('ADMIN_ALREADY_EXISTS'));

    const success = completeSystemContainer();
    const successResponse = new MockResponse();
    await routes.handle(systemRequest('/api/v1/system/bootstrap-admin', { username: 'admin', password: 'long-enough-password' }), successResponse as unknown as http.ServerResponse, '/api/v1/system/bootstrap-admin', 'POST', success);
    expect(success.repositories.activityLogRepository.saveActivity).toHaveBeenCalledWith(expect.objectContaining({ type: 'ONBOARDING_STARTED' }));
    expect(successResponse.end).toHaveBeenCalledWith(expect.stringContaining('token-1'));
  });

  it('protects onboarding completion and maps appliance errors', async () => {
    const unauthenticated = completeSystemContainer({ protected: false });
    await routes.handle(systemRequest('/api/v1/system/setup-status/complete'), new MockResponse() as unknown as http.ServerResponse, '/api/v1/system/setup-status/complete', 'POST', unauthenticated);
    expect(unauthenticated.services.systemSetupService.completeOnboarding).not.toHaveBeenCalled();

    const error = completeSystemContainer();
    (error.services.systemSetupService.completeOnboarding as jest.Mock).mockRejectedValue(new Error('UNREACHABLE'));
    const response = new MockResponse();
    await routes.handle(systemRequest('/api/v1/system/setup-status/complete'), response as unknown as http.ServerResponse, '/api/v1/system/setup-status/complete', 'POST', error);
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('HA_UNREACHABLE'));
  });

  it('gets and sets time zone with authorization and validation', async () => {
    const container = completeSystemContainer();
    const getResponse = new MockResponse();
    await routes.handle(systemRequest('/api/v1/system/timezone'), getResponse as unknown as http.ServerResponse, '/api/v1/system/timezone', 'GET', container);
    expect(getResponse.end).toHaveBeenCalledWith(expect.stringContaining('America/Guayaquil'));

    const invalid = new MockResponse();
    await routes.handle(systemRequest('/api/v1/system/timezone', {}), invalid as unknown as http.ServerResponse, '/api/v1/system/timezone', 'POST', container);
    expect(invalid.end).toHaveBeenCalledWith(expect.stringContaining('TIMEZONE_UPDATE_ERROR'));

    await routes.handle(systemRequest('/api/v1/system/timezone', { timezone: 'UTC' }), new MockResponse() as unknown as http.ServerResponse, '/api/v1/system/timezone', 'POST', container);
    expect(container.services.systemVariableService.set).toHaveBeenCalledWith(expect.objectContaining({ value: 'UTC', name: 'system_timezone' }));
  });

  it('protects backups and maps list/create outcomes', async () => {
    const container = completeSystemContainer();
    const list = new MockResponse();
    await routes.handle(systemRequest('/api/v1/system/backups'), list as unknown as http.ServerResponse, '/api/v1/system/backups', 'GET', container);
    expect(list.end).toHaveBeenCalledWith(expect.stringContaining('backup-1'));

    (container.services.databaseBackupService.createBackup as jest.Mock).mockResolvedValue({ success: false, error: 'disk full' });
    const failedCreate = new MockResponse();
    await routes.handle(systemRequest('/api/v1/system/backups'), failedCreate as unknown as http.ServerResponse, '/api/v1/system/backups', 'POST', container);
    expect(failedCreate.end).toHaveBeenCalledWith(expect.stringContaining('BACKUP_CREATE_ERROR'));

    await expect(routes.handle(systemRequest('/unhandled'), new MockResponse() as unknown as http.ServerResponse, '/unhandled', 'GET', container)).resolves.toBe(false);
  });
});

describe('Feature: system route edge failure contracts', () => {
  it('maps setup status, diagnostics events, and bootstrap fallback failures to stable API errors', async () => {
    const routes = new SystemRoutes();

    const setup = completeSystemContainer();
    (setup.services.systemSetupService.getSetupStatus as jest.Mock).mockRejectedValue(new Error('database unavailable'));
    const setupResponse = new MockResponse();
    await routes.handle(systemRequest('/api/v1/system/setup-status'), setupResponse as unknown as http.ServerResponse, '/api/v1/system/setup-status', 'GET', setup);
    expect(setupResponse.end).toHaveBeenCalledWith(expect.stringContaining('SETUP_STATUS_ERROR'));

    const events = completeSystemContainer();
    (events.services.diagnosticsService.getRecentEvents as jest.Mock).mockRejectedValue(new Error('timeline unavailable'));
    const eventsResponse = new MockResponse();
    await routes.handle(systemRequest('/api/v1/system/diagnostics/events'), eventsResponse as unknown as http.ServerResponse, '/api/v1/system/diagnostics/events', 'GET', events);
    expect(eventsResponse.end).toHaveBeenCalledWith(expect.stringContaining('DIAGNOSTICS_EVENTS_ERROR'));

    const bootstrap = completeSystemContainer();
    (bootstrap.services.authService.bootstrapFirstAdmin as jest.Mock).mockRejectedValue(new Error('persistence unavailable'));
    const bootstrapResponse = new MockResponse();
    await routes.handle(systemRequest('/api/v1/system/bootstrap-admin', { username: 'admin', password: 'long-enough-password' }), bootstrapResponse as unknown as http.ServerResponse, '/api/v1/system/bootstrap-admin', 'POST', bootstrap);
    expect(bootstrapResponse.end).toHaveBeenCalledWith(expect.stringContaining('BOOTSTRAP_ADMIN_ERROR'));
  });

  it('maps all onboarding configuration failures and protects administrator-only mutations', async () => {
    const routes = new SystemRoutes();
    for (const [message, code] of [
      ['NO_CONFIG', 'HA_CONFIG_MISSING'],
      ['AUTH_ERROR', 'HA_AUTH_ERROR'],
      ['unexpected failure', 'INTERNAL_ERROR'],
    ]) {
      const container = completeSystemContainer();
      (container.services.systemSetupService.completeOnboarding as jest.Mock).mockRejectedValue(new Error(message));
      const response = new MockResponse();
      await routes.handle(systemRequest('/api/v1/system/setup-status/complete'), response as unknown as http.ServerResponse, '/api/v1/system/setup-status/complete', 'POST', container);
      expect(response.end).toHaveBeenCalledWith(expect.stringContaining(code));
    }

    const nonAdmin = completeSystemContainer({ admin: false });
    await routes.handle(systemRequest('/api/v1/system/backups'), new MockResponse() as unknown as http.ServerResponse, '/api/v1/system/backups', 'POST', nonAdmin);
    expect(nonAdmin.services.databaseBackupService.createBackup).not.toHaveBeenCalled();
  });
});
describe('Feature: system service failure contracts', () => {
  it('maps diagnostics and timezone read failures to their public error codes', async () => {
    const routes = new SystemRoutes();
    const diagnostics = completeSystemContainer();
    (diagnostics.services.diagnosticsService.getSnapshot as jest.Mock).mockRejectedValue(new Error('collector unavailable'));
    const diagnosticsResponse = new MockResponse();
    await routes.handle(systemRequest('/api/v1/system/diagnostics'), diagnosticsResponse as unknown as http.ServerResponse, '/api/v1/system/diagnostics', 'GET', diagnostics);
    expect(diagnosticsResponse.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(diagnosticsResponse.end).toHaveBeenCalledWith(expect.stringContaining('DIAGNOSTICS_ERROR'));

    const timezone = completeSystemContainer();
    (timezone.services.systemVariableService.getSystemTimezone as jest.Mock).mockRejectedValue(new Error('store unavailable'));
    const timezoneResponse = new MockResponse();
    await routes.handle(systemRequest('/api/v1/system/timezone'), timezoneResponse as unknown as http.ServerResponse, '/api/v1/system/timezone', 'GET', timezone);
    expect(timezoneResponse.end).toHaveBeenCalledWith(expect.stringContaining('TIMEZONE_GET_ERROR'));
  });

  it('maps bootstrap validation and backup service failures without changing their route contract', async () => {
    const routes = new SystemRoutes();
    const invalidUsername = completeSystemContainer();
    (invalidUsername.services.authService.bootstrapFirstAdmin as jest.Mock).mockRejectedValue(new Error('INVALID_USERNAME'));
    const usernameResponse = new MockResponse();
    await routes.handle(systemRequest('/api/v1/system/bootstrap-admin', { username: 'x', password: 'long-enough-password' }), usernameResponse as unknown as http.ServerResponse, '/api/v1/system/bootstrap-admin', 'POST', invalidUsername);
    expect(usernameResponse.end).toHaveBeenCalledWith(expect.stringContaining('INVALID_USERNAME'));

    const weakPassword = completeSystemContainer();
    (weakPassword.services.authService.bootstrapFirstAdmin as jest.Mock).mockRejectedValue(new Error('WEAK_PASSWORD'));
    const passwordResponse = new MockResponse();
    await routes.handle(systemRequest('/api/v1/system/bootstrap-admin', { username: 'admin', password: 'weak' }), passwordResponse as unknown as http.ServerResponse, '/api/v1/system/bootstrap-admin', 'POST', weakPassword);
    expect(passwordResponse.end).toHaveBeenCalledWith(expect.stringContaining('WEAK_PASSWORD'));

    const backup = completeSystemContainer();
    (backup.services.databaseBackupService.listBackups as jest.Mock).mockRejectedValue(new Error('storage unavailable'));
    const backupResponse = new MockResponse();
    await routes.handle(systemRequest('/api/v1/system/backups'), backupResponse as unknown as http.ServerResponse, '/api/v1/system/backups', 'GET', backup);
    expect(backupResponse.end).toHaveBeenCalledWith(expect.stringContaining('BACKUP_LIST_ERROR'));
  });
});