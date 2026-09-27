import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteDatabaseManager } from '../../shared/infrastructure/database/SqliteDatabaseManager';
import { parseManifestBundleV1 } from '../application/ManifestBundleV1';
import { ManifestInstallationMismatchError, SqliteManifestCacheRepository } from './SqliteManifestCacheRepository';

const installationId = 'c68ef027-a00e-4703-9338-397e96e153cd';
const otherInstallationId = '098ced36-2143-4ca2-a1fb-3afdc32117b7';
const deviceId = '33dfef68-0d46-4fdd-aef0-8b249a32de4e';
const otherDeviceId = '76512cb7-7c2e-4182-ac36-e43733277440';
const firstTime = '2026-09-27T00:00:00.000Z';
const secondTime = '2026-09-27T00:01:00.000Z';

function bundle(id = installationId, boardId = 5, homePilotDeviceId = deviceId) {
  return parseManifestBundleV1({
    schemaVersion: 'homepilot.manifest-bundle.v1', installationId: id,
    manifests: [{ schemaVersion: 'homepilot.board-manifest.v1', revision: 'a'.repeat(64),
      boardId, installationId: id, homePilotDeviceId, planId: 2, actions: [] }],
  });
}

describe('SqliteManifestCacheRepository', () => {
  let directory: string;
  let dbPath: string;
  let cache: SqliteManifestCacheRepository;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'homepilot-manifest-cache-'));
    dbPath = join(directory, 'test.db');
    const db = SqliteDatabaseManager.getInstance(dbPath);
    db.exec(readFileSync(join(process.cwd(), 'migrations/030_create_intentflow_manifest_cache.sql'), 'utf8'));
    cache = new SqliteManifestCacheRepository(dbPath);
  });
  afterEach(() => {
    SqliteDatabaseManager.closeAll();
    rmSync(directory, { recursive: true, force: true });
  });

  it('pins the first authenticated installation and accepts later snapshots from the same installation', () => {
    expect(cache.getState()).toBeNull();
    cache.replaceSnapshot(bundle(), firstTime);
    expect(cache.getState()).toEqual({ installationId, lastSuccessAt: firstTime });
    expect(cache.getByDeviceId(deviceId)?.boardId).toBe(5);
    cache.replaceSnapshot(bundle(installationId, 6, otherDeviceId), secondTime);
    expect(cache.getByDeviceId(deviceId)).toBeNull();
    expect(cache.getByDeviceId(otherDeviceId)?.boardId).toBe(6);
    expect(cache.getState()?.lastSuccessAt).toBe(secondTime);
  });

  it('rejects another installation and preserves pin, cache and timestamp', () => {
    cache.replaceSnapshot(bundle(), firstTime);
    expect(() => cache.replaceSnapshot(bundle(otherInstallationId), secondTime))
      .toThrow(ManifestInstallationMismatchError);
    expect(cache.getState()).toEqual({ installationId, lastSuccessAt: firstTime });
    expect(cache.getByDeviceId(deviceId)?.boardId).toBe(5);
  });

  it('treats a valid empty bundle as commercial revocation without unpinning', () => {
    cache.replaceSnapshot(bundle(), firstTime);
    cache.replaceSnapshot(parseManifestBundleV1({
      schemaVersion: 'homepilot.manifest-bundle.v1', installationId, manifests: [],
    }), secondTime);
    expect(cache.getByDeviceId(deviceId)).toBeNull();
    expect(cache.getState()).toEqual({ installationId, lastSuccessAt: secondTime });
  });

  it('rolls back the entire replacement when SQLite insertion fails', () => {
    cache.replaceSnapshot(bundle(), firstTime);
    const db = SqliteDatabaseManager.getInstance(dbPath);
    db.exec(`CREATE TRIGGER fail_new_manifest BEFORE INSERT ON intentflow_board_manifests
      WHEN NEW.board_id = 6 BEGIN SELECT RAISE(ABORT, 'injected failure'); END;`);
    expect(() => cache.replaceSnapshot(bundle(installationId, 6, otherDeviceId), secondTime)).toThrow();
    expect(cache.getState()).toEqual({ installationId, lastSuccessAt: firstTime });
    expect(cache.getByDeviceId(deviceId)?.boardId).toBe(5);
  });

  it('never returns a corrupted cached manifest as valid', () => {
    cache.replaceSnapshot(bundle(), firstTime);
    SqliteDatabaseManager.getInstance(dbPath).prepare(`UPDATE intentflow_board_manifests
      SET manifest_json = ? WHERE board_id = 5`).run('{invalid');
    expect(cache.getByDeviceId(deviceId)).toBeNull();
  });
});
