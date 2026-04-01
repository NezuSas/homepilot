import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { bootstrap } from '../bootstrap';
import { SqliteDatabaseManager } from '../packages/shared/infrastructure/database/SqliteDatabaseManager';
import { Home } from '../packages/topology/domain/types';

describe('Bootstrap Integration', () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(__dirname, `test-bootstrap-${randomUUID()}.db`);
  });

  afterEach(() => {
    SqliteDatabaseManager.close();
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
    SqliteDatabaseManager.close();

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
});
