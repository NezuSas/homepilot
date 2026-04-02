import { bootstrap, BootstrapContainer } from '../bootstrap';
import { OperatorConsoleServer } from '../apps/api/OperatorConsoleServer';
import { SqliteDatabaseManager } from '../packages/shared/infrastructure/database/SqliteDatabaseManager';
import { AutomationRule } from '../packages/devices/domain/automation/types';
import { Device } from '../packages/devices/domain/types';
import { Home } from '../packages/topology/domain/types';

/**
 * Tests de integración para OperatorConsoleServer.
 * Versión final endurecida sin 'any' y con cobertura total de Automation Workbench.
 */
describe('OperatorConsoleServer Integration Tests (Hardened Final)', () => {
  let server: OperatorConsoleServer;
  let container: BootstrapContainer;
  const PORT = 3001;
  const DB_PATH = 'test.final.db';

  beforeAll(async () => {
    // Inicialización del sistema vía bootstrap real (crea esquema y repositorios)
    container = await bootstrap({ dbPath: DB_PATH, verbose: false });

    const db = SqliteDatabaseManager.getInstance(DB_PATH);
    // Limpieza atómica para aislamiento de tests
    db.exec(`
      DELETE FROM automation_rules;
      DELETE FROM devices;
      DELETE FROM rooms;
      DELETE FROM homes;
    `);

    const now = new Date().toISOString();
    // Poblando datos semilla necesarios para validación de slices previos y nuevo workbench
    db.prepare("INSERT INTO homes (id, owner_id, name, entity_version, created_at, updated_at) VALUES ('h-01', 'u-01', 'H', 1, ?, ?)")
      .run(now, now);
    db.prepare("INSERT INTO rooms (id, home_id, name, entity_version, created_at, updated_at) VALUES ('r-01', 'h-01', 'Living', 1, ?, ?)")
      .run(now, now);
    db.prepare("INSERT INTO devices (id, home_id, external_id, name, type, vendor, status, room_id, last_known_state, entity_version, created_at, updated_at) VALUES ('d-01', 'h-01', 'ext-1', 'L', 'light', 'v', 'ASSIGNED', 'r-01', ?, 1, ?, ?)")
      .run(JSON.stringify({ on: false }), now, now);

    server = new OperatorConsoleServer(container, DB_PATH, PORT);
    server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  describe('Automation Workbench API', () => {
    const rid = 'rule-final-01';

    beforeAll(async () => {
      // Registrar regla inicial para validar operaciones PATCH y GET
      await container.repositories.automationRuleRepository.save({
        id: rid, homeId: 'h-01', userId: 'u-01', name: 'R', enabled: true,
        trigger: { deviceId: 'd-01', stateKey: 'on', expectedValue: true },
        action: { targetDeviceId: 'd-01', command: 'turn_off' }
      });
    });

    it('GET /api/v1/automations: debe listar reglas correctamente', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/v1/automations`);
      expect(res.status).toBe(200);
      const data = await res.json() as AutomationRule[];
      expect(data.some(r => r.id === rid)).toBe(true);
    });

    it('PATCH /api/v1/automations/:id/disable: debe persistir estado inactivo', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/v1/automations/${rid}/disable`, { method: 'PATCH' });
      expect(res.status).toBe(200);
      const data = await res.json() as AutomationRule;
      expect(data.enabled).toBe(false);
      
      const inDb = await container.repositories.automationRuleRepository.findById(rid);
      expect(inDb?.enabled).toBe(false);
    });

    it('PATCH /api/v1/automations/:id/enable: debe restaurar estado activo', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/v1/automations/${rid}/enable`, { method: 'PATCH' });
      expect(res.status).toBe(200);
      const data = await res.json() as AutomationRule;
      expect(data.enabled).toBe(true);
    });

    it('PATCH /api/v1/automations/:id/enable: debe fallar con 404 para ID inexistente', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/v1/automations/fake-id/enable`, { method: 'PATCH' });
      expect(res.status).toBe(404);
      const data = await res.json() as { error: string };
      expect(data.error).toContain('fake-id');
    });
  });

  describe('Legacy Slice Integrity (Assign & Command)', () => {
    it('POST /api/v1/devices/:id/command: debe fallar con 400 si comando no es válido', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/v1/devices/d-01/command`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'invalid_cmd' })
      });
      expect(res.status).toBe(400);
      const data = await res.json() as { error: string };
      expect(data.error).toContain('Invalid or missing command');
    });

    it('POST /api/v1/devices/:id/assign: debe fallar con 400 si falta roomId', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/v1/devices/d-01/assign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      expect(res.status).toBe(400);
      const data = await res.json() as { error: string };
      expect(data.error).toBe('Missing roomId');
    });

    it('POST /api/v1/devices/:id/assign: debe fallar con 404 si habitacion no existe', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/v1/devices/d-01/assign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: 'ghost-room' })
      });
      expect(res.status).toBe(404);
      const data = await res.json() as { error: string };
      expect(data.error).toBe('Room not found');
    });
  });
});
