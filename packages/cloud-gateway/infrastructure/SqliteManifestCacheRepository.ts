import { SqliteDatabaseManager } from '../../shared/infrastructure/database/SqliteDatabaseManager';
import { parseBoardManifestV1, type BoardManifestV1 } from '../application/BoardManifestV1';
import { parseManifestBundleV1, type ManifestBundleV1 } from '../application/ManifestBundleV1';

export class ManifestInstallationMismatchError extends Error {
  readonly code = 'INTENTFLOW_INSTALLATION_MISMATCH';
  constructor() { super('INTENTFLOW_INSTALLATION_MISMATCH'); this.name = 'ManifestInstallationMismatchError'; }
}

interface SyncStateRow { readonly installation_id: string; readonly last_success_at: string }
interface ManifestRow {
  readonly board_id: number;
  readonly installation_id: string;
  readonly homepilot_device_id: string;
  readonly revision: string;
  readonly manifest_json: string;
}

/** Owns the authenticated installation pin and the complete commercial snapshot. */
export class SqliteManifestCacheRepository {
  constructor(private readonly dbPath: string) {}

  getState(): { installationId: string; lastSuccessAt: string } | null {
    const row = SqliteDatabaseManager.getInstance(this.dbPath)
      .prepare('SELECT installation_id, last_success_at FROM intentflow_manifest_sync_state WHERE id = 1')
      .get() as SyncStateRow | undefined;
    return row ? { installationId: row.installation_id, lastSuccessAt: row.last_success_at } : null;
  }

  getByDeviceId(deviceId: string): BoardManifestV1 | null {
    const db = SqliteDatabaseManager.getInstance(this.dbPath);
    const row = db.prepare(`SELECT board_id, installation_id, homepilot_device_id, revision, manifest_json
      FROM intentflow_board_manifests WHERE homepilot_device_id = ?`).get(deviceId) as ManifestRow | undefined;
    if (!row) return null;
    const state = this.getState();
    if (!state || state.installationId !== row.installation_id) return null;
    try {
      const manifest = parseBoardManifestV1(JSON.parse(row.manifest_json) as unknown);
      return manifest.boardId === row.board_id
        && manifest.installationId === row.installation_id
        && manifest.homePilotDeviceId === row.homepilot_device_id
        && manifest.revision === row.revision ? manifest : null;
    } catch { return null; }
  }

  replaceSnapshot(input: ManifestBundleV1, syncedAt: string): void {
    const bundle = parseManifestBundleV1(input);
    const db = SqliteDatabaseManager.getInstance(this.dbPath);
    db.transaction(() => {
      const previous = db.prepare('SELECT installation_id FROM intentflow_manifest_sync_state WHERE id = 1')
        .get() as Pick<SyncStateRow, 'installation_id'> | undefined;
      if (previous && previous.installation_id !== bundle.installationId) throw new ManifestInstallationMismatchError();

      db.prepare('DELETE FROM intentflow_board_manifests').run();
      const insert = db.prepare(`INSERT INTO intentflow_board_manifests
        (board_id, installation_id, homepilot_device_id, revision, manifest_json, synced_at)
        VALUES (?, ?, ?, ?, ?, ?)`);
      for (const manifest of bundle.manifests) {
        insert.run(manifest.boardId, bundle.installationId, manifest.homePilotDeviceId,
          manifest.revision, JSON.stringify(manifest), syncedAt);
      }
      db.prepare(`INSERT INTO intentflow_manifest_sync_state (id, installation_id, last_success_at)
        VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET last_success_at = excluded.last_success_at`)
        .run(bundle.installationId, syncedAt);
    })();
  }
}
