import {
  createFakeConfirmationTicketRepository,
  createMockAutomationRuleRepository,
  createMockDeviceRepository,
  createMockRoomRepository,
  createMockSceneRepository,
  createTestHome,
} from './test_helpers';

describe('Assistant test helper factories', () => {
  it('keeps home-scoped repository defaults aligned with their in-memory collections', async () => {
    const devices = createMockDeviceRepository();
    const rooms = createMockRoomRepository();
    const scenes = createMockSceneRepository();
    const automations = createMockAutomationRuleRepository();

    devices.findAll.mockResolvedValue([{ id: 'device-1' }] as never);
    rooms.findAll.mockResolvedValue([{ id: 'room-1' }] as never);
    scenes.findAll.mockResolvedValue([{ id: 'scene-1' }] as never);
    automations.findAll.mockResolvedValue([{ id: 'automation-1' }] as never);

    await expect(devices.findAllByHomeId('home-1')).resolves.toEqual([{ id: 'device-1' }]);
    await expect(rooms.findRoomsByHomeId('home-1')).resolves.toEqual([{ id: 'room-1' }]);
    await expect(scenes.findScenesByHomeId('home-1')).resolves.toEqual([{ id: 'scene-1' }]);
    await expect(automations.findByHomeId('home-1')).resolves.toEqual([{ id: 'automation-1' }]);
  });

  it('models confirmation tickets as single-use, user-scoped and expiration-aware', async () => {
    const repository = createFakeConfirmationTicketRepository();
    const active = {
      id: 'ticket-active', userId: 'user-1', homeId: 'home-1', deviceIds: ['device-1'],
      command: 'turn_off' as const, bulkType: 'all' as const, originalPrompt: 'turn off all lights', createdAt: '2026-08-17T00:00:00.000Z',
      expiresAt: '2999-08-17T00:00:00.000Z', consumedAt: null,
    };
    const expired = { ...active, id: 'ticket-expired', expiresAt: '2020-08-17T00:00:00.000Z' };

    await repository.create(active);
    await repository.create(expired);
    await expect(repository.findActiveByUserId('user-1')).resolves.toEqual(active);
    await expect(repository.consume('ticket-active')).resolves.toBe(true);
    await expect(repository.consume('ticket-active')).resolves.toBe(false);
    await expect(repository.findActiveByUserId('user-1')).resolves.toBeNull();
  });

  it('builds complete test homes while allowing targeted overrides', () => {
    expect(createTestHome({ id: 'home-2', name: 'Office' })).toEqual(expect.objectContaining({
      id: 'home-2', ownerId: 'u1', name: 'Office', entityVersion: 1,
    }));
  });
});