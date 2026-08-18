import { Database } from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { SQLiteConfirmationTicketRepository } from '../infrastructure/repositories/SQLiteConfirmationTicketRepository';
import { SqliteDatabaseManager } from '../../shared/infrastructure/database/SqliteDatabaseManager';
import { SqliteMigrationsRunner } from '../../shared/infrastructure/database/SqliteMigrationsRunner';
import { ConfirmationTicket } from '../domain/ConfirmationTicket';

function ticket(overrides: Partial<ConfirmationTicket> = {}): ConfirmationTicket {
  return {
    id: 'ticket-1',
    userId: 'user-1',
    homeId: 'home-1',
    command: 'turn_off',
    bulkType: 'all',
    deviceIds: ['device-1', 'device-2'],
    originalPrompt: 'turn everything off',
    createdAt: '2026-08-17T10:00:00.000Z',
    expiresAt: '2999-01-01T00:00:00.000Z',
    consumedAt: null,
    ...overrides
  };
}

describe('SQLiteConfirmationTicketRepository', () => {
  let dbPath: string;
  let db: Database;
  let repository: SQLiteConfirmationTicketRepository;

  beforeAll(() => {
    dbPath = path.join(__dirname, `test-confirmation-ticket-${Date.now()}.db`);
    db = SqliteDatabaseManager.getInstance(dbPath);
    new SqliteMigrationsRunner(db).run(path.resolve(__dirname, '../../../migrations'));
    repository = new SQLiteConfirmationTicketRepository(dbPath);
  });
  afterEach(() => db.exec('DELETE FROM assistant_confirmation_tickets'));
  afterAll(() => { db.close(); if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath); });

  it('returns the newest active ticket for a user and isolates other users', async () => {
    await repository.create(ticket({ id: 'older', createdAt: '2026-08-17T10:00:00.000Z' }));
    await repository.create(ticket({ id: 'newer', createdAt: '2026-08-17T11:00:00.000Z', bulkType: 'lights', deviceIds: ['device-3'] }));
    await repository.create(ticket({ id: 'other-user', userId: 'user-2' }));

    await expect(repository.findActiveByUserId('user-1')).resolves.toEqual(expect.objectContaining({ id: 'newer', bulkType: 'lights', deviceIds: ['device-3'] }));
    await expect(repository.findActiveByUserId('user-2')).resolves.toEqual(expect.objectContaining({ id: 'other-user' }));
  });

  it('consumes tickets exactly once and excludes expired tickets from read and purge', async () => {
    await repository.create(ticket());
    await expect(repository.consume('ticket-1')).resolves.toBe(true);
    await expect(repository.consume('ticket-1')).resolves.toBe(false);
    await expect(repository.findActiveByUserId('user-1')).resolves.toBeNull();

    await repository.create(ticket({ id: 'expired', expiresAt: '2000-01-01T00:00:00.000Z' }));
    await expect(repository.findActiveByUserId('user-1')).resolves.toBeNull();
    await repository.deleteExpired();
    expect(db.prepare('SELECT COUNT(*) AS count FROM assistant_confirmation_tickets WHERE id = ?').get('expired')).toEqual({ count: 0 });
  });
});
