import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SQLiteNativeCameraSourceRepository } from '../infrastructure/repositories/SQLiteNativeCameraSourceRepository';
import { SqliteDatabaseManager } from '../../shared/infrastructure/database/SqliteDatabaseManager';

describe('SQLiteNativeCameraSourceRepository', () => {
  const dbPath = path.join(os.tmpdir(), `homepilot-native-camera-source-${process.pid}.db`);

  beforeEach(() => {
    SqliteDatabaseManager.closeAll();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    const db = SqliteDatabaseManager.getInstance(dbPath);
    db.exec(`
      CREATE TABLE native_camera_sources (
        device_id TEXT PRIMARY KEY, home_id TEXT NOT NULL, source_type TEXT NOT NULL,
        name TEXT NOT NULL, host TEXT NOT NULL, onvif_port INTEGER NOT NULL,
        rtsp_port INTEGER NOT NULL, username TEXT NOT NULL, password TEXT NOT NULL,
        rtsp_path TEXT NOT NULL, enabled INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
    `);
  });

  afterEach(() => {
    SqliteDatabaseManager.closeAll();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  const source = (overrides = {}) => ({
    deviceId: 'camera-1', homeId: 'home-1', sourceType: 'rtsp-dvr' as const,
    name: 'DVR', host: '192.168.1.20', onvifPort: 80, rtspPort: 554,
    username: 'admin', password: 'secret', rtspPath: '/stream', enabled: true,
    createdAt: '2026-08-11T00:00:00.000Z', updatedAt: '2026-08-11T00:00:00.000Z',
    ...overrides,
  });

  it('returns the complete source in domain form for an enabled native camera', () => {
    const repository = new SQLiteNativeCameraSourceRepository(dbPath);
    repository.save(source());

    expect(repository.findByDeviceId('camera-1')).toEqual(source());
  });

  it('lists sources by home and detects duplicates without matching the excluded camera', () => {
    const repository = new SQLiteNativeCameraSourceRepository(dbPath);
    repository.save(source());

    expect(repository.findByHomeId('home-1')).toEqual([source()]);
    expect(repository.findDuplicate('home-1', '192.168.1.20', 554, '/stream')).toEqual(source());
    expect(repository.findDuplicate('home-1', '192.168.1.20', 554, '/stream', 'camera-1')).toBeNull();
  });

  it('updates an existing source and returns null when no source exists', () => {
    const repository = new SQLiteNativeCameraSourceRepository(dbPath);
    repository.save(source());
    repository.save(source({ name: 'Updated DVR', enabled: false, updatedAt: '2026-08-12T00:00:00.000Z' }));

    expect(repository.findByDeviceId('camera-1')).toEqual(source({ name: 'Updated DVR', enabled: false, updatedAt: '2026-08-12T00:00:00.000Z' }));
    expect(repository.findByDeviceId('missing')).toBeNull();
  });
});