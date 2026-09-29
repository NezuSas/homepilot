import type { Database } from 'better-sqlite3';
import type { BoundDeviceIdentity } from '../application/EdgeDeviceContract';
export type { BoundDeviceIdentity } from '../application/EdgeDeviceContract';

interface BindingRow {
  binding_state: 'bound'; home_id: string; edge_id: string;
  key_id: string; public_key: string; algorithm: 'ES256'; bound_at: string;
}

/** Absence means a historical, unbound Edge. Once inserted this row is never downgraded. */
export class SqliteDeviceBindingRepository {
  constructor(private readonly db: Database) {}

  get(): BoundDeviceIdentity | null {
    const row = this.db.prepare('SELECT binding_state, home_id, edge_id, key_id, public_key, algorithm, bound_at FROM edge_device_identity_binding WHERE id = 1').get() as BindingRow | undefined;
    return row ? { bindingState: row.binding_state, homeId: row.home_id, edgeId: row.edge_id,
      keyId: row.key_id, publicKey: row.public_key, algorithm: row.algorithm, boundAt: row.bound_at } : null;
  }

  bind(identity: BoundDeviceIdentity): void {
    const result = this.db.prepare(`INSERT OR IGNORE INTO edge_device_identity_binding
      (id, binding_state, home_id, edge_id, key_id, public_key, algorithm, bound_at)
      VALUES (1, 'bound', ?, ?, ?, ?, 'ES256', ?)`).run(
      identity.homeId, identity.edgeId, identity.keyId, identity.publicKey, identity.boundAt);
    if (result.changes !== 1) throw new Error('DEVICE_ALREADY_BOUND');
  }
}
