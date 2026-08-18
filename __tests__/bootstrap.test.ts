import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { bootstrap } from '../bootstrap';
import { SqliteDatabaseManager } from '../packages/shared/infrastructure/database/SqliteDatabaseManager';
import { Home } from '../packages/topology/domain/types';
import { Device } from '../packages/devices/domain/types';
import { AutomationRule } from '../packages/devices/domain/automation/types';
import { ActivityRecord } from '../packages/devices/domain/repositories/ActivityLogRepository';

describe('Bootstrap Integration', () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(__dirname, `test-bootstrap-${randomUUID()}.db`);
  });

  afterEach(() => {
    SqliteDatabaseManager.closeAll();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  });

  it('debe crear la base de datos local predefinida, aplicar migraciones e inyectar el container completo', async () => {
    expect(fs.existsSync(dbPath)).toBe(false);

    const container = await bootstrap({
      dbPath: dbPath,
      migrationsDir: path.join(__dirname, '../migrations'),
      verbose: false
    });

    expect(fs.existsSync(dbPath)).toBe(true);
    expect(container.repositories.homeRepository).toBeDefined();
    expect(container.repositories.deviceRepository).toBeDefined();

    // Verificación de atomicidad y schema validation
    const db = SqliteDatabaseManager.getInstance(dbPath);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {name: string}[];
    const tableNames = tables.map(t => t.name);

    expect(tableNames).toContain('_migrations');
    expect(tableNames).toContain('devices');
    expect(tableNames).toContain('homes');
  });

  it('reports the explicitly enabled local language model without changing bootstrap wiring', async () => {
    const previousEnabled = process.env.OLLAMA_ENABLED;
    const previousModel = process.env.OLLAMA_MODEL;
    const previousBaseUrl = process.env.OLLAMA_BASE_URL;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    process.env.OLLAMA_ENABLED = 'true';
    process.env.OLLAMA_MODEL = 'test-model';
    process.env.OLLAMA_BASE_URL = 'http://ollama.test:11434';

    try {
      await bootstrap({
        dbPath,
        migrationsDir: path.join(__dirname, '../migrations'),
        verbose: false,
      });

      expect(logSpy).toHaveBeenCalledWith(
        '[Assistant] Ollama enabled: model=test-model, baseUrl=http://ollama.test:11434',
      );
    } finally {
      if (previousEnabled === undefined) delete process.env.OLLAMA_ENABLED;
      else process.env.OLLAMA_ENABLED = previousEnabled;
      if (previousModel === undefined) delete process.env.OLLAMA_MODEL;
      else process.env.OLLAMA_MODEL = previousModel;
      if (previousBaseUrl === undefined) delete process.env.OLLAMA_BASE_URL;
      else process.env.OLLAMA_BASE_URL = previousBaseUrl;
      logSpy.mockRestore();
    }
  });

  it('proceso de reinicio (warm reload) debe conservar de forma transparente el nivel de persistencia durable', async () => {
    const container1 = await bootstrap({
      dbPath: dbPath,
      migrationsDir: path.join(__dirname, '../migrations'),
      verbose: false
    });

    const home: Home = {
      id: 'home-warm',
      ownerId: 'user-warm',
      name: 'Casa Persistente',
      entityVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await container1.repositories.homeRepository.saveHome(home);

    // Simular un kill síncrono del backend/app process
    SqliteDatabaseManager.closeAll();

    // El sistema se rearma leyendo la topología conservada
    const container2 = await bootstrap({
      dbPath: dbPath,
      migrationsDir: path.join(__dirname, '../migrations'),
      verbose: false
    });

    const retrievedHome = await container2.repositories.homeRepository.findHomeById('home-warm');
    expect(retrievedHome).not.toBeNull();
    expect(retrievedHome?.name).toBe('Casa Persistente');
  });
  it('Scenario: Given device state, automation and activity When SQLite restarts Then all durable records retain their typed data', async () => {
    const container1 = await bootstrap({
      dbPath,
      migrationsDir: path.join(__dirname, '../migrations'),
      verbose: false,
    });
    const now = new Date().toISOString();
    const home: Home = {
      id: 'home-durable',
      ownerId: 'user-durable',
      name: 'Casa durable',
      entityVersion: 1,
      createdAt: now,
      updatedAt: now,
    };
    const device: Device = {
      id: 'device-durable',
      homeId: home.id,
      roomId: null,
      externalId: 'ha-light-durable',
      name: 'Luz durable',
      type: 'light',
      vendor: 'Home Assistant',
      status: 'ASSIGNED',
      integrationSource: 'ha',
      invertState: false,
      lastKnownState: { state: 'on', brightness: 127 },
      entityVersion: 1,
      createdAt: now,
      updatedAt: now,
    };
    const rule: AutomationRule = {
      id: 'rule-durable',
      homeId: home.id,
      userId: home.ownerId,
      name: 'Apagar luz durable',
      enabled: false,
      trigger: {
        type: 'device_state_changed',
        deviceId: device.id,
        stateKey: 'state',
        expectedValue: 'on',
      },
      action: {
        type: 'device_command',
        targetDeviceId: device.id,
        command: 'turn_off',
      },
    };
    const activity: ActivityRecord = {
      timestamp: now,
      deviceId: device.id,
      type: 'STATE_CHANGED',
      description: 'Estado durable actualizado',
      data: { source: 'reboot-test', state: device.lastKnownState },
    };

    await container1.repositories.homeRepository.saveHome(home);
    await container1.repositories.deviceRepository.saveDevice(device);
    await container1.repositories.automationRuleRepository.save(rule);
    await container1.repositories.activityLogRepository.saveActivity(activity);

    SqliteDatabaseManager.closeAll();

    const container2 = await bootstrap({
      dbPath,
      migrationsDir: path.join(__dirname, '../migrations'),
      verbose: false,
    });
    const persistedDevice = await container2.repositories.deviceRepository.findDeviceById(device.id);
    const persistedRule = await container2.repositories.automationRuleRepository.findById(rule.id);
    const persistedActivity = await container2.repositories.activityLogRepository.findRecentByDeviceId(device.id, 1);

    expect(persistedDevice?.lastKnownState).toEqual(device.lastKnownState);
    expect(persistedRule).toEqual(rule);
    expect(persistedActivity).toEqual([activity]);
  });
});
