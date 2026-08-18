import { InMemoryAutomationRuleRepository } from '../../infrastructure/repositories/InMemoryAutomationRuleRepository';
import type { AutomationRule } from '../../domain/automation/types';

const rule = (id: string, overrides: Partial<AutomationRule> = {}): AutomationRule => ({
  id, homeId: 'home-1', userId: 'user-1', name: id, enabled: true,
  trigger: { type: 'device_state_changed', deviceId: 'device-1', stateKey: 'on', expectedValue: true },
  action: { type: 'device_command', targetDeviceId: 'target-1', command: 'turn_on' },
  ...overrides
});

describe('InMemoryAutomationRuleRepository', () => {
  it('filters only enabled device-state rules by trigger device and returns immutable copies', async () => {
    const repository = new InMemoryAutomationRuleRepository();
    await repository.save(rule('matching'));
    await repository.save(rule('disabled', { enabled: false }));
    await repository.save(rule('different-device', { trigger: { type: 'device_state_changed', deviceId: 'device-2', stateKey: 'on', expectedValue: true } }));
    await repository.save(rule('time-rule', { trigger: { type: 'time', timeLocal: '08:00', timeUTC: '13:00', timezone: 'America/Guayaquil' } }));

    const matching = await repository.findByTriggerDevice('device-1');

    expect(matching).toEqual([expect.objectContaining({ id: 'matching' })]);
    expect(Object.isFrozen(matching)).toBe(true);
    expect(Object.isFrozen(matching[0])).toBe(true);
    expect(Object.isFrozen(matching[0].trigger)).toBe(true);
    expect(Object.isFrozen(matching[0].action)).toBe(true);
  });

  it('supports upsert, home and global queries, missing values, and silent deletion', async () => {
    const repository = new InMemoryAutomationRuleRepository();
    await repository.save(rule('rule-1'));
    await repository.save(rule('rule-1', { name: 'Updated', homeId: 'home-2' }));

    await expect(repository.findById('rule-1')).resolves.toEqual(expect.objectContaining({ name: 'Updated', homeId: 'home-2' }));
    await expect(repository.findById('missing')).resolves.toBeNull();
    await expect(repository.findByHomeId('home-1')).resolves.toEqual([]);
    await expect(repository.findByHomeId('home-2')).resolves.toEqual([expect.objectContaining({ id: 'rule-1' })]);
    await expect(repository.findAll()).resolves.toEqual([expect.objectContaining({ id: 'rule-1' })]);

    await repository.delete('missing');
    await repository.delete('rule-1');
    await expect(repository.findAll()).resolves.toEqual([]);
  });
});