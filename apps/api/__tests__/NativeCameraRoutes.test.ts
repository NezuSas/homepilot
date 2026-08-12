import * as fs from 'fs';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { SqliteDatabaseManager } from '../../../packages/shared/infrastructure/database/SqliteDatabaseManager';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { NativeCameraRoutes } from '../routes/NativeCameraRoutes';

describe('Feature: Native camera configuration', () => {
  const dbPath = 'native-camera-routes-test.db';
  const routes = new NativeCameraRoutes(dbPath);

  const response = () => ({
    writeHead: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
  }) as unknown as http.ServerResponse;

  const container = (allowed = true) => ({
    guards: { authGuard: { protect: jest.fn().mockResolvedValue(allowed) } },
    repositories: {
      homeRepository: { findHomeById: jest.fn().mockResolvedValue({ id: 'home-1' }) },
      deviceRepository: {
        saveDevice: jest.fn().mockImplementation(async (device: { id: string }) => {
          SqliteDatabaseManager.getInstance(dbPath).prepare('INSERT INTO devices VALUES (?)').run(device.id);
        }),
      },
    },
  }) as unknown as BootstrapContainer;

  beforeEach(() => {
    SqliteDatabaseManager.closeAll();
    const db = SqliteDatabaseManager.getInstance(dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS homes (id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS native_camera_sources (
        device_id TEXT PRIMARY KEY, home_id TEXT NOT NULL, source_type TEXT NOT NULL DEFAULT 'onvif-ptz',
        name TEXT NOT NULL, host TEXT NOT NULL, onvif_port INTEGER NOT NULL DEFAULT 8000, rtsp_port INTEGER NOT NULL DEFAULT 554,
        username TEXT NOT NULL, password TEXT NOT NULL, rtsp_path TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
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
    const target = routes as unknown as { checkTcpReachable: jest.Mock };
    target.checkTcpReachable = jest.fn().mockResolvedValue(true);
    const dependencies = container();
    const request = {
      url: '/api/v1/native-cameras',
      headers: {},
      _fastifyParsedBody: JSON.stringify({ homeId: 'home-1', sourceType: 'rtsp-dvr', name: 'DVR', host: '192.168.1.20', rtspPort: 554, onvifPort: 80, username: 'admin', password: 'secret', rtspPath: '/stream' }),
    } as HomePilotRequest;

    await routes.handle(request, res, '/api/v1/native-cameras', 'POST', dependencies);

    expect(res.writeHead).toHaveBeenCalledWith(201, expect.any(Object));
    expect(dependencies.repositories.deviceRepository.saveDevice).toHaveBeenCalledWith(expect.objectContaining({ type: 'camera', status: 'PENDING', integrationSource: 'native-camera', vendor: 'rtsp-dvr' }));
    const payload = JSON.parse((res.end as jest.Mock).mock.calls[0][0]) as { camera: Record<string, unknown> };
    expect(payload.camera).toEqual(expect.objectContaining({ sourceType: 'rtsp-dvr', maskedPassword: '••••••••' }));
    expect(payload.camera).not.toHaveProperty('password');
  });
});