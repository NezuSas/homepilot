import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { SQLiteHomeRepository } from '../infrastructure/repositories/SQLiteHomeRepository';
import { SQLiteRoomRepository } from '../infrastructure/repositories/SQLiteRoomRepository';
import { SqliteDatabaseManager } from '../../shared/infrastructure/database/SqliteDatabaseManager';
import { SqliteMigrationsRunner } from '../../shared/infrastructure/database/SqliteMigrationsRunner';
import { Home, Room } from '../domain/types';

describe('SQLite Topology Persistence Integration', () => {
  let dbPath: string;
  let homeRepo: SQLiteHomeRepository;
  let roomRepo: SQLiteRoomRepository;

  beforeAll(() => {
    dbPath = path.join(__dirname, `test-topology-${randomUUID()}.db`);
    const db = SqliteDatabaseManager.getInstance(dbPath, false);
    const migrationsDir = path.join(__dirname, '../../../migrations');
    
    // Setup estricto de esquema temporal
    const runner = new SqliteMigrationsRunner(db);
    runner.run(migrationsDir);
    
    homeRepo = new SQLiteHomeRepository(dbPath);
    roomRepo = new SQLiteRoomRepository(dbPath);
  });

  afterAll(() => {
    SqliteDatabaseManager.close();
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
});
