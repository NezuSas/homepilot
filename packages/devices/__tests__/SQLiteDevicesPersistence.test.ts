import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { SQLiteDeviceRepository } from '../infrastructure/repositories/SQLiteDeviceRepository';
import { SQLiteAutomationRuleRepository } from '../infrastructure/repositories/SQLiteAutomationRuleRepository';
import { SQLiteActivityLogRepository } from '../infrastructure/repositories/SQLiteActivityLogRepository';
import { SqliteDatabaseManager } from '../../shared/infrastructure/database/SqliteDatabaseManager';
import { SqliteMigrationsRunner } from '../../shared/infrastructure/database/SqliteMigrationsRunner';
import { Database as SqliteDatabase } from 'better-sqlite3';
import { Device } from '../domain/types';
import { AutomationRule } from '../domain/automation/types';
import { ActivityRecord } from '../domain/repositories/ActivityLogRepository';

describe('SQLite Devices Persistence Integration', () => {
  let dbPath: string;
  let db: SqliteDatabase;
  let deviceRepo: SQLiteDeviceRepository;
  let ruleRepo: SQLiteAutomationRuleRepository;
  let logRepo: SQLiteActivityLogRepository;

  beforeAll(() => {
    dbPath = path.join(__dirname, `test-devices-${randomUUID()}.db`);
    db = SqliteDatabaseManager.getInstance(dbPath, false);
    const migrationsDir = path.join(__dirname, '../../../migrations');
    
    const runner = new SqliteMigrationsRunner(db);
    runner.run(migrationsDir);
    
    // Topología dura necesaria para superar la restricción FOREIGN KEY ON UPDATE CASCADE
    db.exec(`
      INSERT INTO homes (id, owner_id, name) VALUES ('home-1', 'user-1', 'Casa Test');
      INSERT INTO rooms (id, home_id, name) VALUES ('room-1', 'home-1', 'Sala Test');
    `);

    deviceRepo = new SQLiteDeviceRepository(dbPath);
    ruleRepo = new SQLiteAutomationRuleRepository(dbPath);
    logRepo = new SQLiteActivityLogRepository(dbPath);
  });

  afterAll(() => {
    SqliteDatabaseManager.closeAll();
    // Limpiar restos de transacciones de prueba
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  });

  describe('DeviceRepository', () => {
    it('debe guardar un Device y recuperarlo por id exacto', async () => {
      const device: Device = {
        id: 'dev-1',
        homeId: 'home-1',
        roomId: null,
        externalId: 'ext-abc',
        name: 'Luz Secundaria',
        type: 'light',
        vendor: 'Shelly',
        status: 'PENDING',
        integrationSource: 'ha',
        invertState: false,
        lastKnownState: { on: true },
        entityVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await deviceRepo.saveDevice(device);

      const retrieved = await deviceRepo.findDeviceById('dev-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.externalId).toBe('ext-abc');
      expect(retrieved?.lastKnownState).toEqual({ on: true });
    });

    it('findByExternalIdAndHomeId localiza el registro correctamente', async () => {
      const retrieved = await deviceRepo.findByExternalIdAndHomeId('ext-abc', 'home-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('dev-1');
    });

    it('persists and returns semanticType=light', async () => {
      const device: Device = {
        id: 'dev-semantic-1',
        homeId: 'home-1',
        roomId: null,
        externalId: 'ext-semantic',
        name: 'Luz Semántica',
        type: 'switch', // Hardware is switch
        semanticType: 'light', // Semantically classified as light
        vendor: 'Sonoff',
        status: 'PENDING',
        integrationSource: 'ha',
        invertState: false,
        lastKnownState: null,
        entityVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await deviceRepo.saveDevice(device);

      const retrieved = await deviceRepo.findDeviceById('dev-semantic-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.type).toBe('switch');
      expect(retrieved?.semanticType).toBe('light');

      const all = await deviceRepo.findAll();
      const foundInAll = all.find(d => d.id === 'dev-semantic-1');
      expect(foundInAll?.semanticType).toBe('light');
    });

    it('updateSemanticType updates only semanticType and updatedAt', async () => {
      const original = await deviceRepo.findDeviceById('dev-semantic-1');
      expect(original).not.toBeNull();
      if (!original) return;

      const oldUpdatedAt = original.updatedAt;

      // Small delay to ensure updatedAt changes if fast
      await new Promise(r => setTimeout(r, 10));

      await deviceRepo.updateSemanticType('dev-semantic-1', 'sensor');

      const updated = await deviceRepo.findDeviceById('dev-semantic-1');
      expect(updated).not.toBeNull();
      expect(updated?.semanticType).toBe('sensor');
      expect(updated?.updatedAt).not.toBe(oldUpdatedAt);
      
      // Check other fields remain intact
      expect(updated?.name).toBe(original.name);
      expect(updated?.type).toBe(original.type);
      expect(updated?.status).toBe(original.status);
      expect(updated?.integrationSource).toBe(original.integrationSource);
      
      // Set to null
      await deviceRepo.updateSemanticType('dev-semantic-1', null);
      const cleared = await deviceRepo.findDeviceById('dev-semantic-1');
      expect(cleared?.semanticType).toBeUndefined();
    });

    it('findInboxByHomeId retorna solo aquellos dispositivos en estado PENDING sin room', async () => {
      const inbox = await deviceRepo.findInboxByHomeId('home-1');
      expect(inbox).toHaveLength(2); // dev-1 and dev-semantic-1
      expect(inbox.some(d => d.id === 'dev-1')).toBe(true);

      // Sacar dev-1 de la bandeja reasignando habitación y completando estatus
      const retrieved = await deviceRepo.findDeviceById('dev-1');
      if (retrieved) {
         await deviceRepo.saveDevice({
           ...retrieved,
           roomId: 'room-1',
           status: 'ASSIGNED'
         });
      }

      const inboxAfter = await deviceRepo.findInboxByHomeId('home-1');
      expect(inboxAfter).toHaveLength(1); // Only dev-semantic-1 remains
    });

    it('protege ante la repetición de descubrimiento gracias a la restricción UNIQUE compositiva', async () => {
      const duplicateDevice: Device = {
        id: 'dev-2', // ID diferente
        homeId: 'home-1', 
        roomId: null,
        externalId: 'ext-abc', // El mismo external ID dentro del mismo Hogar!
        name: 'Luz Repetida',
        type: 'light',
        vendor: 'Shelly',
        status: 'PENDING',
        integrationSource: 'ha',
        invertState: false,
        lastKnownState: null,
        entityVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await expect(deviceRepo.saveDevice(duplicateDevice)).rejects.toThrow();
    });
  });

  describe('DeviceRepository additional query and state contracts', () => {
    it('filters home and prefix queries, returns missing identifiers, and maps invalid JSON state safely', async () => {
      db.exec("INSERT INTO homes (id, owner_id, name) VALUES ('home-2', 'user-2', 'Casa Dos')");
      await deviceRepo.saveDevice({ id: 'dev-prefix', homeId: 'home-2', roomId: null, externalId: 'ha:switch.prefix', name: 'Prefix', type: 'switch', vendor: 'HA', status: 'ASSIGNED', integrationSource: 'ha', invertState: true, lastKnownState: null, entityVersion: 1, createdAt: '2026-04-02T00:00:00Z', updatedAt: '' });
      db.prepare('UPDATE devices SET last_known_state = ? WHERE id = ?').run('{not-json', 'dev-prefix');

      await expect(deviceRepo.findAllByHomeId('home-2')).resolves.toEqual([expect.objectContaining({ id: 'dev-prefix', invertState: true, lastKnownState: null })]);
      await expect(deviceRepo.findAllExternalIdsByPrefix('ha:')).resolves.toContain('ha:switch.prefix');
      await expect(deviceRepo.findByExternalId('ha:switch.prefix')).resolves.toEqual(expect.objectContaining({ id: 'dev-prefix' }));
      await expect(deviceRepo.findByExternalId('missing')).resolves.toBeNull();
      await expect(deviceRepo.findByExternalIdAndHomeId('ha:switch.prefix', 'home-1')).resolves.toBeNull();
    });

    it('deletes existing or missing devices silently and exposes deterministic status ordering', async () => {
      const ordered = await deviceRepo.findAllOrderedByStatus();
      expect(ordered.every(device => device.status === 'PENDING' || device.status === 'ASSIGNED')).toBe(true);
      await deviceRepo.deleteDevice('dev-prefix');
      await deviceRepo.deleteDevice('missing');
      await expect(deviceRepo.findDeviceById('dev-prefix')).resolves.toBeNull();
    });
  });
  describe('AutomationRuleRepository', () => {
    const rule: AutomationRule = {
      id: 'rule-1',
      homeId: 'home-1',
      userId: 'user-1',
      name: 'Activar Luz de Noche',
      enabled: true,
      trigger: { type: 'device_state_changed' as const, deviceId: 'dev-1', stateKey: 'motion', expectedValue: true },
      action: { type: 'device_command' as const, targetDeviceId: 'dev-1', command: 'turn_on' as any }
    };

    it('debe guardar y recuperar una regla, reconstruyendo payloads en memoria', async () => {
      await ruleRepo.save(rule);

      const retrieved = await ruleRepo.findById('rule-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.enabled).toBe(true);
      expect((retrieved?.trigger as any).deviceId).toBe('dev-1');
      expect((retrieved?.action as any).command).toBe('turn_on');
    });

    it('findByTriggerDevice devuelve solo reglas en estado activo', async () => {
      const rules = await ruleRepo.findByTriggerDevice('dev-1');
      expect(rules).toHaveLength(1);

      await ruleRepo.save({ ...rule, enabled: false });

      const rulesAfter = await ruleRepo.findByTriggerDevice('dev-1');
      expect(rulesAfter).toHaveLength(0);
    });

    it('maps legacy and incomplete time payloads while preserving home and global queries', async () => {
      db.prepare(`
        INSERT INTO automation_rules (id, home_id, user_id, name, enabled, trigger, action, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'rule-legacy',
        'home-1',
        'user-1',
        'Legacy',
        1,
        JSON.stringify({ deviceId: 'legacy-sensor', stateKey: 'state', expectedValue: 'on' }),
        JSON.stringify({ targetDeviceId: 'legacy-light', command: 'turn_on' }),
        '2026-08-17T00:00:00.000Z',
      );
      db.prepare(`
        INSERT INTO automation_rules (id, home_id, user_id, name, enabled, trigger, action, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'rule-legacy-time',
        'home-1',
        'user-1',
        'Legacy time',
        0,
        JSON.stringify({ type: 'time', time: '14:15' }),
        JSON.stringify({ type: 'execute_scene', sceneId: 'scene-1' }),
        '2026-08-17T00:01:00.000Z',
      );

      const legacy = await ruleRepo.findById('rule-legacy');
      const legacyTime = await ruleRepo.findById('rule-legacy-time');
      const allForHome = await ruleRepo.findByHomeId('home-1');
      const all = await ruleRepo.findAll();

      expect(legacy).toEqual(expect.objectContaining({
        trigger: expect.objectContaining({ type: 'device_state_changed', deviceId: 'legacy-sensor' }),
        action: expect.objectContaining({ type: 'device_command', targetDeviceId: 'legacy-light' }),
      }));
      expect(legacyTime?.trigger).toEqual(expect.objectContaining({ type: 'time', timeLocal: '14:15', timezone: 'UTC', timeUTC: expect.any(String) }));
      expect(allForHome.map(item => item.id)).toEqual(expect.arrayContaining(['rule-legacy', 'rule-legacy-time']));
      expect(all.map(item => item.id)).toEqual(expect.arrayContaining(['rule-legacy', 'rule-legacy-time']));
      await expect(ruleRepo.findById('missing-rule')).resolves.toBeNull();
    });

    it('rejects malformed persisted trigger or action payloads instead of silently changing the rule', async () => {
      db.prepare(`
        INSERT INTO automation_rules (id, home_id, user_id, name, enabled, trigger, action, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('rule-malformed-trigger', 'home-1', 'user-1', 'Broken trigger', 1, '{bad-json', JSON.stringify({ type: 'execute_scene', sceneId: 'scene-1' }), '2026-08-17T00:02:00.000Z');
      db.prepare(`
        INSERT INTO automation_rules (id, home_id, user_id, name, enabled, trigger, action, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('rule-malformed-action', 'home-1', 'user-1', 'Broken action', 1, JSON.stringify({ type: 'time', timeLocal: '12:00', timeUTC: '12:00', timezone: 'UTC' }), '{bad-json', '2026-08-17T00:03:00.000Z');

      await expect(ruleRepo.findById('rule-malformed-trigger')).rejects.toThrow('deserialización del trigger JSON');
      await expect(ruleRepo.findById('rule-malformed-action')).rejects.toThrow('deserialización de action JSON');
    });

    it('delete elimina la regla silenciosamente del sistema', async () => {
      await ruleRepo.delete('rule-1');
      const retrieved = await ruleRepo.findById('rule-1');
      expect(retrieved).toBeNull();
    });
  });

  describe('ActivityLogRepository', () => {
    it('inserta atómicamente y recupera de forma cronológica estricta (LIFO)', async () => {
      const log1: ActivityRecord = {
        timestamp: '2026-04-01T12:00:00Z',
        deviceId: 'dev-1',
        type: 'STATE_CHANGED',
        description: 'Sensor detectó movimiento',
        data: { state: 'DETECTED' }
      };

      const log2: ActivityRecord = {
        timestamp: '2026-04-01T12:01:00Z',
        deviceId: 'dev-1',
        type: 'COMMAND_DISPATCHED',
        description: 'Regla ejecutó comando',
        data: { source: 'auto_sys' }
      };

      await logRepo.saveActivity(log1);
      await logRepo.saveActivity(log2);

      const recent = await logRepo.findRecentByDeviceId('dev-1', 10);
      expect(recent).toHaveLength(2);
      
      // Demuestra orden cronológico reverso
      expect(recent[0].timestamp).toBe('2026-04-01T12:01:00Z');
      expect(recent[1].timestamp).toBe('2026-04-01T12:00:00Z');
      
      // Valida integridad en serialización JSON
      expect(recent[0].data).toEqual({ source: 'auto_sys' });
    });
    it('filters by type and time, handles empty filters, preserves correlation IDs, and safely maps malformed data', async () => {
      await logRepo.saveActivity({ timestamp: '2026-04-01T13:00:00Z', deviceId: 'dev-2', type: 'COMMAND_FAILED', description: 'Failure', data: {}, correlationId: 'corr-1' });
      db.prepare('INSERT INTO activity_logs (device_id, type, description, data, timestamp, correlation_id) VALUES (?, ?, ?, ?, ?, ?)').run('dev-3', 'STATE_CHANGED', 'Malformed', '{bad-json', '2026-04-01T14:00:00Z', null);

      await expect(logRepo.findAllByTypes([], '2026-04-01T00:00:00Z')).resolves.toEqual([]);
      await expect(logRepo.findAllByTypes(['COMMAND_FAILED'], '2026-04-01T12:30:00Z')).resolves.toEqual([
        expect.objectContaining({ description: 'Failure', correlationId: 'corr-1', data: {} })
      ]);
      await expect(logRepo.findAllRecent(1)).resolves.toEqual([
        expect.objectContaining({ description: 'Malformed', data: {} })
      ]);
    });
  });
});
