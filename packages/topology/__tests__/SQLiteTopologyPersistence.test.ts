import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { SQLiteHomeRepository } from '../infrastructure/repositories/SQLiteHomeRepository';
import { SQLiteRoomRepository } from '../infrastructure/repositories/SQLiteRoomRepository';
import { SQLiteDashboardRepository } from '../infrastructure/repositories/SQLiteDashboardRepository';
import { SqliteDatabaseManager } from '../../shared/infrastructure/database/SqliteDatabaseManager';
import { SqliteMigrationsRunner } from '../../shared/infrastructure/database/SqliteMigrationsRunner';
import { Home, Room } from '../domain/types';
import { Dashboard } from '../domain/Dashboard';

describe('SQLite Topology Persistence Integration', () => {
  let dbPath: string;
  let homeRepo: SQLiteHomeRepository;
  let roomRepo: SQLiteRoomRepository;
  let dashboardRepo: SQLiteDashboardRepository;

  beforeAll(() => {
    dbPath = path.join(__dirname, `test-topology-${randomUUID()}.db`);
    const db = SqliteDatabaseManager.getInstance(dbPath, false);
    const migrationsDir = path.join(__dirname, '../../../migrations');
    
    // Setup estricto de esquema temporal
    const runner = new SqliteMigrationsRunner(db);
    runner.run(migrationsDir);
    
    homeRepo = new SQLiteHomeRepository(dbPath);
    roomRepo = new SQLiteRoomRepository(dbPath);
    dashboardRepo = new SQLiteDashboardRepository(dbPath);
  });

  afterAll(() => {
    SqliteDatabaseManager.closeAll();
    // Limpieza responsable de la BD de prueba y sus archivos auxiliares WAL/SHM
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  });

  it('debe persistir y recuperar un Home correctamente y validar owner_id', async () => {
    const home: Home = {
      id: 'home-1',
      ownerId: 'user-123',
      name: 'Mi Casa',
      entityVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await homeRepo.saveHome(home);

    const retrieved = await homeRepo.findHomeById('home-1');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(home.id);
    expect(retrieved?.ownerId).toBe(home.ownerId);

    const userHomes = await homeRepo.findHomesByUserId('user-123');
    expect(userHomes).toHaveLength(1);
    expect(userHomes[0].id).toBe('home-1');
  });

  it('debe actualizar los datos de un Home usando esquema de upsert', async () => {
    const updatedHome: Home = {
      id: 'home-1',
      ownerId: 'user-123',
      name: 'Mi Casa Actualizada',
      entityVersion: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await homeRepo.saveHome(updatedHome);

    const retrieved = await homeRepo.findHomeById('home-1');
    expect(retrieved?.name).toBe('Mi Casa Actualizada');
    expect(retrieved?.entityVersion).toBe(2);
  });

  it('debe persistir y recuperar una Room correctamente', async () => {
    const room: Room = {
      id: 'room-1',
      homeId: 'home-1',
      name: 'Sala',
      entityVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await roomRepo.saveRoom(room);

    const homeRooms = await roomRepo.findRoomsByHomeId('home-1');
    expect(homeRooms).toHaveLength(1);
    expect(homeRooms[0].id).toBe('room-1');
    expect(homeRooms[0].homeId).toBe(room.homeId);
  });

  it('debe actualizar el nombre de una Room sin cambiar su identidad ni su Home', async () => {
    const current = await roomRepo.findRoomById('room-1');
    expect(current).not.toBeNull();

    await roomRepo.saveRoom({
      ...current!,
      name: 'Sala principal',
      entityVersion: current!.entityVersion + 1,
      updatedAt: new Date().toISOString(),
    });

    const renamed = await roomRepo.findRoomById('room-1');
    expect(renamed).toEqual(expect.objectContaining({
      id: 'room-1',
      homeId: 'home-1',
      name: 'Sala principal',
      entityVersion: 2,
    }));
  });

  it('consolida la instalación Nezu retirando únicamente el hogar histórico autorizado', () => {
    const migrationDbPath = path.join(__dirname, `test-single-home-repair-${randomUUID()}.db`);
    const migrationDb = SqliteDatabaseManager.getInstance(migrationDbPath, false);
    const migrationsDir = path.join(__dirname, '../../../migrations');
    const migrationRunner = new SqliteMigrationsRunner(migrationDb);
    const migrationFiles = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql') && file < '026_remove_retired_nezu_office_home.sql').sort();

    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      migrationDb.exec(sql);
      migrationDb.prepare('CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)').run();
      migrationDb.prepare('INSERT OR IGNORE INTO _migrations (name) VALUES (?)').run(file);
    }

    migrationDb.prepare('INSERT INTO homes (id, owner_id, name, entity_version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)')
      .run('local-home', 'admin', 'Oficina', '2026-06-26T01:08:46.930Z', '2026-06-26T01:08:46.930Z');
    migrationDb.prepare('INSERT INTO homes (id, owner_id, name, entity_version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)')
      .run('d2765cc0-b139-4582-883e-ffe4613adf14', 'admin', 'Nezu Oficina🇪🇨', '2026-06-30T00:39:12.240Z', '2026-06-30T00:39:12.240Z');
    migrationDb.prepare('INSERT INTO devices (id, home_id, room_id, external_id, name, type, vendor, status, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)')
      .run('active-device', 'local-home', 'active-external', 'Activo', 'light', 'test', 'ASSIGNED', '2026-06-26T01:08:46.930Z', '2026-06-26T01:08:46.930Z');
    migrationDb.prepare('INSERT INTO devices (id, home_id, room_id, external_id, name, type, vendor, status, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)')
      .run('retired-device', 'd2765cc0-b139-4582-883e-ffe4613adf14', 'retired-external', 'Retirado', 'light', 'test', 'ASSIGNED', '2026-06-30T00:39:12.240Z', '2026-06-30T00:39:12.240Z');

    migrationRunner.run(migrationsDir);

    expect(migrationDb.prepare('SELECT id FROM homes ORDER BY id').all()).toEqual([{ id: 'local-home' }]);
    expect(migrationDb.prepare('SELECT id FROM devices ORDER BY id').all()).toEqual([{ id: 'active-device' }]);

    SqliteDatabaseManager.close(migrationDbPath);
    fs.unlinkSync(migrationDbPath);
  });
  it('publica el dashboard padre cuando una pestaña autoriza al usuario', async () => {
    const now = new Date().toISOString();
    const dashboard: Dashboard = {
      id: 'dashboard-oscar',
      ownerId: 'oscar-user',
      title: 'Oscar',
      visibility: { roles: ['admin'], users: ['oscar-user'], homes: [] },
      tabs: [
        { id: 'tab-private', title: 'Privada', widgets: [], visibility: { users: ['oscar-user'] } },
        { id: 'tab-gustavo', title: 'Compartida', widgets: [], visibility: { users: ['gustavo-user'] } },
      ],
      createdAt: now,
      updatedAt: now,
    };

    await dashboardRepo.saveDashboard(dashboard);

    const ownerDashboards = await dashboardRepo.findAllVisibleTo('oscar-user', 'admin', []);
    const adminDashboards = await dashboardRepo.findAllVisibleTo('admin-user', 'admin', []);
    const gustavoDashboards = await dashboardRepo.findAllVisibleTo('gustavo-user', 'guest', []);

    expect(ownerDashboards.some(item => item.id === dashboard.id)).toBe(true);
    expect(adminDashboards.some(item => item.id === dashboard.id)).toBe(false);
    expect(gustavoDashboards.some(item => item.id === dashboard.id)).toBe(true);
  });

  it('persists dashboard revisions ordered from newest to oldest', async () => {
    await dashboardRepo.saveRevision({
      id: 'revision-old',
      dashboardId: 'dashboard-oscar',
      createdAt: '2026-01-01T10:00:00.000Z',
      snapshot: { title: 'Primera versión', visibility: { roles: [], users: [], homes: [] }, tabs: [] },
    });
    await dashboardRepo.saveRevision({
      id: 'revision-new',
      dashboardId: 'dashboard-oscar',
      createdAt: '2026-01-01T11:00:00.000Z',
      snapshot: { title: 'Segunda versión', visibility: { roles: [], users: [], homes: [] }, tabs: [] },
    });

    const revisions = await dashboardRepo.findRevisionsByDashboardId('dashboard-oscar');

    expect(revisions.map((revision) => revision.id)).toEqual(['revision-new', 'revision-old']);
    expect(revisions[0].snapshot.title).toBe('Segunda versión');
  });
});
