import { EventEmitter } from 'events';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { ExecutionRoutes } from '../routes/ExecutionRoutes';

class MockResponse extends EventEmitter {
  public readonly writeHead = jest.fn().mockReturnThis();
  public readonly end = jest.fn().mockReturnThis();

  public setHeader(): this {
    return this;
  }
}

function createRequest(url: string): HomePilotRequest {
  const request = new EventEmitter() as HomePilotRequest;
  request.url = url;
  request.headers = { host: 'localhost' };
  request.socket = { remoteAddress: '127.0.0.1' } as HomePilotRequest['socket'];
  request.user = { id: 'admin-1', username: 'admin', role: 'admin', displayName: null, avatarDataUri: null };
  return request;
}

function createContainer(isAuthorized = true): BootstrapContainer {
  return {
    guards: { authGuard: { protect: jest.fn().mockResolvedValue(isAuthorized) } },
    repositories: {
      executionRecordRepository: {
        findRecent: jest.fn().mockResolvedValue([{ id: 'recent-1' }]),
        findBySource: jest.fn().mockResolvedValue([{ id: 'source-1' }]),
        findById: jest.fn().mockResolvedValue(null),
      },
    },
    services: {
      sceneExecutionService: { execute: jest.fn().mockResolvedValue({ executionId: 'retry-1', status: 'success' }) },
    },
  } as unknown as BootstrapContainer;
}

describe('Feature: execution history routes', () => {
  it('Scenario: Given an unauthenticated request When it targets execution history Then the route stops without querying persistence', async () => {
    const route = new ExecutionRoutes();
    const container = createContainer(false);

    await route.handle(createRequest('/api/v1/executions/recent'), new MockResponse() as unknown as http.ServerResponse, '/api/v1/executions/recent', 'GET', container);

    expect(container.guards.authGuard.protect).toHaveBeenCalled();
    expect(container.repositories.executionRecordRepository.findRecent).not.toHaveBeenCalled();
  });

  it('Scenario: Given an authenticated request When recent execution history is requested Then the route delegates the requested limit', async () => {
    const route = new ExecutionRoutes();
    const container = createContainer();
    const response = new MockResponse();

    await route.handle(createRequest('/api/v1/executions/recent?limit=10'), response as unknown as http.ServerResponse, '/api/v1/executions/recent', 'GET', container);

    expect(container.repositories.executionRecordRepository.findRecent).toHaveBeenCalledWith(10);
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(JSON.stringify([{ id: 'recent-1' }]));
  });

  it('Scenario: Given an invalid source type When filtered history is requested Then the route rejects it without querying persistence', async () => {
    const route = new ExecutionRoutes();
    const container = createContainer();
    const response = new MockResponse();

    await route.handle(createRequest('/api/v1/executions/invalid/id-1'), response as unknown as http.ServerResponse, '/api/v1/executions/invalid/id-1', 'GET', container);

    expect(container.repositories.executionRecordRepository.findBySource).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('INVALID_SOURCE_TYPE'));
  });

  it('Scenario: Given a failed recorded action When retry is requested Then the route executes one synthetic manual scene action', async () => {
    const route = new ExecutionRoutes();
    const container = createContainer();
    const record = {
      id: 'execution-1',
      actions: [{ status: 'failed', commandName: 'Turn on', deviceId: 'device-1', command: { type: 'turn_on' } }],
    };
    container.repositories.executionRecordRepository.findById = jest.fn().mockResolvedValue(record);
    const response = new MockResponse();

    await route.handle(createRequest('/api/v1/executions/execution-1/actions/0/retry'), response as unknown as http.ServerResponse, '/api/v1/executions/execution-1/actions/0/retry', 'POST', container);

    expect(container.services.sceneExecutionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'retry-from-execution-1',
        homeId: 'system',
        actions: [{ deviceId: 'device-1', command: { type: 'turn_on' } }],
      }),
      expect.objectContaining({ sourceType: 'manual', sourceId: 'retry:execution-1:0' }),
    );
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });

  it('Scenario: Given a valid source filter When history is requested Then it forwards the source and limit', async () => {
    const route = new ExecutionRoutes();
    const container = createContainer();

    await route.handle(createRequest('/api/v1/executions/automation/rule-1?limit=3'), new MockResponse() as unknown as http.ServerResponse, '/api/v1/executions/automation/rule-1', 'GET', container);

    expect(container.repositories.executionRecordRepository.findBySource).toHaveBeenCalledWith('automation', 'rule-1', 3);
  });

  it('Scenario: Given a retry of a nonfailed or malformed action When requested Then it refuses execution', async () => {
    const route = new ExecutionRoutes();
    const container = createContainer();
    const response = new MockResponse();
    container.repositories.executionRecordRepository.findById = jest.fn().mockResolvedValue({ id: 'execution-1', actions: [{ status: 'success', deviceId: 'device-1' }] });

    await route.handle(createRequest('/api/v1/executions/execution-1/actions/0/retry'), response as unknown as http.ServerResponse, '/api/v1/executions/execution-1/actions/0/retry', 'POST', container);

    expect(container.services.sceneExecutionService.execute).not.toHaveBeenCalled();
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('RETRY_NOT_ALLOWED'));
  });

  it('Scenario: Given a failed action without command history When retrying Then it reports missing command data', async () => {
    const route = new ExecutionRoutes();
    const container = createContainer();
    const response = new MockResponse();
    container.repositories.executionRecordRepository.findById = jest.fn().mockResolvedValue({ id: 'execution-1', actions: [{ status: 'failed', deviceId: 'device-1', commandName: 'Turn on' }] });

    await route.handle(createRequest('/api/v1/executions/execution-1/actions/0/retry'), response as unknown as http.ServerResponse, '/api/v1/executions/execution-1/actions/0/retry', 'POST', container);

    expect(container.services.sceneExecutionService.execute).not.toHaveBeenCalled();
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('MISSING_COMMAND'));
  });

  it('Scenario: Given a missing execution When retry is requested Then the route returns a not-found error', async () => {
    const route = new ExecutionRoutes();
    const container = createContainer();
    const response = new MockResponse();

    await route.handle(createRequest('/api/v1/executions/missing/actions/0/retry'), response as unknown as http.ServerResponse, '/api/v1/executions/missing/actions/0/retry', 'POST', container);

    expect(container.services.sceneExecutionService.execute).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('EXECUTION_NOT_FOUND'));
  });
});

