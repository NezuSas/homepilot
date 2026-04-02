import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import { bootstrap } from '../bootstrap';
import { OperatorConsoleServer } from '../apps/api/OperatorConsoleServer';
import { seed } from '../scripts/seed-demo';
import { SqliteDatabaseManager } from '../packages/shared/infrastructure/database/SqliteDatabaseManager';

describe('HomePilot Operator Console V1 Smoke Test', () => {
  const TEST_DB = path.join(__dirname, 'smoke.test.db');
  const PORT = 3001;
  let server: OperatorConsoleServer;

  beforeAll(async () => {
    // Asegurar que el Singleton esté limpio antes de empezar el test
    SqliteDatabaseManager.close();

    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    
    // 1. Bootstrap & Seed
    const container = await bootstrap({ dbPath: TEST_DB, verbose: false });
    await seed(TEST_DB);

    // 2. Start Server
    server = new OperatorConsoleServer(container, TEST_DB, PORT);
    server.start();
  });

  afterAll(async () => {
    await server.stop();
    SqliteDatabaseManager.close();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  const request = (path: string, method: string = 'GET', body?: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: PORT,
        path,
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {}
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data });
          }
        });
      });
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  };

  it('should complete a full operational cycle', async () => {
    // 1. Check Homes & Rooms
    const homes = await request('/api/v1/homes');
    expect(homes.status).toBe(200);
    expect(homes.data.length).toBeGreaterThan(0);
    const homeId = homes.data[0].id;

    const rooms = await request(`/api/v1/homes/${homeId}/rooms`);
    expect(rooms.status).toBe(200);
    expect(rooms.data.length).toBeGreaterThan(0);
    const roomId = rooms.data[0].id;

    // 2. Check Devices
    const devices = await request('/api/v1/devices');
    expect(devices.status).toBe(200);
    const pending = devices.data.find((d: any) => d.status === 'PENDING');
    expect(pending).toBeDefined();

    // 3. Assign Device
    const assign = await request(`/api/v1/devices/${pending.id}/assign`, 'POST', { roomId });
    expect(assign.status).toBe(200);
    expect(assign.data.status).toBe('ASSIGNED');
    expect(assign.data.roomId).toBe(roomId);

    // 4. Execute Command
    const light = devices.data.find((d: any) => d.type === 'light' && d.status === 'ASSIGNED');
    const command = await request(`/api/v1/devices/${light.id}/command`, 'POST', { command: 'turn_on' });
    expect(command.status).toBe(200);
    expect(command.data.lastKnownState.on).toBe(true);

    // 5. Check Automations
    const rules = await request('/api/v1/automations');
    expect(rules.status).toBe(200);
    expect(rules.data.length).toBeGreaterThan(0);
    const ruleId = rules.data[0].id;
    const enabled = rules.data[0].enabled;

    const toggle = await request(`/api/v1/automations/${ruleId}/${enabled ? 'disable' : 'enable'}`, 'PATCH');
    expect(toggle.status).toBe(200);
    expect(toggle.data.enabled).toBe(!enabled);

    // 6. Verify Activity Logs (should have command execution)
    const logs = await request('/api/v1/activity-logs');
    expect(logs.status).toBe(200);
    const commandLog = logs.data.find((l: any) => l.type === 'COMMAND_DISPATCHED' && l.deviceId === light.id);
    expect(commandLog).toBeDefined();
  });
});
