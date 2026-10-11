import { EventEmitter } from 'events';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { AssistantRoutes } from '../routes/AssistantRoutes';
import { DeviceRoutes } from '../routes/DeviceRoutes';
import { SceneRoutes } from '../routes/SceneRoutes';
import { TopologyRoutes } from '../routes/TopologyRoutes';

class MockResponse extends EventEmitter {
  public readonly writeHead = jest.fn().mockReturnThis();
  public readonly end = jest.fn().mockReturnThis();
  public setHeader(): this { return this; }
  public body(): unknown { return JSON.parse(String(this.end.mock.calls[0]?.[0] ?? 'null')); }
}

const GUEST = { id: 'guest-1', username: 'visita', role: 'guest' as const, displayName: null, avatarDataUri: null, accessScope: 'rooms' as const, roomIds: ['sala'] };
const PARENT = { id: 'parent-1', username: 'mama', role: 'parent' as const, displayName: null, avatarDataUri: null, accessScope: 'all' as const, roomIds: [] };

function createRequest(url: string, user: NonNullable<HomePilotRequest['user']> = GUEST, body: unknown = {}): HomePilotRequest {
  const request = new EventEmitter() as HomePilotRequest;
  request.url = url;
  request.headers = { host: 'localhost' };
  request.socket = { remoteAddress: '127.0.0.1' } as HomePilotRequest['socket'];
  request.user = user;
  request._fastifyParsedBody = JSON.stringify(body);
  return request;
}

const home = { id: 'home-1', ownerId: 'admin-1', name: 'Casa' };
const device = (id: string, roomId: string | null) => ({
  id, homeId: 'home-1', roomId, name: id, type: 'light', vendor: 'test', externalId: `ha:light.${id}`, status: roomId ? 'ASSIGNED' : 'PENDING',
  lastKnownState: null, invertState: false, entityVersion: 1, createdAt: '2026-10-11T00:00:00.000Z', updatedAt: '2026-10-11T00:00:00.000Z',
});
const devices = [device('light-sala', 'sala'), device('light-cocina', 'cocina'), device('light-inbox', null)];
const rooms = [{ id: 'sala', homeId: 'home-1', name: 'Sala' }, { id: 'cocina', homeId: 'home-1', name: 'Cocina' }];
const sceneAction = (deviceId: string) => ({ deviceId, command: { name: 'turn_on', params: {} } });
const scene = (id: string, deviceIds: string[]) => ({
  id, homeId: 'home-1', userId: 'admin-1', roomId: null, name: id, sharedUserIds: ['guest-1', 'parent-1'],
  actions: deviceIds.map(sceneAction), createdAt: '2026-10-11T00:00:00.000Z', updatedAt: '2026-10-11T00:00:00.000Z',
});
const scenes = [scene('s-sala', ['light-sala']), scene('s-cocina', ['light-cocina']), scene('s-mixta', ['light-sala', 'light-cocina'])];

function createContainer(): BootstrapContainer {
  return {
    guards: { authGuard: { protect: jest.fn().mockResolvedValue(true), requireRole: jest.fn().mockReturnValue(true) } },
    repositories: {
      homeRepository: {
        findHomesByUserId: jest.fn().mockResolvedValue([home]),
        findAll: jest.fn().mockResolvedValue([home]),
        findHomeById: jest.fn().mockResolvedValue(home),
      },
      deviceRepository: {
        findAllOrderedByStatus: jest.fn().mockResolvedValue(devices),
        findAllByHomeId: jest.fn().mockResolvedValue(devices),
        findDeviceById: jest.fn(async (id: string) => devices.find((item) => item.id === id) ?? null),
      },
      roomRepository: {
        findRoomsByHomeId: jest.fn().mockResolvedValue(rooms),
        findRoomById: jest.fn(async (id: string) => rooms.find((room) => room.id === id) ?? null),
      },
      sceneRepository: {
        findScenesByHomeId: jest.fn().mockResolvedValue(scenes),
        findSceneById: jest.fn(async (id: string) => scenes.find((item) => item.id === id) ?? null),
      },
      activityLogRepository: { saveActivity: jest.fn().mockResolvedValue(undefined) },
    },
    services: {
      deviceControlCatalogProvider: { listDashboardActionsForDevices: jest.fn((list: { id: string }[]) => list.map((item) => ({ deviceId: item.id }))) },
      sceneExecutionService: { execute: jest.fn().mockResolvedValue({ sceneId: 's-sala', status: 'success', actions: [] }) },
      assistantConversationService: { converse: jest.fn().mockResolvedValue({ type: 'answer', message: 'ok' }) },
      assistantSpeechToTextService: { transcribe: jest.fn().mockResolvedValue({ provider: 'whisper-local', transcript: 'hola' }) },
    },
    adapters: { topologyReferencePort: { validateHomeOwnership: jest.fn().mockResolvedValue(undefined) } },
  } as unknown as BootstrapContainer;
}

