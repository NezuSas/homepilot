import { bootstrap, BootstrapContainer } from '../bootstrap';
import { OperatorConsoleServer } from '../apps/api/OperatorConsoleServer';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

interface HomeResponse {
  id: string;
  ownerId: string;
  name: string;
  entityVersion: number;
  createdAt: string;
  updatedAt: string;
}

interface DeviceResponse {
  id: string;
  homeId: string;
  roomId: string | null;
  externalId: string;
  name: string;
  type: string;
  vendor: string;
  status: string;
  lastKnownState: Record<string, unknown> | null;
  entityVersion: number;
  createdAt: string;
  updatedAt: string;
}

interface ErrorResponse {
  error: string;
}

interface AssignResponse {
  id: string;
  status: string;
  roomId: string;
}

describe('OperatorConsoleServer Integration Tests', () => {
  let server: OperatorConsoleServer;
  let container: BootstrapContainer;
  let dbPath: string;
  const PORT = 3001;

  beforeAll(async () => {
    // 1. Initialise temporary DB for tests
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'homepilot-tests-'));
    dbPath = path.join(tempDir, 'test_hardened.db');
    process.env.HOMEPILOT_DB_PATH = dbPath;

    // 2. Run bootstrap
    container = await bootstrap();

    const now = new Date().toISOString();

    // 3. Pre-seed DB
    await container.repositories.homeRepository.saveHome({
      id: 'home-1',
      name: 'Test Home',
      ownerId: 'user-1',
      entityVersion: 1,
      createdAt: now,
      updatedAt: now
    });

    await container.repositories.roomRepository.saveRoom({
      id: 'room-1',
      homeId: 'home-1',
      name: 'Living Room',
      entityVersion: 1,
      createdAt: now,
      updatedAt: now
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
      createdAt: now,
      updatedAt: now
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
    const data = await res.json() as HomeResponse[];
    expect(data.length).toBe(1);
    expect(data[0].id).toBe('home-1');
  });

  it('GET /api/v1/devices should return seeded devices', async () => {
    const res = await fetch(`http://localhost:${PORT}/api/v1/devices`);
    expect(res.status).toBe(200);
    const data = await res.json() as DeviceResponse[];
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
      const data = await res.json() as AssignResponse;
      expect(data.id).toBe('device-1');
      expect(data.status).toBe('ASSIGNED');
      expect(data.roomId).toBe('room-1');

      // Verify persistence via GET /api/v1/devices
      const checkRes = await fetch(`http://localhost:${PORT}/api/v1/devices`);
      const devices = await checkRes.json() as DeviceResponse[];
      const device = devices.find(d => d.id === 'device-1');
      expect(device?.status).toBe('ASSIGNED');
      expect(device?.roomId).toBe('room-1');
    });

    it('Error 400: should fail if roomId is missing', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/v1/devices/device-1/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      expect(res.status).toBe(400);
      const data = await res.json() as ErrorResponse;
      expect(data.error).toBeDefined();
    });

    it('Error 404: should fail if room does not exist', async () => {
      const now = new Date().toISOString();
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
        createdAt: now,
        updatedAt: now
      });

      const res = await fetch(`http://localhost:${PORT}/api/v1/devices/device-err-404/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: 'non-existent-room' })
      });
      expect(res.status).toBe(404);
      const data = await res.json() as ErrorResponse;
      expect(data.error).toContain('Room not found');
    });
  });

  describe('POST /api/v1/devices/:id/command', () => {
    it('Success: should execute command and simulate state update for assigned device', async () => {
      // 1. Send toggle command to device-1 (already assigned in previous test)
      const res = await fetch(`http://localhost:${PORT}/api/v1/devices/device-1/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'toggle' })
      });

      expect(res.status).toBe(200);
      const data = await res.json() as DeviceResponse;
      expect(data.id).toBe('device-1');
      expect(data.lastKnownState?.on).toBe(true);

      // 2. Verify persistence in SQLite
      const checkRes = await fetch(`http://localhost:${PORT}/api/v1/devices`);
      const devices = await checkRes.json() as DeviceResponse[];
      const device = devices.find(d => d.id === 'device-1');
      expect(device?.lastKnownState?.on).toBe(true);
    });

    it('Error 400: should fail if command is missing', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/v1/devices/device-1/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      expect(res.status).toBe(400);
      const data = await res.json() as ErrorResponse;
      expect(data.error).toContain('Missing command');
    });

    it('Error 400: should fail if command is unsupported for device type', async () => {
      const now = new Date().toISOString();
      // Create a sensor (sensors have [] capabilities)
      await container.repositories.deviceRepository.saveDevice({
        id: 'sensor-1', homeId: 'home-1', externalId: 'ext-s1', name: 'Motion',
        type: 'sensor', vendor: 'v', status: 'ASSIGNED', roomId: 'room-1',
        lastKnownState: null, entityVersion: 1, createdAt: now,
        updatedAt: now
      });

      const res = await fetch(`http://localhost:${PORT}/api/v1/devices/sensor-1/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'turn_on' })
      });

      expect(res.status).toBe(400);
      const data = await res.json() as ErrorResponse;
      expect(data.error).toContain('not support');
    });

    it('Error 409: should fail if device is PENDING', async () => {
      const now = new Date().toISOString();
      // Create a pending light
      await container.repositories.deviceRepository.saveDevice({
        id: 'pending-light', homeId: 'home-1', externalId: 'ext-p1', name: 'Bulb 2',
        type: 'light', vendor: 'v', status: 'PENDING', roomId: null,
        lastKnownState: { on: false }, entityVersion: 1, createdAt: now,
        updatedAt: now
      });

      const res = await fetch(`http://localhost:${PORT}/api/v1/devices/pending-light/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'toggle' })
      });

      expect(res.status).toBe(409);
      const data = await res.json() as ErrorResponse;
      expect(data.error).toContain('PENDING');
    });

    it('Error 404: should fail if device does not exist', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/v1/devices/ghost-id/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'toggle' })
      });
      expect(res.status).toBe(404);
      const data = await res.json() as ErrorResponse;
      expect(data.error).toBeDefined();
    });
  });
});
