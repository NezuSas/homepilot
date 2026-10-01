import Database from 'better-sqlite3';
import { SQLiteExpiredInboxDeviceRemover } from '../infrastructure/repositories/SQLiteExpiredInboxDeviceRemover';
import { hasExpiredInboxAvailability, trackInboxAvailability, INBOX_OBSERVATION_INTERVAL_MS, UNAVAILABLE_INBOX_RETENTION_MS } from '../application/deviceAvailability';
import type { Device } from '../domain/types';

describe('Feature: Expired unassigned discoveries (AC14)', () => {
  const now = Date.parse('2026-10-01T12:00:00Z');
  const unavailable = { state: 'unavailable', homepilotUnavailableSince: now - UNAVAILABLE_INBOX_RETENTION_MS - 1, homepilotUnavailableCheckedAt: now };
  const device: Device = { id: 'pending', homeId: 'home', roomId: null, externalId: 'ha:sensor.pending', name: 'Pending', type: 'sensor', vendor: 'HA', status: 'PENDING', integrationSource: 'ha', invertState: false, entityVersion: 1, createdAt: '2020-01-01', updatedAt: '2020-01-01', lastKnownState: unavailable };
  let db: Database.Database;
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(now);
    db = new Database(':memory:');
    db.exec(`CREATE TABLE devices (id TEXT PRIMARY KEY, status TEXT, room_id TEXT, integration_source TEXT, last_known_state TEXT);
      CREATE TABLE scenes (actions TEXT); CREATE TABLE automation_rules (trigger TEXT, action TEXT); CREATE TABLE dashboards (tabs TEXT); CREATE TABLE dashboard_revisions (snapshot TEXT);`);
    db.prepare('INSERT INTO devices VALUES (?, ?, ?, ?, ?)').run(device.id, device.status, null, 'ha', JSON.stringify(unavailable));
  });
  afterEach(() => { db.close(); jest.restoreAllMocks(); });

  it('starts historical unavailable observations now, not at creation', () => {
    expect(trackInboxAvailability({ state: 'unavailable' }, { state: 'unavailable' }, now)).toEqual({ state: 'unavailable', homepilotUnavailableSince: now, homepilotUnavailableCheckedAt: now });
  });
  it('requires more than 24 hours and a recent successful observation', () => {
    expect(hasExpiredInboxAvailability({ ...unavailable, homepilotUnavailableSince: now - UNAVAILABLE_INBOX_RETENTION_MS }, now)).toBe(false);
    expect(hasExpiredInboxAvailability(unavailable, now)).toBe(true);
    expect(hasExpiredInboxAvailability(unavailable, now + INBOX_OBSERVATION_INTERVAL_MS + 1)).toBe(false);
  });
  it('preserves continuous observations and restarts after an observation gap', () => {
    expect(trackInboxAvailability(unavailable, { state: 'unavailable' }, now + INBOX_OBSERVATION_INTERVAL_MS).homepilotUnavailableSince).toBe(unavailable.homepilotUnavailableSince);
    expect(trackInboxAvailability(unavailable, { state: 'unavailable' }, now + 2 * INBOX_OBSERVATION_INTERVAL_MS + 1).homepilotUnavailableSince).toBe(now + 2 * INBOX_OBSERVATION_INTERVAL_MS + 1);
  });
  it('clears markers on recovery without discarding current attributes', () => {
    expect(trackInboxAvailability(unavailable, { ...unavailable, state: 'on', attributes: { value: 1 } }, now)).toEqual({ state: 'on', attributes: { value: 1 } });
  });
  it('removes only expired unreferenced pending imports locally', async () => {
    await expect(new SQLiteExpiredInboxDeviceRemover(db).removeIfUnreferenced(device)).resolves.toBe(true);
    expect(db.prepare('SELECT * FROM devices').all()).toHaveLength(0);
  });
  it('updates only the pending state without overwriting concurrent assignment or recovery', async () => {
    const remover = new SQLiteExpiredInboxDeviceRemover(db);
    await expect(remover.updatePendingState(device, { state: 'off' })).resolves.toBe(true);
    await expect(remover.updatePendingState(device, unavailable)).resolves.toBe(false);
    db.prepare('UPDATE devices SET status = ?, room_id = ?, last_known_state = ?').run('ASSIGNED', 'room', JSON.stringify(unavailable));
    await expect(remover.updatePendingState(device, { state: 'unavailable' })).resolves.toBe(false);
    expect(db.prepare('SELECT status, room_id FROM devices').get()).toEqual({ status: 'ASSIGNED', room_id: 'room' });
  });
  it('applies the same retention protection to a pending Sonoff discovery', async () => {
    db.exec("UPDATE devices SET integration_source = 'sonoff'");
    await expect(new SQLiteExpiredInboxDeviceRemover(db).removeIfUnreferenced({ ...device, integrationSource: 'sonoff' })).resolves.toBe(true);
  });
  it.each(["status = 'ASSIGNED'", "room_id = 'room'", "integration_source = 'native'"])
    ('preserves configured/native devices: %s', async (change) => {
      db.exec(`UPDATE devices SET ${change}`);
      await expect(new SQLiteExpiredInboxDeviceRemover(db).removeIfUnreferenced(device)).resolves.toBe(false);
    });
  it.each([
    ['scenes', 'actions', [{ deviceId: device.id }]],
    ['automation_rules', 'trigger', { conditions: [{ deviceId: device.id }] }],
    ['automation_rules', 'action', { then: { targetDeviceId: device.id } }],
    ['dashboards', 'tabs', [{ widgets: [{ config: { extra: { cards: [{ entityId: device.id }] } } }] }]],
    ['dashboard_revisions', 'snapshot', { tabs: [{ widgets: [{ config: { entityId: device.id } }] }] }],
  ])('preserves references from %s/%s', async (table, column, payload) => {
    db.prepare(`INSERT INTO ${table} (${column}) VALUES (?)`).run(JSON.stringify(payload));
    await expect(new SQLiteExpiredInboxDeviceRemover(db).removeIfUnreferenced(device)).resolves.toBe(false);
  });
  it('preserves a device whose state changed before deletion', async () => {
    db.prepare('UPDATE devices SET last_known_state = ?').run(JSON.stringify({ state: 'on' }));
    await expect(new SQLiteExpiredInboxDeviceRemover(db).removeIfUnreferenced(device)).resolves.toBe(false);
  });
  it('fails closed when persisted references cannot be read', async () => {
    db.prepare('INSERT INTO dashboards VALUES (?)').run('invalid JSON');
    await expect(new SQLiteExpiredInboxDeviceRemover(db).removeIfUnreferenced(device)).rejects.toThrow();
    expect(db.prepare('SELECT * FROM devices').all()).toHaveLength(1);
  });
});
