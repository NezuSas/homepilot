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

    it('findInboxByHomeId retorna solo aquellos dispositivos en estado PENDING sin room', async () => {
      const inbox = await deviceRepo.findInboxByHomeId('home-1');
      expect(inbox).toHaveLength(1);
      expect(inbox[0].id).toBe('dev-1');

      // Sacar de la bandeja reasignando habitación y completando estatus
      const retrieved = await deviceRepo.findDeviceById('dev-1');
      if (retrieved) {
         await deviceRepo.saveDevice({
           ...retrieved,
           roomId: 'room-1',
           status: 'ASSIGNED'
         });
      }

      const inboxAfter = await deviceRepo.findInboxByHomeId('home-1');
      expect(inboxAfter).toHaveLength(0);
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
        lastKnownState: null,
        entityVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await expect(deviceRepo.saveDevice(duplicateDevice)).rejects.toThrow();
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
  });
});
