import { canUseRoom, isAccountExpired, isRoomRestricted } from './roomAccess';
import { createRoomAccessCheck } from '../application/RoomAccessRules';

describe('Feature: room access for household members', () => {
  const guest = { role: 'guest', accessScope: 'rooms' as const, roomIds: ['sala'] };

  it('Scenario: Given a child or guest limited to rooms When rooms are checked Then only listed rooms are usable', () => {
    expect(isRoomRestricted(guest)).toBe(true);
    expect(isRoomRestricted({ ...guest, role: 'child' })).toBe(true);
    expect(canUseRoom(guest, 'sala')).toBe(true);
    expect(canUseRoom(guest, 'cocina')).toBe(false);
  });

  it('Scenario: Given a device still in the Inbox When a limited user checks it Then it is not usable', () => {
    expect(canUseRoom(guest, null)).toBe(false);
    expect(canUseRoom(guest, undefined)).toBe(false);
  });

  it.each(['admin', 'parent'])('Scenario: Given the %s role When rooms are checked Then the whole home is usable even if a scope was stored', (role) => {
    expect(isRoomRestricted({ role, accessScope: 'rooms', roomIds: [] })).toBe(false);
    expect(canUseRoom({ role, accessScope: 'rooms', roomIds: [] }, 'cocina')).toBe(true);
    expect(canUseRoom({ role, accessScope: 'rooms', roomIds: [] }, null)).toBe(true);
  });

  it('Scenario: Given an account created before room access existed When rooms are checked Then it keeps the whole home', () => {
    expect(isRoomRestricted({ role: 'guest' })).toBe(false);
    expect(canUseRoom({ role: 'guest' }, 'cocina')).toBe(true);
  });

  it('Scenario: Given an expiry date When it is checked Then only a past date expires the account', () => {
    const now = Date.parse('2026-10-11T12:00:00.000Z');
    expect(isAccountExpired({ expiresAt: '2026-10-11T11:59:59.000Z' }, now)).toBe(true);
    expect(isAccountExpired({ expiresAt: '2026-10-11T12:00:00.000Z' }, now)).toBe(true);
    expect(isAccountExpired({ expiresAt: '2026-10-12T00:00:00.000Z' }, now)).toBe(false);
    expect(isAccountExpired({ expiresAt: null }, now)).toBe(false);
    expect(isAccountExpired({}, now)).toBe(false);
    expect(isAccountExpired({ expiresAt: 'not a date' }, now)).toBe(false);
  });
});

describe('Feature: the path rule that keeps limited users inside their rooms', () => {
  const rooms: Record<string, string | null> = { 'light-sala': 'sala', 'light-cocina': 'cocina', 'inbox-1': null };
  const lookup = { findDeviceRoom: jest.fn(async (id: string) => ({ exists: id in rooms, roomId: rooms[id] ?? null })) };
  const check = createRoomAccessCheck(lookup);
  const guest = { role: 'guest', accessScope: 'rooms' as const, roomIds: ['sala'] };

  beforeEach(() => lookup.findDeviceRoom.mockClear());

  it.each([
    ['/api/v1/devices/light-sala', true],
    ['/api/v1/devices/light-sala/command', true],
    ['/api/v1/devices/light-sala/camera/session', true],
    ['/api/v1/devices/light-cocina', false],
    ['/api/v1/devices/light-cocina/state', false],
    ['/api/v1/devices/inbox-1', false],
    ['/api/v1/devices/does-not-exist', false],
    ['/api/v1/rooms/sala/action', true],
    ['/api/v1/rooms/cocina/action', false],
    ['/api/v1/automations', false],
    ['/api/v1/automations/rule-1/run', false],
  ])('Scenario: Given a guest limited to the living room When %s is requested Then allowed is %s', async (path, allowed) => {
    await expect(check(guest, path)).resolves.toBe(allowed);
  });

  it.each([
    '/api/v1/devices',
    '/api/v1/rooms',
    '/api/v1/scenes',
    '/api/v1/auth/me',
    '/health',
  ])('Scenario: Given a guest When the list or unrelated route %s is requested Then the route itself decides and the rule lets it pass', async (path) => {
    await expect(check(guest, path)).resolves.toBe(true);
    expect(lookup.findDeviceRoom).not.toHaveBeenCalled();
  });

  it('Scenario: Given a family member or an unrestricted guest When any path is requested Then nothing is looked up', async () => {
    await expect(check({ role: 'parent', accessScope: 'all', roomIds: [] }, '/api/v1/devices/light-cocina')).resolves.toBe(true);
    await expect(check({ role: 'guest', accessScope: 'all', roomIds: [] }, '/api/v1/automations')).resolves.toBe(true);
    expect(lookup.findDeviceRoom).not.toHaveBeenCalled();
  });
});
