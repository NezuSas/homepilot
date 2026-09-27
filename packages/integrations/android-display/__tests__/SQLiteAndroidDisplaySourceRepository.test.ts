import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Device } from '../../../devices/domain/types';
import { SqliteDatabaseManager } from '../../../shared/infrastructure/database/SqliteDatabaseManager';
import type { AndroidDisplaySource } from '../domain/AndroidDisplaySource';
import { SQLiteAndroidDisplaySourceRepository } from '../infrastructure/SQLiteAndroidDisplaySourceRepository';

describe('SQLiteAndroidDisplaySourceRepository', () => {
  let folder: string;
  let dbPath: string;
  beforeEach(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'hp-display-test-'));
    dbPath = path.join(folder, 'test.db');
    const db = SqliteDatabaseManager.getInstance(dbPath);
    db.exec(`CREATE TABLE homes (id TEXT PRIMARY KEY);
      CREATE TABLE devices (id TEXT PRIMARY KEY, home_id TEXT NOT NULL, room_id TEXT,
        external_id TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, vendor TEXT NOT NULL,
        status TEXT NOT NULL, integration_source TEXT NOT NULL, invert_state INTEGER NOT NULL,
        last_known_state TEXT, entity_version INTEGER NOT NULL, created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL, semantic_type TEXT,
        FOREIGN KEY(home_id) REFERENCES homes(id), UNIQUE(home_id, external_id));
      INSERT INTO homes (id) VALUES ('home-1');`);
    db.exec(fs.readFileSync(path.resolve(__dirname, '../../../../migrations/029_create_android_display_sources.sql'), 'utf8'));
  });
  afterEach(() => {
    SqliteDatabaseManager.closeAll();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    fs.rmdirSync(folder);
  });

  const device = (id: string): Device => ({
    id, homeId: 'home-1', roomId: null, externalId: `android-display:${id}`, name: 'Pizarra',
    type: 'smart_display', semanticType: 'smart_display', vendor: 'Droidlogic', status: 'PENDING',
    integrationSource: 'android-display', invertState: false, lastKnownState: { connectionState: 'online' },
    entityVersion: 1, createdAt: '2026-01-01', updatedAt: '2026-01-01',
  });
  const source = (id: string, host = '192.168.1.37'): AndroidDisplaySource => ({
    deviceId: id, homeId: 'home-1', adbHost: host, adbPort: 5555, enabled: true,
    createdAt: '2026-01-01', updatedAt: '2026-01-01', connectionState: 'online',
    lastSeenAt: '2026-01-01', metadata: {
      adbSerial: `${host}:5555`, androidId: 'android-1', manufacturer: 'Droidlogic', model: 'C-T982',
      androidVersion: '11', resolution: '3840x2160', densityDpi: 480, screenState: 'awake',
    },
  });

  it('atomically persists a stable device, endpoint and separate observation', () => {
    const repository = new SQLiteAndroidDisplaySourceRepository(dbPath);
    repository.createWithDevice(device('d-1'), source('d-1'));
    expect(repository.findByDeviceId('d-1')).toEqual(source('d-1'));
    expect(repository.findByEndpoint('192.168.1.37', 5555)?.deviceId).toBe('d-1');
    expect(repository.findByAndroidId('android-1')?.deviceId).toBe('d-1');
    expect(repository.listByHomeId('home-1')).toHaveLength(1);
    const db = SqliteDatabaseManager.getInstance(dbPath);
    expect(db.prepare('SELECT id, semantic_type FROM devices WHERE id = ?').get('d-1'))
      .toEqual({ id: 'd-1', semantic_type: 'smart_display' });
    expect(db.prepare('SELECT * FROM android_display_sources').all()[0]).not.toHaveProperty('android_id');
  });

  it('rolls back the device insert if an endpoint already exists', () => {
    const repository = new SQLiteAndroidDisplaySourceRepository(dbPath);
    repository.createWithDevice(device('d-1'), source('d-1'));
    expect(() => repository.createWithDevice(device('d-2'), source('d-2'))).toThrow();
    expect(SqliteDatabaseManager.getInstance(dbPath).prepare('SELECT id FROM devices WHERE id = ?').get('d-2'))
      .toBeUndefined();
  });

  it('refreshes observed state without changing endpoint or stable identity', () => {
    const repository = new SQLiteAndroidDisplaySourceRepository(dbPath);
    repository.createWithDevice(device('d-1'), source('d-1'));
    repository.updateObservation({ ...source('d-1'), connectionState: 'offline',
      metadata: { ...source('d-1').metadata, screenState: 'unknown' } });
    expect(repository.findByDeviceId('d-1')).toEqual(expect.objectContaining({
      deviceId: 'd-1', adbHost: '192.168.1.37', connectionState: 'offline',
      metadata: expect.objectContaining({ screenState: 'unknown' }),
    }));
    const row = SqliteDatabaseManager.getInstance(dbPath).prepare('SELECT last_known_state FROM devices WHERE id = ?')
      .get('d-1') as { last_known_state: string };
    expect(JSON.parse(row.last_known_state)).toEqual({ connectionState: 'offline', screenState: 'unknown' });
  });
});
