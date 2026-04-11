import { bootstrap, BootstrapContainer } from '../bootstrap';
import { OperatorConsoleServer } from '../apps/api/OperatorConsoleServer';
import { SqliteDatabaseManager } from '../packages/shared/infrastructure/database/SqliteDatabaseManager';
import { AutomationRule } from '../packages/devices/domain/automation/types';
import { ActivityRecord } from '../packages/devices/domain/repositories/ActivityLogRepository';
import { Device } from '../packages/devices/domain/types';

/**
 * Tests de integración para OperatorConsoleServer.
 * Cubre Automation API, Device API y la nueva funcionalidad de HA Sync V1.
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
      DELETE FROM activity_logs;
      DELETE FROM sessions;
      DELETE FROM users;
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
    db.prepare("INSERT INTO devices (id, home_id, external_id, name, type, vendor, status, room_id, last_known_state, entity_version, created_at, updated_at) VALUES ('d-ha', 'h-01', 'ha:light.kitchen', 'HA Light', 'light', 'ha', 'ASSIGNED', 'r-01', ?, 1, ?, ?)")
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
        trigger: { type: 'device_state_changed', deviceId: 'd-01', stateKey: 'on', expectedValue: true },
        action: { type: 'device_command', targetDeviceId: 'd-02', command: 'turn_off' }
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
      const res = await fetch(`http://localhost:${PORT}/api/v1/automations/${rid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: { type: 'device_command', targetDeviceId: 'd-01', command: 'turn_off' }
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
  });

  describe('Device API', () => {
    it('GET /api/v1/devices/:id: success', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/v1/devices/d-01`);
      expect(res.status).toBe(200);
      const data = await res.json() as Device;
      expect(data.id).toBe('d-01');
      expect(data.name).toBe('L1');
    });

    it('GET /api/v1/devices/:id/activity-logs: success', async () => {
      await container.repositories.activityLogRepository.saveActivity({
        timestamp: new Date().toISOString(),
        deviceId: 'd-01',
        type: 'COMMAND_DISPATCHED',
        description: 'Test Log',
        data: {}
      });

      const res = await fetch(`http://localhost:${PORT}/api/v1/devices/d-01/activity-logs`);
      expect(res.status).toBe(200);
      const data = await res.json() as ActivityRecord[];
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].deviceId).toBe('d-01');
    });

    it('POST /api/v1/devices/:id/command: success', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/v1/devices/d-01/command`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'turn_on' })
      });
      expect(res.status).toBe(200);
    });

    it('POST /api/v1/devices/:id/refresh: 400 for non-HA device', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/v1/devices/d-01/refresh`, { method: 'POST' });
      expect(res.status).toBe(400);
      const data = await res.json() as { error: string };
      expect(data.error).toContain('Only Home Assistant devices');
    });

    it('POST /api/v1/devices/:id/refresh: 404 for non-existent device', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/v1/devices/fake-ha/refresh`, { method: 'POST' });
      expect(res.status).toBe(404);
    });

    it('POST /api/v1/devices/:id/refresh: 200 success for HA device', async () => {
      jest.spyOn(container.adapters.homeAssistantClient, 'getEntityState').mockResolvedValueOnce({
        entity_id: 'light.kitchen',
        state: 'on',
        attributes: {},
        last_changed: new Date().toISOString(),
        last_updated: new Date().toISOString()
      });

      const res = await fetch(`http://localhost:${PORT}/api/v1/devices/d-ha/refresh`, { method: 'POST' });
      expect(res.status).toBe(200);
      const data = await res.json() as Device;
      expect(data.lastKnownState?.on).toBe(true);
      
      const inDb = await container.repositories.deviceRepository.findDeviceById('d-ha');
      expect(inDb?.lastKnownState?.on).toBe(true);
    });

    it('POST /api/v1/devices/:refresh: 502 when HA fails', async () => {
      jest.spyOn(container.adapters.homeAssistantClient, 'getEntityState').mockResolvedValueOnce(null);
      const res = await fetch(`http://localhost:${PORT}/api/v1/devices/d-ha/refresh`, { method: 'POST' });
      expect(res.status).toBe(502);
    });
  });

  describe('Discovery & Import API', () => {
    it('GET /api/v1/ha/entities: filters supported domains', async () => {
      jest.spyOn(container.adapters.homeAssistantClient, 'getAllStates').mockResolvedValueOnce([
        { entity_id: 'light.living', state: 'off', attributes: { friendly_name: 'Living Light' }, last_changed: '', last_updated: '' },
        { entity_id: 'media_player.tv', state: 'playing', attributes: {}, last_changed: '', last_updated: '' },
        { entity_id: 'sensor.temp', state: '22', attributes: {}, last_changed: '', last_updated: '' }
      ]);

      const res = await fetch(`http://localhost:${PORT}/api/v1/ha/entities`);
      expect(res.status).toBe(200);
      const data = await res.json() as any[];
      expect(data.length).toBe(2);
      expect(data[0].entityId).toBe('light.living');
      expect(data[1].entityId).toBe('sensor.temp');
    });

    it('POST /api/v1/ha/import: success and duplicate prevention', async () => {
      const entityId = 'switch.coffee';
      jest.spyOn(container.adapters.homeAssistantClient, 'getEntityState').mockResolvedValueOnce({
        entity_id: entityId, state: 'off', attributes: { friendly_name: 'Coffee Machine' }, last_changed: '', last_updated: ''
      });

      // Primer import
      const res1 = await fetch(`http://localhost:${PORT}/api/v1/ha/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId })
      });
      expect(res1.status).toBe(201);
      const device = await res1.json() as Device;
      expect(device.externalId).toBe(`ha:${entityId}`);

      // Segundo import (duplicado)
      const res2 = await fetch(`http://localhost:${PORT}/api/v1/ha/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId })
      });
      expect(res2.status).toBe(409);
    });
  });

  describe('Auth API', () => {
    it('OPTIONS /api/v1/auth/login: returns CORS headers with Authorization', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/v1/auth/login`, {
        method: 'OPTIONS'
      });
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    });

    it('POST /api/v1/auth/login: sanitizes user object and removes passwordHash', async () => {
      // Seed a user manually for testing
      const db = SqliteDatabaseManager.getInstance(DB_PATH);
      const now = new Date().toISOString();
      const passHash = await container.services.authService['cryptoService'].hashPassword('testPass123');
      db.prepare("INSERT INTO users (id, username, password_hash, role, is_active, created_at, updated_at) VALUES ('u-test-auth', 'testauth', ?, 'operator', 1, ?, ?)")
        .run(passHash, now, now);

      const res = await fetch(`http://localhost:${PORT}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testauth', password: 'testPass123' })
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      
      expect(data).toHaveProperty('token');
      expect(data).toHaveProperty('user');
      expect(data.user).toHaveProperty('id', 'u-test-auth');
      expect(data.user).toHaveProperty('username', 'testauth');
      expect(data.user).toHaveProperty('role', 'operator');
      expect(data.user).toHaveProperty('isActive', true);
      
      // CRITICAL CHECK: passwordHash must NOT be in the response
      expect(data.user).not.toHaveProperty('passwordHash');
      expect(data.user).not.toHaveProperty('password_hash');
      expect(JSON.stringify(data)).not.toContain('passwordHash');
      expect(JSON.stringify(data)).not.toContain('$2b$'); // Common bcrypt prefix

      // VERIFY POST-LOGIN REQUEST: /api/v1/system/setup-status
      const setupRes = await fetch(`http://localhost:${PORT}/api/v1/system/setup-status`, {
        headers: { 'Authorization': `Bearer ${data.token}` }
      });
      expect(setupRes.status).toBe(200);
      const setupData = await setupRes.json();
      expect(setupData).toHaveProperty('setupComplete');
    });
  });
});
