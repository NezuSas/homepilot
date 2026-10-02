import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { SQLiteAutomationRuleRepository } from '../infrastructure/repositories/SQLiteAutomationRuleRepository';
import { SqliteDatabaseManager } from '../../shared/infrastructure/database/SqliteDatabaseManager';
import type { AutomationRule } from '../domain/automation/types';

describe('Feature: Routine sharing persistence', () => {
  it('migrates historical rules privately, preserves their payload and round-trips grants/revocation', async () => {
    const db = new Database(':memory:');
    const connection = jest.spyOn(SqliteDatabaseManager, 'getInstance').mockReturnValue(db);
    try {
      db.exec(`CREATE TABLE scenes (id TEXT PRIMARY KEY);
        CREATE TABLE automation_rules (id TEXT PRIMARY KEY, home_id TEXT, user_id TEXT, name TEXT, icon TEXT, enabled INTEGER, trigger TEXT, action TEXT, created_at TEXT DEFAULT '', updated_at TEXT DEFAULT '');`);
      const rule: AutomationRule = { id: 'rule', homeId: 'home', userId: 'owner', name: 'Salir', enabled: true, trigger: { type: 'device_state_changed', deviceId: 'sensor', stateKey: 'state', expectedValue: 'on' }, action: { type: 'device_command', targetDeviceId: 'light', command: 'turn_off' } };
      db.prepare('INSERT INTO automation_rules (id, home_id, user_id, name, enabled, trigger, action) VALUES (?, ?, ?, ?, ?, ?, ?)').run(rule.id, rule.homeId, rule.userId, rule.name, 1, JSON.stringify(rule.trigger), JSON.stringify(rule.action));
      db.exec(readFileSync(join(process.cwd(), 'migrations/034_routine_sharing.sql'), 'utf8'));
      const repository = new SQLiteAutomationRuleRepository('isolated-test-only');
      expect(await repository.findById(rule.id)).toMatchObject({ ...rule, sharedUserIds: [] });
      await repository.save({ ...rule, sharedUserIds: ['recipient', 'second'] });
      expect(await repository.findById(rule.id)).toMatchObject({ ...rule, sharedUserIds: ['recipient', 'second'] });
      await repository.save({ ...rule, sharedUserIds: [] });
      expect(await repository.findById(rule.id)).toMatchObject({ ...rule, sharedUserIds: [] });
    } finally { connection.mockRestore(); db.close(); }
  });
});
