import { PermissionGate } from '../application/PermissionGate';
import {
  createMockDeviceRepository,
  createMockRoomRepository,
  createMockSceneRepository,
  createMockAutomationRuleRepository,
  createMockHomeRepository,
  createTestDevice,
  createTestRoom,
  createTestHome
} from './test_helpers';

describe('PermissionGate', () => {
  let deviceRepo: any;
  let roomRepo: any;
  let sceneRepo: any;
  let automationRepo: any;
  let homeRepo: any;

  const homeA = createTestHome({ id: 'home-a', ownerId: 'user-a' });
  const homeB = createTestHome({ id: 'home-b', ownerId: 'user-b' });
  const deviceA = createTestDevice({ id: 'd-a', homeId: 'home-a' });
  const deviceB = createTestDevice({ id: 'd-b', homeId: 'home-b' });
  const roomA = createTestRoom({ id: 'r-a', homeId: 'home-a' });

  beforeEach(() => {
    deviceRepo = createMockDeviceRepository();
    roomRepo = createMockRoomRepository();
    sceneRepo = createMockSceneRepository();
    automationRepo = createMockAutomationRuleRepository();
    homeRepo = createMockHomeRepository();

    homeRepo.findHomesByUserId.mockImplementation((userId: string) =>
      Promise.resolve(userId === 'user-a' ? [homeA] : userId === 'user-b' ? [homeB] : [])
    );
    deviceRepo.findAllByHomeId.mockImplementation((homeId: string) =>
      Promise.resolve(homeId === 'home-a' ? [deviceA] : homeId === 'home-b' ? [deviceB] : [])
    );
    roomRepo.findRoomsByHomeId.mockImplementation((homeId: string) =>
      Promise.resolve(homeId === 'home-a' ? [roomA] : [])
    );
    // Deliberately different from the scoped methods, so a call site that forgot
    // to switch to the scoped fetch would be caught by any assertion using it.
    deviceRepo.findAll.mockResolvedValue([deviceA, deviceB]);
  });

  it('resolves only the homes a user actually owns', async () => {
    const gate = new PermissionGate(deviceRepo, roomRepo, sceneRepo, automationRepo, homeRepo);
    expect(await gate.authorizedHomeIdsFor('user-a')).toEqual(['home-a']);
    expect(await gate.authorizedHomeIdsFor('user-without-home')).toEqual([]);
  });

  it('scopes devices/rooms strictly to the authorized home, never leaking the other home', async () => {
    const gate = new PermissionGate(deviceRepo, roomRepo, sceneRepo, automationRepo, homeRepo);
    expect(await gate.getAuthorizedDevices('user-a')).toEqual([deviceA]);
    expect(await gate.getAuthorizedRooms('user-a')).toEqual([roomA]);
  });

  it('returns nothing for a user with no authorized homes rather than falling back to global data', async () => {
    const gate = new PermissionGate(deviceRepo, roomRepo, sceneRepo, automationRepo, homeRepo);
    expect(await gate.getAuthorizedDevices('user-without-home')).toEqual([]);
  });

  it('falls back to the unrestricted repository list only when no HomeRepository is configured', async () => {
    const gate = new PermissionGate(deviceRepo, roomRepo, sceneRepo, automationRepo, undefined);
    expect(await gate.getAuthorizedDevices('user-a')).toEqual([deviceA, deviceB]);
  });

  it('assertHomeAuthorized throws for a home the user does not own', async () => {
    const gate = new PermissionGate(deviceRepo, roomRepo, sceneRepo, automationRepo, homeRepo);
    await expect(gate.assertHomeAuthorized('user-a', 'home-a')).resolves.toBeUndefined();
    await expect(gate.assertHomeAuthorized('user-a', 'home-b')).rejects.toThrow('ASSISTANT_HOME_FORBIDDEN');
  });
});
