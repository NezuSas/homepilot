import { bootstrap, BootstrapContainer } from '../bootstrap';
import { OperatorConsoleServer } from '../apps/api/OperatorConsoleServer';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

describe('OperatorConsoleServer Integration Tests', () => {
  let server: OperatorConsoleServer;
  let container: BootstrapContainer;
  let dbPath: string;
  const PORT = 3001;

  beforeAll(async () => {
    // 1. Initialise temporary DB for tests
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'homepilot-tests-'));
    dbPath = path.join(tempDir, 'test.db');
    process.env.HOMEPILOT_DB_PATH = dbPath;

    // 2. Run bootstrap
    container = await bootstrap();

    // 3. Pre-seed DB
    await container.repositories.homeRepository.saveHome({
      id: 'home-1',
      name: 'Test Home',
      ownerId: 'user-1',
      entityVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await container.repositories.roomRepository.saveRoom({
      id: 'room-1',
      homeId: 'home-1',
      name: 'Living Room',
      entityVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await container.repositories.deviceRepository.saveDevice({
      id: 'device-1',
      homeId: 'home-1',
      externalId: 'ext-device-1',
      name: 'Smart Bulb',
      type: 'light',
      vendor: 'philips',
      status: 'PENDING',
      roomId: null,
      lastKnownState: { on: false },
      entityVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // 4. Start Server
    server = new OperatorConsoleServer(container, dbPath, PORT);
    server.start();

    // Small delay to ensure binding
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  it('GET /api/v1/homes should return seeded homes', async () => {
    const res = await fetch(`http://localhost:${PORT}/api/v1/homes`);
    expect(res.status).toBe(200);
    const data = await res.json() as any[];
    expect(data.length).toBe(1);
    expect(data[0].id).toBe('home-1');
  });

  it('GET /api/v1/devices should return seeded devices', async () => {
    const res = await fetch(`http://localhost:${PORT}/api/v1/devices`);
    expect(res.status).toBe(200);
    const data = await res.json() as any[];
    expect(data.some(d => d.id === 'device-1' && d.status === 'PENDING')).toBe(true);
  });

  describe('POST /api/v1/devices/:id/assign', () => {
    it('Success: should assign device to room and persist in SQLite', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/v1/devices/device-1/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: 'room-1' })
      });
      
      expect(res.status).toBe(200);
      const data = await res.json() as { id: string; status: string; roomId: string };
      expect(data.id).toBe('device-1');
      expect(data.status).toBe('ASSIGNED');
      expect(data.roomId).toBe('room-1');

      // Verify persistence via GET /api/v1/devices
      const checkRes = await fetch(`http://localhost:${PORT}/api/v1/devices`);
      const devices = await checkRes.json() as any[];
      const device = devices.find(d => d.id === 'device-1');
      expect(device.status).toBe('ASSIGNED');
      expect(device.roomId).toBe('room-1');
    });

    it('Error 400: should fail if roomId is missing', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/v1/devices/device-1/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      expect(res.status).toBe(400);
      const data = await res.json() as { error: string };
      expect(data.error).toBeDefined();
    });

    it('Error 404: should fail if room does not exist', async () => {
      // Use a new device for this test to avoid conflicts with previous assignment
      await container.repositories.deviceRepository.saveDevice({
        id: 'device-err-404',
        homeId: 'home-1',
        externalId: 'ext-404',
        name: 'Err Device',
        type: 'sensor',
        vendor: 'v',
        status: 'PENDING',
        roomId: null,
        lastKnownState: null,
        entityVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const res = await fetch(`http://localhost:${PORT}/api/v1/devices/device-err-404/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: 'non-existent-room' })
      });
      expect(res.status).toBe(404);
      const data = await res.json() as { error: string };
      expect(data.error).toContain('Room not found');
    });
  });
});
