import {
  SELECTABLE_ROLES,
  canRestrictAccess,
  defaultAccessFor,
  describeAccess,
  describeExpiry,
  resolveExpiry,
  toDateFieldValue,
} from '../userAccess';

const NOW = new Date(2026, 9, 11, 10, 0, 0).getTime();

describe('Feature: people of the home', () => {
  it('Scenario: Given the roles an administrator can hand out When they are listed Then exactly the four household roles are offered', () => {
    expect(SELECTABLE_ROLES).toEqual(['admin', 'parent', 'child', 'guest']);
  });

  it.each([
    ['child', true],
    ['guest', true],
    ['parent', false],
    ['admin', false],
  ] as const)('Scenario: Given the %s role When access limits are considered Then restrictable is %s', (role, restrictable) => {
    expect(canRestrictAccess(role)).toBe(restrictable);
  });

  it('Scenario: Given a new guest or child When the form opens Then the starting access matches a household', () => {
    expect(defaultAccessFor('guest')).toEqual({ scope: 'rooms', preset: '7d' });
    expect(defaultAccessFor('child')).toEqual({ scope: 'all', preset: 'never' });
    expect(defaultAccessFor('parent')).toEqual({ scope: 'all', preset: 'never' });
  });
});

describe('Feature: choosing when a temporary account ends', () => {
  it('Scenario: Given no expiry When resolved Then nothing is sent', () => {
    expect(resolveExpiry('never', '', NOW)).toBeNull();
  });

  it.each([['1d', 1], ['7d', 7], ['30d', 30]] as const)('Scenario: Given the %s preset When resolved Then the date is that many days ahead', (preset, days) => {
    expect(Date.parse(resolveExpiry(preset, '', NOW) as string)).toBe(NOW + days * 24 * 60 * 60 * 1000);
  });

  it('Scenario: Given a future day When resolved Then the account lasts until the end of that local day', () => {
    const resolved = new Date(resolveExpiry('custom', '2026-10-20', NOW) as string);
    expect([resolved.getFullYear(), resolved.getMonth() + 1, resolved.getDate(), resolved.getHours(), resolved.getMinutes()]).toEqual([2026, 10, 20, 23, 59]);
  });

  it('Scenario: Given today, a past day or an empty date When resolved Then it is not usable yet', () => {
    expect(resolveExpiry('custom', '2026-10-11', new Date(2026, 9, 11, 23, 59, 30).getTime())).toBeUndefined();
    expect(resolveExpiry('custom', '2026-10-01', NOW)).toBeUndefined();
    expect(resolveExpiry('custom', '', NOW)).toBeUndefined();
    expect(resolveExpiry('custom', 'nonsense', NOW)).toBeUndefined();
  });

  it('Scenario: Given a local date When formatted for a date field Then it uses the local calendar day', () => {
    expect(toDateFieldValue(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});

describe('Feature: describing what a person can reach', () => {
  const rooms = new Map([['sala', 'Sala'], ['cocina', 'Cocina']]);

  it('Scenario: Given people with the whole home When described Then it says all', () => {
    expect(describeAccess({ role: 'parent' }, rooms)).toEqual({ kind: 'all' });
    expect(describeAccess({ role: 'guest', accessScope: 'all' }, rooms)).toEqual({ kind: 'all' });
    expect(describeAccess({ role: 'parent', accessScope: 'rooms', roomIds: ['sala'] }, rooms)).toEqual({ kind: 'all' });
  });

  it('Scenario: Given a guest limited to rooms When described Then the room names are listed, skipping deleted rooms', () => {
    expect(describeAccess({ role: 'guest', accessScope: 'rooms', roomIds: ['sala', 'cocina', 'deleted'] }, rooms)).toEqual({ kind: 'rooms', names: ['Sala', 'Cocina'] });
  });

  it('Scenario: Given a guest with no usable rooms When described Then it says there is nothing yet', () => {
    expect(describeAccess({ role: 'guest', accessScope: 'rooms', roomIds: [] }, rooms)).toEqual({ kind: 'none' });
    expect(describeAccess({ role: 'child', accessScope: 'rooms', roomIds: ['deleted'] }, rooms)).toEqual({ kind: 'none' });
  });

  it('Scenario: Given expiry dates When described Then the state is none, active or expired', () => {
    expect(describeExpiry(null, NOW)).toEqual({ kind: 'none' });
    expect(describeExpiry(undefined, NOW)).toEqual({ kind: 'none' });
    expect(describeExpiry('garbage', NOW)).toEqual({ kind: 'none' });
    expect(describeExpiry('2026-10-12T00:00:00.000Z', NOW).kind).toBe('active');
    expect(describeExpiry('2026-10-10T00:00:00.000Z', NOW).kind).toBe('expired');
  });
});
