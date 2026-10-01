import type { Database } from 'better-sqlite3';
import type { Device } from '../../domain/types';
import type { ExpiredInboxDeviceRemover } from '../../application/ports/ExpiredInboxDeviceRemover';
import { hasExpiredInboxAvailability } from '../../application/deviceAvailability';

function references(value: unknown, identifiers: ReadonlySet<string>): boolean {
  if (typeof value === 'string') return identifiers.has(value);
  if (Array.isArray(value)) return value.some((item: unknown) => references(item, identifiers));
  if (value && typeof value === 'object') return Object.values(value).some((item) => references(item, identifiers));
  return false;
}

/** All checks share a transaction with deletion, including concurrent assignment. */
export class SQLiteExpiredInboxDeviceRemover implements ExpiredInboxDeviceRemover {
  constructor(private readonly db: Database) {}

  async updatePendingState(device: Device, state: Record<string, unknown>): Promise<boolean> {
    return this.db.transaction(() => {
      const row = this.db.prepare('SELECT last_known_state FROM devices WHERE id = ?').get(device.id) as { last_known_state: string | null } | undefined;
      if (!row || JSON.stringify(row.last_known_state ? JSON.parse(row.last_known_state) : null) !== JSON.stringify(device.lastKnownState)) return false;
      return this.db.prepare(`UPDATE devices SET last_known_state = ? WHERE id = ? AND status = 'PENDING' AND room_id IS NULL AND integration_source IN ('ha', 'sonoff')`)
        .run(JSON.stringify(state), device.id).changes === 1;
    })();
  }

  async removeIfUnreferenced(device: Device): Promise<boolean> {
    return this.db.transaction(() => {
      const row = this.db.prepare('SELECT status, room_id, integration_source, last_known_state FROM devices WHERE id = ?')
        .get(device.id) as { status: string; room_id: string | null; integration_source: string; last_known_state: string | null } | undefined;
      if (!row || row.status !== 'PENDING' || row.room_id !== null || !['ha', 'sonoff'].includes(row.integration_source) || !row.last_known_state) return false;
      const state: Record<string, unknown> = JSON.parse(row.last_known_state);
      if (JSON.stringify(state) !== JSON.stringify(device.lastKnownState)
        || !hasExpiredInboxAvailability(state, Date.now())) return false;
      const identifiers = new Set([device.id, device.externalId]);
      const payloads = this.db.prepare(`
        SELECT actions AS payload FROM scenes
        UNION ALL SELECT trigger AS payload FROM automation_rules
        UNION ALL SELECT action AS payload FROM automation_rules
        UNION ALL SELECT tabs AS payload FROM dashboards
        UNION ALL SELECT snapshot AS payload FROM dashboard_revisions
      `).all() as Array<{ payload: string }>;
      // Invalid persisted JSON fails closed: no deletion when references cannot be verified.
      if (payloads.some(({ payload }) => references(JSON.parse(payload), identifiers))) return false;
      return this.db.prepare("DELETE FROM devices WHERE id = ? AND status = 'PENDING' AND room_id IS NULL")
        .run(device.id).changes === 1;
    })();
  }
}
