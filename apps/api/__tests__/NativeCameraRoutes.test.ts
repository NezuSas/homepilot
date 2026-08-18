import * as fs from 'fs';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { SqliteDatabaseManager } from '../../../packages/shared/infrastructure/database/SqliteDatabaseManager';
import { SQLiteNativeCameraSourceRepository } from '../../../packages/devices/infrastructure/repositories/SQLiteNativeCameraSourceRepository';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { NativeCameraRoutes } from '../routes/NativeCameraRoutes';
import { NativeCameraService } from '../../../packages/integrations/native-camera/application/NativeCameraService';
import { DefaultNativeCameraDriverRegistry } from '../../../packages/integrations/native-camera/infrastructure/drivers/DefaultNativeCameraDriverRegistry';
import { OnvifPtzCameraDriver } from '../../../packages/integrations/native-camera/infrastructure/drivers/OnvifPtzCameraDriver';
import { RtspDvrCameraDriver } from '../../../packages/integrations/native-camera/infrastructure/drivers/RtspDvrCameraDriver';
import { SonoffRtspCameraDriver } from '../../../packages/integrations/native-camera/infrastructure/drivers/SonoffRtspCameraDriver';
import { OnvifWsDiscoveryProbe } from '../../../packages/integrations/native-camera/infrastructure/onvif/OnvifWsDiscoveryProbe';
import type { NetworkProbePort } from '../../../packages/integrations/native-camera/application/ports/NetworkProbePort';