describe('Feature: execution history failure contracts', () => {
  it('maps recent and source repository failures to the DB_ERROR response contract', async () => {
    const route = new ExecutionRoutes();
    const recentContainer = createContainer();
    recentContainer.repositories.executionRecordRepository.findRecent = jest.fn().mockRejectedValue(new Error('recent database unavailable'));
    const recentResponse = new MockResponse();

    await route.handle(createRequest('/api/v1/executions/recent'), recentResponse as unknown as http.ServerResponse, '/api/v1/executions/recent', 'GET', recentContainer);

    expect(recentResponse.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(recentResponse.end).toHaveBeenCalledWith(expect.stringContaining('DB_ERROR'));

    const sourceContainer = createContainer();
    sourceContainer.repositories.executionRecordRepository.findBySource = jest.fn().mockRejectedValue(new Error('source database unavailable'));
    const sourceResponse = new MockResponse();

    await route.handle(createRequest('/api/v1/executions/scene/scene-1'), sourceResponse as unknown as http.ServerResponse, '/api/v1/executions/scene/scene-1', 'GET', sourceContainer);

    expect(sourceResponse.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(sourceResponse.end).toHaveBeenCalledWith(expect.stringContaining('DB_ERROR'));
  });

  it('rejects absent action indexes and execution failures without retrying an action', async () => {
    const route = new ExecutionRoutes();
    const missingActionContainer = createContainer();
    missingActionContainer.repositories.executionRecordRepository.findById = jest.fn().mockResolvedValue({ id: 'execution-1', actions: [] });
    const missingActionResponse = new MockResponse();

    await route.handle(createRequest('/api/v1/executions/execution-1/actions/3/retry'), missingActionResponse as unknown as http.ServerResponse, '/api/v1/executions/execution-1/actions/3/retry', 'POST', missingActionContainer);

    expect(missingActionContainer.services.sceneExecutionService.execute).not.toHaveBeenCalled();
    expect(missingActionResponse.end).toHaveBeenCalledWith(expect.stringContaining('ACTION_NOT_FOUND'));

    const failingContainer = createContainer();
    failingContainer.repositories.executionRecordRepository.findById = jest.fn().mockResolvedValue({
      id: 'execution-1',
      actions: [{ status: 'failed', commandName: 'Turn on', deviceId: 'device-1', command: { type: 'turn_on' } }],
    });
    failingContainer.services.sceneExecutionService.execute = jest.fn().mockRejectedValue(new Error('dispatcher offline'));
    const failingResponse = new MockResponse();

    await route.handle(createRequest('/api/v1/executions/execution-1/actions/0/retry'), failingResponse as unknown as http.ServerResponse, '/api/v1/executions/execution-1/actions/0/retry', 'POST', failingContainer);

    expect(failingResponse.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(failingResponse.end).toHaveBeenCalledWith(expect.stringContaining('RETRY_ERROR'));
  });
});