async function run(handler: { handle: (...args: never[]) => Promise<boolean> }, request: HomePilotRequest, path: string, method: string, container: BootstrapContainer) {
  const response = new MockResponse();
  await (handler as unknown as { handle(...args: unknown[]): Promise<boolean> }).handle(request, response as unknown as http.ServerResponse, path, method, container);
  return response;
}

describe('Feature: lists and actions follow the rooms a guest was given', () => {
  it('Scenario: Given a guest limited to the living room When devices are listed Then only its devices appear, and a parent sees all', async () => {
    const container = createContainer();

    const guestList = await run(new DeviceRoutes(), createRequest('/api/v1/devices'), '/api/v1/devices', 'GET', container);
    const parentList = await run(new DeviceRoutes(), createRequest('/api/v1/devices', PARENT), '/api/v1/devices', 'GET', container);

    expect((guestList.body() as { id: string }[]).map((item) => item.id)).toEqual(['light-sala']);
    expect((parentList.body() as { id: string }[]).map((item) => item.id)).toEqual(['light-sala', 'light-cocina', 'light-inbox']);
  });

  it('Scenario: Given a guest When dashboard action targets are listed Then devices outside its rooms are never offered', async () => {
    const container = createContainer();

    const response = await run(new DeviceRoutes(), createRequest('/api/v1/dashboard-action-targets'), '/api/v1/dashboard-action-targets', 'GET', container);

    expect(response.body()).toEqual([{ deviceId: 'light-sala' }]);
  });

  it.each(['/api/v1/rooms', `/api/v1/homes/${home.id}/rooms`])('Scenario: Given a guest When rooms are listed through %s Then only its rooms appear', async (path) => {
    const container = createContainer();

    const guestRooms = await run(new TopologyRoutes(), createRequest(path), path, 'GET', container);
    const parentRooms = await run(new TopologyRoutes(), createRequest(path, PARENT), path, 'GET', container);

    expect((guestRooms.body() as { id: string }[]).map((room) => room.id)).toEqual(['sala']);
    expect((parentRooms.body() as { id: string }[]).map((room) => room.id)).toEqual(['sala', 'cocina']);
  });

  it('Scenario: Given shared scenes When a guest lists them Then only scenes that stay inside its rooms remain', async () => {
    const container = createContainer();

    const guestScenes = await run(new SceneRoutes(), createRequest('/api/v1/scenes'), '/api/v1/scenes', 'GET', container);
    const parentScenes = await run(new SceneRoutes(), createRequest('/api/v1/scenes', PARENT), '/api/v1/scenes', 'GET', container);

    expect((guestScenes.body() as { id: string }[]).map((item) => item.id)).toEqual(['s-sala']);
    expect((parentScenes.body() as { id: string }[]).map((item) => item.id)).toEqual(['s-sala', 's-cocina', 's-mixta']);
  });

  it.each([
    ['s-sala', 200, true],
    ['s-cocina', 404, false],
    ['s-mixta', 404, false],
  ])('Scenario: Given the scene %s When a guest runs it Then the answer is %i and execution is %s', async (sceneId, status, executed) => {
    const container = createContainer();
    const path = `/api/v1/scenes/${sceneId}/execute`;

    const response = await run(new SceneRoutes(), createRequest(path, GUEST, {}), path, 'POST', container);

    expect(response.writeHead).toHaveBeenCalledWith(status, expect.any(Object));
    expect(container.services.sceneExecutionService.execute).toHaveBeenCalledTimes(executed ? 1 : 0);
  });

  it('Scenario: Given a guest When it names a room it cannot use as the assistant context Then the assistant is not consulted', async () => {
    const container = createContainer();
    const path = '/api/v1/assistant/converse';

    const refused = await run(new AssistantRoutes(), createRequest(path, GUEST, { prompt: 'hola', sourceRoomId: 'cocina' }), path, 'POST', container);
    expect(refused.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    expect(container.services.assistantConversationService.converse).not.toHaveBeenCalled();

    const allowed = await run(new AssistantRoutes(), createRequest(path, GUEST, { prompt: 'hola', sourceRoomId: 'sala' }), path, 'POST', container);
    expect(allowed.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(container.services.assistantConversationService.converse).toHaveBeenCalledTimes(1);
  });

  it('Scenario: Given a guest When speech is transcribed Then the hint words never include other rooms', async () => {
    const container = createContainer();
    const path = '/api/v1/assistant/stt';

    await run(new AssistantRoutes(), createRequest(path, GUEST, { audioBase64: 'YWJj', mimeType: 'audio/webm' }), path, 'POST', container);

    const request = (container.services.assistantSpeechToTextService.transcribe as jest.Mock).mock.calls[0]?.[0] as { contextTerms?: string[] } | undefined;
    expect(request?.contextTerms).toEqual(expect.arrayContaining(['light-sala', 'Sala']));
    expect(request?.contextTerms).not.toContain('light-cocina');
    expect(request?.contextTerms).not.toContain('Cocina');
  });
});