describe('Feature: Native camera configuration', () => {
  const dbPath = 'native-camera-routes-test.db';

  // A stubbed network probe replaces real TCP connect attempts — the former test
  // achieved this by monkey-patching the route's private `checkTcpReachable`;
  // now that reachability lives behind a port, this is the natural DI seam.
  const networkProbe: jest.Mocked<NetworkProbePort> = { isReachable: jest.fn().mockResolvedValue(true) };
  const driverRegistry = new DefaultNativeCameraDriverRegistry([
    new OnvifPtzCameraDriver(new OnvifWsDiscoveryProbe(), networkProbe),
    new RtspDvrCameraDriver(networkProbe),
    new SonoffRtspCameraDriver(networkProbe),
  ]);

  const homeRepository = { findHomeById: jest.fn().mockResolvedValue({ id: 'home-1' }) };
  const deviceRepository = {
    saveDevice: jest.fn().mockImplementation(async (device: { id: string }) => {
      SqliteDatabaseManager.getInstance(dbPath).prepare('INSERT INTO devices VALUES (?)').run(device.id);
    }),
    findDeviceById: jest.fn(),
  };

  const nativeCameraSourceRepository = new SQLiteNativeCameraSourceRepository(dbPath);
  const nativeCameraService = new NativeCameraService(
    nativeCameraSourceRepository,
    deviceRepository as any,
    homeRepository as any,
    driverRegistry
  );
  const routes = new NativeCameraRoutes(nativeCameraService);

  const response = () => ({
    writeHead: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
  }) as unknown as http.ServerResponse;

  const container = (allowed = true) => ({
    guards: { authGuard: { protect: jest.fn().mockResolvedValue(allowed) } },
    repositories: { homeRepository, deviceRepository },
  }) as unknown as BootstrapContainer;

  beforeEach(() => {
    jest.clearAllMocks();
    homeRepository.findHomeById.mockResolvedValue({ id: 'home-1' });
    networkProbe.isReachable.mockResolvedValue(true);
    SqliteDatabaseManager.closeAll();
    const db = SqliteDatabaseManager.getInstance(dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS homes (id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS native_camera_sources (
        device_id TEXT PRIMARY KEY, home_id TEXT NOT NULL, source_type TEXT NOT NULL DEFAULT 'onvif-ptz',
        name TEXT NOT NULL, host TEXT NOT NULL, onvif_port INTEGER NOT NULL DEFAULT 8000, rtsp_port INTEGER NOT NULL DEFAULT 554,
        username TEXT NOT NULL, password TEXT NOT NULL, rtsp_path TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        profile_token TEXT, ptz_configuration_token TEXT, ptz_supported INTEGER NOT NULL DEFAULT 0
      );
    `);
  });

  afterEach(() => {
    SqliteDatabaseManager.closeAll();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('Scenario: Given an unauthenticated request When native cameras are listed Then no camera data is returned', async () => {
    const res = response();
    const request = { url: '/api/v1/native-cameras?homeId=home-1', headers: {} } as HomePilotRequest;

    await routes.handle(request, res, '/api/v1/native-cameras', 'GET', container(false));

    expect(res.writeHead).not.toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
  });

  it('Scenario: Given a native camera with stored credentials When its home cameras are listed Then the password remains masked', async () => {
    const db = SqliteDatabaseManager.getInstance(dbPath);
    db.prepare("INSERT INTO homes VALUES ('home-1')").run();
    db.prepare("INSERT INTO devices VALUES ('cam-1')").run();
    db.prepare(`INSERT INTO native_camera_sources (device_id, home_id, source_type, name, host, onvif_port, rtsp_port, username, password, rtsp_path, enabled, created_at, updated_at)
      VALUES ('cam-1', 'home-1', 'rtsp-dvr', 'DVR', '192.168.1.20', 80, 554, 'admin', 'secret-value', '/stream', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`).run();
    const res = response();
    const request = { url: '/api/v1/native-cameras?homeId=home-1', headers: {} } as HomePilotRequest;

    await routes.handle(request, res, '/api/v1/native-cameras', 'GET', container());

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    const payload = JSON.parse((res.end as jest.Mock).mock.calls[0][0]) as { cameras: Array<Record<string, unknown>> };
    expect(payload.cameras).toHaveLength(1);
    expect(payload.cameras[0]).toEqual(expect.objectContaining({ sourceType: 'rtsp-dvr', maskedPassword: '••••••••' }));
    expect(payload.cameras[0]).not.toHaveProperty('password');
  });

  it('Scenario: Given a missing homeId When native cameras are listed Then the API rejects the request', async () => {
    const res = response();
    const request = { url: '/api/v1/native-cameras', headers: {} } as HomePilotRequest;

    await routes.handle(request, res, '/api/v1/native-cameras', 'GET', container());

    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
  });

  it('Scenario: Given a reachable RTSP/DVR camera When it is created Then a pending camera device and masked source are persisted', async () => {
    const db = SqliteDatabaseManager.getInstance(dbPath);
    db.prepare("INSERT INTO homes VALUES ('home-1')").run();
    const res = response();
    const dependencies = container();
    const request = {
      url: '/api/v1/native-cameras',
      headers: {},
      _fastifyParsedBody: JSON.stringify({ homeId: 'home-1', sourceType: 'rtsp-dvr', name: 'DVR', host: '192.168.1.20', rtspPort: 554, onvifPort: 80, username: 'admin', password: 'secret', rtspPath: '/stream' }),
    } as HomePilotRequest;

    await routes.handle(request, res, '/api/v1/native-cameras', 'POST', dependencies);

    expect(res.writeHead).toHaveBeenCalledWith(201, expect.any(Object));
    expect(deviceRepository.saveDevice).toHaveBeenCalledWith(expect.objectContaining({ type: 'camera', status: 'PENDING', integrationSource: 'native-camera', vendor: 'rtsp-dvr' }));
    const payload = JSON.parse((res.end as jest.Mock).mock.calls[0][0]) as { camera: Record<string, unknown> };
    expect(payload.camera).toEqual(expect.objectContaining({ sourceType: 'rtsp-dvr', maskedPassword: '••••••••' }));
    expect(payload.camera).not.toHaveProperty('password');
  });
  it('returns false for a path outside the native camera route contract', async () => {
    const res = response();
    const request = { url: '/api/v1/not-native-cameras', headers: {} } as HomePilotRequest;

    const handled = await routes.handle(request, res, '/api/v1/not-native-cameras', 'GET', container());

    expect(handled).toBe(false);
    expect(res.writeHead).not.toHaveBeenCalled();
  });
});

describe('Feature: Native camera route error and mutation contracts', () => {
  const source = {
    deviceId: 'camera-1', homeId: 'home-1', sourceType: 'rtsp-dvr', name: 'Camera', host: '192.168.1.20',
    onvifPort: 80, rtspPort: 554, username: 'admin', password: 'secret', rtspPath: '/stream', enabled: true,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const response = () => ({ writeHead: jest.fn().mockReturnThis(), end: jest.fn().mockReturnThis() }) as unknown as http.ServerResponse;
  const container = () => ({ guards: { authGuard: { protect: jest.fn().mockResolvedValue(true) } } }) as unknown as BootstrapContainer;
  const serviceFor = (overrides: Record<string, unknown>) => new NativeCameraRoutes({
    discover: jest.fn().mockResolvedValue([]),
    listByHome: jest.fn().mockReturnValue([]),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    ...overrides,
  } as unknown as NativeCameraService);

  it('lists discovered cameras and contains discovery failures behind the HTTP error contract', async () => {
    const success = serviceFor({ discover: jest.fn().mockResolvedValue([{ host: '192.168.1.21' }]) });
    const successResponse = response();
    await success.handle({ url: '/api/v1/native-cameras/discover', headers: {} } as HomePilotRequest, successResponse, '/api/v1/native-cameras/discover', 'GET', container());
    expect(successResponse.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(JSON.parse((successResponse.end as jest.Mock).mock.calls[0][0])).toEqual({ devices: [{ host: '192.168.1.21' }] });

    const failure = serviceFor({ discover: jest.fn().mockRejectedValue(new Error('probe failed')) });
    const failureResponse = response();
    await failure.handle({ url: '/api/v1/native-cameras/discover', headers: {} } as HomePilotRequest, failureResponse, '/api/v1/native-cameras/discover', 'GET', container());
    expect(failureResponse.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
  });

  it('maps native service mutation outcomes to their API status and masks updated credentials', async () => {
    const route = serviceFor({
      update: jest.fn().mockResolvedValue({ ok: true, value: source }),
      delete: jest.fn().mockResolvedValue({ ok: false, error: { kind: 'CAMERA_NOT_FOUND', message: 'Unknown camera' } }),
    });
    const updateResponse = response();
    await route.handle({ url: '/api/v1/native-cameras/camera%201', headers: {}, _fastifyParsedBody: JSON.stringify({ name: 'Updated' }) } as HomePilotRequest, updateResponse, '/api/v1/native-cameras/camera%201', 'PUT', container());
    expect(updateResponse.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(JSON.parse((updateResponse.end as jest.Mock).mock.calls[0][0]).camera).toEqual(expect.objectContaining({ deviceId: 'camera-1', maskedPassword: '••••••••' }));

    const deleteResponse = response();
    await route.handle({ url: '/api/v1/native-cameras/camera-1', headers: {} } as HomePilotRequest, deleteResponse, '/api/v1/native-cameras/camera-1', 'DELETE', container());
    expect(deleteResponse.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
  });

  it('turns unexpected list failures into a stable server error response', async () => {
    const route = serviceFor({ listByHome: jest.fn(() => { throw new Error('storage offline'); }) });
    const res = response();
    await route.handle({ url: '/api/v1/native-cameras?homeId=home-1', headers: {} } as HomePilotRequest, res, '/api/v1/native-cameras', 'GET', container());
    expect(res.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
  });
});
describe('Feature: native camera mutation completion contracts', () => {
  const response = () => ({ writeHead: jest.fn().mockReturnThis(), end: jest.fn().mockReturnThis() }) as unknown as http.ServerResponse;
  const container = () => ({ guards: { authGuard: { protect: jest.fn().mockResolvedValue(true) } } }) as unknown as BootstrapContainer;
  const request = (body: unknown = {}) => ({ url: '/api/v1/native-cameras/camera-1', headers: {}, _fastifyParsedBody: JSON.stringify(body) }) as HomePilotRequest;

  it('Scenario: Given rejected camera creation input When creating a native camera Then the service validation contract is preserved', async () => {
    const route = new NativeCameraRoutes({
      create: jest.fn().mockResolvedValue({ ok: false, error: { kind: 'VALIDATION_ERROR', message: 'Invalid RTSP path' } }),
    } as unknown as NativeCameraService);
    const res = response();

    await route.handle(request({ host: 'invalid' }), res, '/api/v1/native-cameras', 'POST', container());

    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('VALIDATION_ERROR'));
  });

  it('Scenario: Given an unexpected update failure When updating a native camera Then the route returns its stable internal-error contract', async () => {
    const route = new NativeCameraRoutes({
      update: jest.fn().mockRejectedValue(new Error('camera source unavailable')),
    } as unknown as NativeCameraService);
    const res = response();

    await route.handle(request({ name: 'Updated' }), res, '/api/v1/native-cameras/camera-1', 'PUT', container());

    expect(res.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('camera source unavailable'));
  });

  it('Scenario: Given unexpected creation or deletion failures When mutating native cameras Then each operation returns the stable internal-error contract', async () => {
    const createRoute = new NativeCameraRoutes({ create: jest.fn().mockRejectedValue(new Error('camera creation store unavailable')) } as unknown as NativeCameraService);
    const createResponse = response();
    await createRoute.handle(request({ name: 'Camera' }), createResponse, '/api/v1/native-cameras', 'POST', container());
    expect(createResponse.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(createResponse.end).toHaveBeenCalledWith(expect.stringContaining('camera creation store unavailable'));

    const deleteRoute = new NativeCameraRoutes({ delete: jest.fn().mockRejectedValue(new Error('camera deletion store unavailable')) } as unknown as NativeCameraService);
    const deleteResponse = response();
    await deleteRoute.handle(request(), deleteResponse, '/api/v1/native-cameras/camera-1', 'DELETE', container());
    expect(deleteResponse.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(deleteResponse.end).toHaveBeenCalledWith(expect.stringContaining('camera deletion store unavailable'));
  });
  it('Scenario: Given a deletable native camera When deletion succeeds Then the route returns no content', async () => {
    const route = new NativeCameraRoutes({ delete: jest.fn().mockResolvedValue({ ok: true, value: undefined }) } as unknown as NativeCameraService);
    const res = response();

    await route.handle(request(), res, '/api/v1/native-cameras/camera-1', 'DELETE', container());

    expect(res.writeHead).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalledWith();
  });
});