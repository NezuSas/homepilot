import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ActivityLogRetentionService,
  DEFAULT_AUDIT_RETENTION_DAYS,
  DEFAULT_NOISE_RETENTION_DAYS,
  readRetentionPolicy,
} from '../application/ActivityLogRetentionService';
import { InMemoryActivityLogRepository } from '../../devices/infrastructure/repositories/InMemoryActivityLogRepository';
import { SQLiteActivityLogRepository } from '../../devices/infrastructure/repositories/SQLiteActivityLogRepository';
import { SqliteDatabaseManager } from '../../shared/infrastructure/database/SqliteDatabaseManager';
import type { ActivityRecord, ActivityType } from '../../devices/domain/repositories/ActivityLogRepository';

const NOW = Date.parse('2026-10-12T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();
const record = (type: ActivityType, days: number, deviceId: string | null = 'd1'): ActivityRecord =>
  ({ timestamp: ago(days), deviceId, type, description: type, data: {} });

describe('Feature: retention policy from the environment', () => {
  it('Scenario: Given no configuration When the policy is read Then 7 days of noise and 90 days of audit are kept', () => {
    expect(readRetentionPolicy({})).toEqual({ noiseDays: DEFAULT_NOISE_RETENTION_DAYS, auditDays: DEFAULT_AUDIT_RETENTION_DAYS });
  });

  it('Scenario: Given valid values When the policy is read Then they are used', () => {
    expect(readRetentionPolicy({ HOMEPILOT_ACTIVITY_NOISE_RETENTION_DAYS: '3', HOMEPILOT_ACTIVITY_RETENTION_DAYS: '365' })).toEqual({ noiseDays: 3, auditDays: 365 });
  });

  it.each(['0', '-5', '1.5', 'abc', ''])('Scenario: Given the invalid value "%s" When the policy is read Then the default is used', (value) => {
    expect(readRetentionPolicy({ HOMEPILOT_ACTIVITY_NOISE_RETENTION_DAYS: value, HOMEPILOT_ACTIVITY_RETENTION_DAYS: value }))
      .toEqual({ noiseDays: DEFAULT_NOISE_RETENTION_DAYS, auditDays: DEFAULT_AUDIT_RETENTION_DAYS });
  });
});

describe('Feature: the activity log does not grow without limit', () => {
  async function filled() {
    const repository = new InMemoryActivityLogRepository();
    for (const entry of [
      record('STATE_CHANGED', 30), record('STATE_CHANGED', 8), record('STATE_CHANGED', 2),
      record('AUTOMATION_EXECUTED', 20), record('AUTOMATION_EXECUTED', 1),
      record('COMMAND_DISPATCHED', 30), record('COMMAND_DISPATCHED', 120),
      record('USER_ROLE_CHANGED', 200, null), record('USER_ROLE_CHANGED', 10, null),
    ]) await repository.saveActivity(entry);
    return repository;
  }

  it('Scenario: Given old rows of both classes When a pass runs Then noise older than 7 days and audit older than 90 days go', async () => {
    const repository = await filled();
    const service = new ActivityLogRetentionService(repository, { now: () => NOW });

    const result = await service.runOnce();

    expect(result).toEqual({ noiseDeleted: 3, auditDeleted: 2 });
    const left = (await repository.findAllRecent(50)).map((row) => `${row.type}:${Math.round((NOW - Date.parse(row.timestamp)) / DAY)}`).sort();
    expect(left).toEqual(['AUTOMATION_EXECUTED:1', 'COMMAND_DISPATCHED:30', 'STATE_CHANGED:2', 'USER_ROLE_CHANGED:10']);
  });

  it('Scenario: Given a second pass right after the first When it runs Then nothing else is deleted', async () => {
    const repository = await filled();
    const service = new ActivityLogRetentionService(repository, { now: () => NOW });
    await service.runOnce();

    expect(await service.runOnce()).toEqual({ noiseDeleted: 0, auditDeleted: 0 });
  });

  it('Scenario: Given more old rows than one batch When a pass runs Then it deletes in batches and yields between them', async () => {
    const repository = new InMemoryActivityLogRepository();
    for (let index = 0; index < 25; index += 1) await repository.saveActivity(record('STATE_CHANGED', 20));
    const spy = jest.spyOn(repository, 'deleteOlderThan');
    const yieldToEventLoop = jest.fn().mockResolvedValue(undefined);
    const service = new ActivityLogRetentionService(repository, { now: () => NOW, batchSize: 10, yieldToEventLoop });

    const result = await service.runOnce();

    expect(result.noiseDeleted).toBe(25);
    expect(spy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ limit: 10, types: ['STATE_CHANGED', 'AUTOMATION_EXECUTED'] }));
    expect(yieldToEventLoop).toHaveBeenCalledTimes(2);
  });

  it('Scenario: Given custom days When a pass runs Then the custom periods decide', async () => {
    const repository = await filled();
    const service = new ActivityLogRetentionService(repository, { now: () => NOW, policy: { noiseDays: 1, auditDays: 15 } });

    expect(await service.runOnce()).toEqual({ noiseDeleted: 4, auditDeleted: 3 });
  });

  describe('scheduling', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('Scenario: Given a started service When time passes Then it runs after the delay and then every interval until stopped', async () => {
      const repository = await filled();
      const runs = jest.spyOn(repository, 'deleteOlderThan');
      const service = new ActivityLogRetentionService(repository, { now: () => NOW });

      service.start(1000, 100);
      await jest.advanceTimersByTimeAsync(99);
      expect(runs).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);
      expect(runs).toHaveBeenCalled();

      const afterFirst = runs.mock.calls.length;
      await jest.advanceTimersByTimeAsync(1000);
      expect(runs.mock.calls.length).toBeGreaterThan(afterFirst);

      service.stop();
      const afterStop = runs.mock.calls.length;
      await jest.advanceTimersByTimeAsync(10_000);
      expect(runs.mock.calls.length).toBe(afterStop);
    });

    it('Scenario: Given a failing pass When it happens Then the error is reported and the next pass still runs', async () => {
      const repository = new InMemoryActivityLogRepository();
      const failing = jest.spyOn(repository, 'deleteOlderThan').mockRejectedValueOnce(new Error('disk is busy')).mockResolvedValue(0);
      const onError = jest.fn();
      const service = new ActivityLogRetentionService(repository, { now: () => NOW, onError });

      service.start(1000, 10);
      await jest.advanceTimersByTimeAsync(10);
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'disk is busy' }));
      await jest.advanceTimersByTimeAsync(1000);
      expect(failing.mock.calls.length).toBeGreaterThan(1);
      service.stop();
    });
  });
});

