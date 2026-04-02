import { bootstrap, BootstrapContainer } from '../bootstrap';
import { OperatorConsoleServer } from '../apps/api/OperatorConsoleServer';
import { SqliteDatabaseManager } from '../packages/shared/infrastructure/database/SqliteDatabaseManager';
import { AutomationRule } from '../packages/devices/domain/automation/types';

/**
 * Tests de integración para OperatorConsoleServer.
 */
describe('OperatorConsoleServer Integration Tests', () => {
  let server: OperatorConsoleServer;
  let container: BootstrapContainer;
  const PORT = 3001;
  const DB_PATH = 'test.api.db';

  beforeAll(async () => {
    container = await bootstrap({ dbPath: DB_PATH, verbose: false });
    const db = SqliteDatabaseManager.getInstance(DB_PATH);
    db.exec(`
      DELETE FROM automation_rules;
      DELETE FROM devices;
      DELETE FROM rooms;
      DELETE FROM homes;
    `);

    const now = new Date().toISOString();
    db.prepare("INSERT INTO homes (id, owner_id, name, entity_version, created_at, updated_at) VALUES ('h-01', 'u-01', 'H', 1, ?, ?)")
      .run(now, now);
    db.prepare("INSERT INTO rooms (id, home_id, name, entity_version, created_at, updated_at) VALUES ('r-01', 'h-01', 'Living', 1, ?, ?)")
      .run(now, now);
    db.prepare("INSERT INTO devices (id, home_id, external_id, name, type, vendor, status, room_id, last_known_state, entity_version, created_at, updated_at) VALUES ('d-01', 'h-01', 'ext-1', 'L1', 'light', 'v', 'ASSIGNED', 'r-01', ?, 1, ?, ?)")
      .run(JSON.stringify({ on: false }), now, now);
    db.prepare("INSERT INTO devices (id, home_id, external_id, name, type, vendor, status, room_id, last_known_state, entity_version, created_at, updated_at) VALUES ('d-02', 'h-01', 'ext-2', 'L2', 'light', 'v', 'ASSIGNED', 'r-01', ?, 1, ?, ?)")
      .run(JSON.stringify({ on: false }), now, now);

    server = new OperatorConsoleServer(container, DB_PATH, PORT);
    server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  describe('Automation API', () => {
    const rid = 'rule-01';

    beforeAll(async () => {
      await container.repositories.automationRuleRepository.save({
        id: rid, homeId: 'h-01', userId: 'u-01', name: 'R', enabled: true,
        trigger: { deviceId: 'd-01', stateKey: 'on', expectedValue: true },
        action: { targetDeviceId: 'd-02', command: 'turn_off' }
      });
    });

    it('GET /api/v1/automations: list rules', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/v1/automations`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as AutomationRule[];
      expect(data.some(r => r.id === rid)).toBe(true);
    });

    it('PATCH /api/v1/automations/:id: update name', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/v1/automations/${rid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Name' })
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as AutomationRule;
      expect(data.name).toBe('Updated Name');
    });

    it('PATCH /api/v1/automations/:id: 400 loop', async () => {
      // Intentar crear un bucle: trigger d-01 -> target d-01
      const res = await fetch(`http://localhost:${PORT}/api/v1/automations/${rid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: { targetDeviceId: 'd-01', command: 'turn_off' }
        })
      });
      expect(res.status).toBe(400);
    });

    it('PATCH /api/v1/automations/:id/disable: deactivate rule', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/v1/automations/${rid}/disable`, { method: 'PATCH' });
      expect(res.status).toBe(200);
      const data = (await res.json()) as AutomationRule;
      expect(data.enabled).toBe(false);
    });

    it('DELETE /api/v1/automations/:id: success', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/v1/automations/${rid}`, { method: 'DELETE' });
      expect(res.status).toBe(204);
      const inDb = await container.repositories.automationRuleRepository.findById(rid);
      expect(inDb).toBeNull();
    });

    it('PATCH /api/v1/automations/:id: 404', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/v1/automations/fake`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' })
      });
      expect(res.status).toBe(404);
    });
  });

  describe('Device API', () => {
    it('POST /api/v1/devices/:id/command: success', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/v1/devices/d-01/command`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'turn_on' })
      });
      expect(res.status).toBe(200);
    });

    it('POST /api/v1/devices/:id/assign: 404 room', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/v1/devices/d-01/assign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: 'fake-room' })
      });
      expect(res.status).toBe(404);
    });
  });
});
