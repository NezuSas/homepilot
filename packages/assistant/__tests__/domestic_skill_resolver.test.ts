import { DomesticSkillResolver } from '../application/DomesticSkillResolver';
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
  createTestScene
} from './test_helpers';

describe('DomesticSkillResolver', () => {
  function createResolver() {
    const devices = createMockDeviceRepository();
    const rooms = createMockRoomRepository();
    const scenes = createMockSceneRepository();
    const automations = createMockAutomationRuleRepository();
    const homes = createMockHomeRepository({
      findHomesByUserId: jest.fn().mockResolvedValue([createTestHome({ id: 'home-1' })])
    });
    const permissionGate = new PermissionGate(devices, rooms, scenes, automations, homes);
    return { resolver: new DomesticSkillResolver(permissionGate), devices, rooms, scenes };
  }

  it('returns a factual home insight from only authorized device state', async () => {
    const { resolver, devices } = createResolver();
    devices.findAllByHomeId.mockResolvedValue([
      createTestDevice({ id: 'light-1', name: 'Living light', lastKnownState: { on: true } }),
      createTestDevice({ id: 'sensor-1', name: 'Private sensor', type: 'sensor', lastKnownState: { state: 'unavailable' } })
    ]);

    const result = await resolver.resolve('Dime algo interesante sobre mi casa', 'user-1', 'es');

    expect(result).toEqual(expect.objectContaining({
      skill: 'home_insight',
      message: expect.stringContaining('1 dispositivo disponible')
    }));
  });

  it('resolves a unique room comfort request with real local options and no execution', async () => {
    const { resolver, devices, rooms, scenes } = createResolver();
    rooms.findRoomsByHomeId.mockResolvedValue([createTestRoom({ id: 'room-living', name: 'Sala de Reuniones' })]);
    devices.findAllByHomeId.mockResolvedValue([
      createTestDevice({ id: 'light-1', name: 'Estar', roomId: 'room-living', type: 'light' }),
      createTestDevice({ id: 'cover-1', name: 'Cortina Sala', roomId: 'room-living', type: 'cover' })
    ]);
    scenes.findScenesByHomeId.mockResolvedValue([createTestScene({ id: 'scene-1', roomId: 'room-living', name: 'Cine' })]);

    const result = await resolver.resolve('Quiero que la sala se sienta acogedora esta noche', 'user-1', 'es');

    expect(result).toEqual(expect.objectContaining({ skill: 'room_comfort' }));
    expect(result?.message).toContain('Sala de Reuniones');
    expect(result?.message).toContain('Cine');
    expect(result?.message).toContain('Estar');
    expect(result?.message).toContain('Cortina Sala');
    expect(result?.context.room?.id).toBe('room-living');
  });

  it('offers factual scene discovery without intercepting execution requests', async () => {
    const { resolver, scenes } = createResolver();
    scenes.findScenesByHomeId.mockResolvedValue([createTestScene({ name: 'Trabajo' })]);

    const result = await resolver.resolve('¿Qué escena puedo usar para ver una película?', 'user-1', 'es');

    expect(result).toEqual(expect.objectContaining({ skill: 'scene_discovery' }));
    expect(result?.message).toContain('No encontré una escena');
    expect(result?.context.entities).toEqual([]);

    await expect(resolver.resolve('Activa una escena para ver una película', 'user-1', 'es')).resolves.toBeNull();
  });

  it('lists only real authorized night options without performing an action', async () => {
    const { resolver, devices, rooms, scenes } = createResolver();
    rooms.findRoomsByHomeId.mockResolvedValue([createTestRoom({ id: 'room-1', name: 'Cuarto Master' })]);
    devices.findAllByHomeId.mockResolvedValue([
      createTestDevice({ id: 'light-1', name: 'Lámpara', roomId: 'room-1', lastKnownState: { on: true } }),
      createTestDevice({ id: 'cover-1', name: 'Cortina Master', roomId: 'room-1', type: 'cover' })
    ]);
    scenes.findScenesByHomeId.mockResolvedValue([createTestScene({ id: 'night-1', name: 'Buenas noches' })]);

    const result = await resolver.resolve('¿Qué opciones tengo para la noche?', 'user-1', 'es');

    expect(result).toEqual(expect.objectContaining({ skill: 'night_options' }));
    expect(result?.message).toContain('Buenas noches');
    expect(result?.message).toContain('Lámpara');
    expect(result?.message).toContain('Cortina Master');
  });

  it('does not expose entities from homes outside the caller authorization', async () => {
    const { resolver, devices, rooms } = createResolver();
    rooms.findRoomsByHomeId.mockResolvedValue([createTestRoom({ id: 'room-1', name: 'Sala' })]);
    devices.findAllByHomeId.mockResolvedValue([createTestDevice({ id: 'light-1', name: 'Luz Sala', roomId: 'room-1' })]);

    const result = await resolver.resolve('Quiero una sala acogedora', 'user-1', 'es');

    expect(result?.message).toContain('Luz Sala');
    expect(devices.findAll).not.toHaveBeenCalled();
  });

  it('does not load the authorized home graph for unrelated prompts', async () => {
    const { resolver, devices, rooms, scenes } = createResolver();

    await expect(resolver.resolve('¿Cuál es el pronóstico del tiempo?', 'user-1', 'es')).resolves.toBeNull();

    expect(devices.findAllByHomeId).not.toHaveBeenCalled();
    expect(rooms.findRoomsByHomeId).not.toHaveBeenCalled();
    expect(scenes.findScenesByHomeId).not.toHaveBeenCalled();
  });

  it('asks for clarification when a comfort request matches more than one authorized room', async () => {
    const { resolver, devices, rooms, scenes } = createResolver();
    rooms.findRoomsByHomeId.mockResolvedValue([
      createTestRoom({ id: 'room-1', name: 'Sala Principal' }),
      createTestRoom({ id: 'room-2', name: 'Sala TV' })
    ]);
    devices.findAllByHomeId.mockResolvedValue([]);
    scenes.findScenesByHomeId.mockResolvedValue([]);

    const result = await resolver.resolve('Quiero una sala acogedora', 'user-1', 'es');

    expect(result).toEqual(expect.objectContaining({ skill: 'room_comfort' }));
    expect(result?.message).toContain('Encontré varias estancias');
    expect(result?.context.entities).toEqual([]);
  });
  it('prioritizes a room scene that matches a natural movie goal', async () => {
    const { resolver, devices, rooms, scenes } = createResolver();
    rooms.findRoomsByHomeId.mockResolvedValue([createTestRoom({ id: 'room-living', name: 'Salón Principal' })]);
    scenes.findScenesByHomeId.mockResolvedValue([
      createTestScene({ id: 'scene-relax', roomId: 'room-living', name: 'Relajación' }),
      createTestScene({ id: 'scene-movie', roomId: 'room-living', name: 'Cine en casa' })
    ]);
    devices.findAllByHomeId.mockResolvedValue([]);

    const result = await resolver.resolve('Quiero una experiencia de cine en el salón', 'user-1', 'es');

    expect(result).toEqual(expect.objectContaining({ skill: 'room_comfort' }));
    expect(result?.message).toContain('Cine en casa');
    expect(result?.context.entities.map((entity) => entity.id)).toEqual(['scene-movie']);
  });

  it('lists authorized scenes for a general scene discovery request without executing one', async () => {
    const { resolver, scenes } = createResolver();
    scenes.findScenesByHomeId.mockResolvedValue([createTestScene({ id: 'scene-1', name: 'Buenas noches' })]);

    const result = await resolver.resolve('¿Qué escenas tengo disponibles?', 'user-1', 'es');

    expect(result).toEqual(expect.objectContaining({ skill: 'scene_inventory' }));
    expect(result?.message).toContain('Buenas noches');
    expect(result?.context.entities).toHaveLength(1);
  });
});