describe('Feature: SQLite deletion by age keeps what is still in its period', () => {
  const dbPath = 'activity-retention-test.db';

  function createRepository() {
    SqliteDatabaseManager.closeAll();
    const db = SqliteDatabaseManager.getInstance(dbPath);
    db.exec(readFileSync(join(process.cwd(), 'migrations', '001_initial_schema.sql'), 'utf8'));
    db.exec(readFileSync(join(process.cwd(), 'migrations', '037_activity_log_indexes.sql'), 'utf8'));
    return { db, repository: new SQLiteActivityLogRepository(dbPath) };
  }

  afterEach(() => {
    SqliteDatabaseManager.closeAll();
    for (const suffix of ['', '-wal', '-shm']) {
      try { require('node:fs').unlinkSync(dbPath + suffix); } catch { /* not created */ }
    }
  });

  it('Scenario: Given rows of several ages and types When deleting by class Then only the old rows of that class are removed, up to the limit', async () => {
    const { repository } = createRepository();
    for (const entry of [
      record('STATE_CHANGED', 20), record('STATE_CHANGED', 20), record('STATE_CHANGED', 20), record('STATE_CHANGED', 1),
      record('AUTOMATION_EXECUTED', 20), record('COMMAND_DISPATCHED', 20), record('HA_RESILIENCE', 100, null),
    ]) await repository.saveActivity(entry);
    const noise = ['STATE_CHANGED', 'AUTOMATION_EXECUTED'] as const;

    expect(await repository.deleteOlderThan(ago(7), { types: noise, limit: 2 })).toBe(2);
    expect(await repository.deleteOlderThan(ago(7), { types: noise, limit: 100 })).toBe(2);
    expect(await repository.deleteOlderThan(ago(7), { types: noise, limit: 100 })).toBe(0);
    expect(await repository.deleteOlderThan(ago(90), { excludeTypes: noise, limit: 100 })).toBe(1);

    const left = (await repository.findAllRecent(50)).map((row) => row.type).sort();
    expect(left).toEqual(['COMMAND_DISPATCHED', 'STATE_CHANGED']);
  });

  it('Scenario: Given a limit of zero When deleting Then nothing is removed', async () => {
    const { repository } = createRepository();
    await repository.saveActivity(record('STATE_CHANGED', 50));

    expect(await repository.deleteOlderThan(ago(1), { limit: 0 })).toBe(0);
    expect(await repository.findAllRecent(10)).toHaveLength(1);
  });

  it('Scenario: Given the migration When it runs on a table with rows Then the three indexes exist and no data changes', () => {
    const db = new Database(':memory:');
    db.exec(readFileSync(join(process.cwd(), 'migrations', '001_initial_schema.sql'), 'utf8'));
    db.prepare("INSERT INTO activity_logs (device_id, type, description, timestamp) VALUES ('d1', 'STATE_CHANGED', 'x', '2026-01-01T00:00:00.000Z')").run();

    db.exec(readFileSync(join(process.cwd(), 'migrations', '037_activity_log_indexes.sql'), 'utf8'));
    db.exec(readFileSync(join(process.cwd(), 'migrations', '037_activity_log_indexes.sql'), 'utf8'));

    const indexes = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'activity_logs' AND name LIKE 'activity_logs_%'").all() as { name: string }[]).map((row) => row.name).sort();
    expect(indexes).toEqual(['activity_logs_device_time', 'activity_logs_timestamp', 'activity_logs_type_time']);
    expect(db.prepare('SELECT count(*) AS count FROM activity_logs').get()).toEqual({ count: 1 });
  });
});
