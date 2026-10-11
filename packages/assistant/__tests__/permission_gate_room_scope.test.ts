import { PermissionGate } from '../application/PermissionGate';
import {
  createMockAutomationRuleRepository,
  createMockDeviceRepository,
  createMockHomeRepository,
  createMockRoomRepository,
  createMockSceneRepository,
  createTestDevice,
  createTestHome,
  createTestRoom,
  createTestScene,
} from './test_helpers';

/** A guest or child limited to some rooms must never see, count or command anything outside them through the assistant. */
describe('PermissionGate room scope', () => {
  const home = createTestHome({ id: 'home-1', ownerId: 'admin-1' });
  const lightSala = createTestDevice({ id: 'light-sala', homeId: 'home-1', roomId: 'sala' });
  const lightCocina = createTestDevice({ id: 'light-cocina', homeId: 'home-1', roomId: 'cocina' });
  const lightInbox = createTestDevice({ id: 'light-inbox', homeId: 'home-1', roomId: null });
  const sala = createTestRoom({ id: 'sala', homeId: 'home-1' });
  const cocina = createTestRoom({ id: 'cocina', homeId: 'home-1' });

  function createGate(subjects: Record<string, { role: string; accessScope?: 'all' | 'rooms'; roomIds?: string[] }>, scenes = [] as ReturnType<typeof createTestScene>[]) {
    const deviceRepo = createMockDeviceRepository();
    const roomRepo = createMockRoomRepository();
    const sceneRepo = createMockSceneRepository();
    const homeRepo = createMockHomeRepository();
    homeRepo.findHomesByUserId.mockResolvedValue([home]);
    deviceRepo.findAllByHomeId.mockResolvedValue([lightSala, lightCocina, lightInbox]);
    deviceRepo.findDeviceById.mockImplementation((id: string) => Promise.resolve([lightSala, lightCocina, lightInbox].find((device) => device.id === id) ?? null));
    roomRepo.findRoomsByHomeId.mockResolvedValue([sala, cocina]);
    sceneRepo.findScenesByHomeId.mockResolvedValue(scenes);
    return new PermissionGate(deviceRepo, roomRepo, sceneRepo, createMockAutomationRuleRepository(), homeRepo, async (userId) => subjects[userId] ?? null);
  }

  const guest = { role: 'guest', accessScope: 'rooms' as const, roomIds: ['sala'] };
  const parent = { role: 'parent', accessScope: 'all' as const, roomIds: [] };

  it('Scenario: Given a guest limited to the living room When devices and rooms are listed Then only that room appears', async () => {
    const gate = createGate({ visita: guest });

    expect((await gate.getAuthorizedDevices('visita')).map((device) => device.id)).toEqual(['light-sala']);
    expect((await gate.getAuthorizedRooms('visita')).map((room) => room.id)).toEqual(['sala']);
  });

  it('Scenario: Given a family member or an unknown scope provider answer When listed Then the whole home appears', async () => {
    const gate = createGate({ mama: parent });

    expect(await gate.getAuthorizedDevices('mama')).toHaveLength(3);
    expect(await gate.getAuthorizedRooms('mama')).toHaveLength(2);
    expect(await gate.getAuthorizedDevices('someone-unknown')).toHaveLength(3);
  });

  it('Scenario: Given no scope provider at all When listed Then nothing changes for anyone', async () => {
    const deviceRepo = createMockDeviceRepository();
    const homeRepo = createMockHomeRepository();
    homeRepo.findHomesByUserId.mockResolvedValue([home]);
    deviceRepo.findAllByHomeId.mockResolvedValue([lightSala, lightCocina]);
    const gate = new PermissionGate(deviceRepo, createMockRoomRepository(), createMockSceneRepository(), createMockAutomationRuleRepository(), homeRepo);

    expect(await gate.getAuthorizedDevices('visita')).toHaveLength(2);
  });

  it('Scenario: Given a guest When a device outside its rooms is commanded Then the gate refuses it', async () => {
    const gate = createGate({ visita: guest, mama: parent });

    await expect(gate.assertDeviceAuthorized('visita', lightSala)).resolves.toBeUndefined();
    await expect(gate.assertDeviceAuthorized('visita', lightCocina)).rejects.toThrow('ASSISTANT_DEVICE_FORBIDDEN');
    await expect(gate.assertDeviceAuthorized('visita', lightInbox)).rejects.toThrow('ASSISTANT_DEVICE_FORBIDDEN');
    await expect(gate.assertDeviceAuthorized('mama', lightCocina)).resolves.toBeUndefined();
  });

  it('Scenario: Given scenes owned by the guest When listed or authorized Then only scenes inside its rooms remain', async () => {
    const inside = createTestScene({ id: 's-in', homeId: 'home-1', userId: 'visita', actions: [{ deviceId: 'light-sala', command: { name: 'turn_on', params: {} } }] });
    const outside = createTestScene({ id: 's-out', homeId: 'home-1', userId: 'visita', actions: [{ deviceId: 'light-cocina', command: { name: 'turn_on', params: {} } }] });
    const mixed = createTestScene({ id: 's-mix', homeId: 'home-1', userId: 'visita', actions: [
      { deviceId: 'light-sala', command: { name: 'turn_on', params: {} } },
      { deviceId: 'light-cocina', command: { name: 'turn_on', params: {} } },
    ] });
    const gate = createGate({ visita: guest }, [inside, outside, mixed]);

    expect((await gate.getAuthorizedScenes('visita')).map((scene) => scene.id)).toEqual(['s-in']);
    await expect(gate.assertSceneAuthorized('visita', inside)).resolves.toBeUndefined();
    await expect(gate.assertSceneAuthorized('visita', outside)).rejects.toThrow('ASSISTANT_SCENE_FORBIDDEN');
    await expect(gate.assertSceneAuthorized('visita', mixed)).rejects.toThrow('ASSISTANT_SCENE_FORBIDDEN');
  });
});
