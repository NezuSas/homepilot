import { AssistantContextBuilder } from '../application/AssistantContextBuilder';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { createTestDevice, createTestHome, createTestRoom, createTestScene, createMockDeviceRepository, createMockHomeRepository, createMockRoomRepository, createMockSceneRepository } from './test_helpers';

describe('AssistantContextBuilder', () => {
  let mockDeviceRepo: jest.Mocked<DeviceRepository>;
  let mockSceneRepo: jest.Mocked<SceneRepository>;
  let builder: AssistantContextBuilder;

  beforeEach(() => {
    mockDeviceRepo = createMockDeviceRepository();
    mockSceneRepo = createMockSceneRepository();
    builder = new AssistantContextBuilder(mockDeviceRepo, mockSceneRepo);
  });

  it('should build context with limited devices and scenes', async () => {
    const manyDevices = Array.from({ length: 60 }, (_, i) => 
      createTestDevice({
        id: `dev-${i}`,
        name: `Device ${i}`,
        type: 'light'
      })
    );
    const manyScenes = Array.from({ length: 60 }, (_, i) => 
      createTestScene({
        id: `scene-${i}`,
        name: `Scene ${i}`
      })
    );

    mockDeviceRepo.findAll.mockResolvedValue(manyDevices);
    mockSceneRepo.findAll.mockResolvedValue(manyScenes);

    const contextStr = await builder.build();
    const context = JSON.parse(contextStr);

    expect(context.devices).toHaveLength(50);
    expect(context.scenes).toHaveLength(50);
    
    // Verify privacy
    expect(context.devices[0]).toHaveProperty('id');
    expect(context.devices[0]).toHaveProperty('name');
    expect(context.devices[0]).toHaveProperty('type');
    expect(context.devices[0]).toHaveProperty('capabilities');
    
    expect(context.devices[0]).not.toHaveProperty('homeId');
    expect(context.devices[0]).not.toHaveProperty('externalId');
  });
});

describe('AssistantContextBuilder scoped and lightweight maps', () => {
  function memory(overrides: Record<string, jest.Mock> = {}) {
    return {
      getRecentActions: jest.fn().mockResolvedValue([{ actions: [{ deviceId: 'device-1', commandName: 'turn_on', status: 'success' }] }]),
      getShortTermMemory: jest.fn().mockResolvedValue({ entities: [{ id: 'device-1', name: 'Kitchen light', type: 'light', roomId: 'room-1' }] }),
      getAliases: jest.fn().mockResolvedValue({ kitchen: 'device-1' }),
      ...overrides
    };
  }

  it('scopes devices, rooms, and scenes to the authenticated user in LLM maps', async () => {
    const devices = createMockDeviceRepository({
      findAllByHomeId: jest.fn(async (homeId) => homeId === 'home-1' ? [createTestDevice({ id: 'device-1', name: 'Kitchen light', roomId: 'room-1', lastKnownState: { power: 'on' } })] : [createTestDevice({ id: 'device-2', name: 'Private device', homeId: 'home-2' })])
    });
    const scenes = createMockSceneRepository({
      findScenesByHomeId: jest.fn(async (homeId) => homeId === 'home-1' ? [createTestScene({ name: 'Movie', actions: [{ deviceId: 'device-1', command: 'turn_on' }] })] : [createTestScene({ name: 'Private scene', homeId: 'home-2' })])
    });
    const rooms = createMockRoomRepository({
      findRoomsByHomeId: jest.fn(async (homeId) => homeId === 'home-1' ? [createTestRoom({ id: 'room-1', name: 'Kitchen' })] : [createTestRoom({ id: 'room-2', homeId: 'home-2', name: 'Private room' })])
    });
    const homes = createMockHomeRepository({ findHomesByUserId: jest.fn().mockResolvedValue([createTestHome({ id: 'home-1' })]) });
    const builder = new AssistantContextBuilder(devices, scenes, memory() as never, rooms, homes);

    const map = JSON.parse(await builder.buildLlmHomeMap('user-1'));
    const light = JSON.parse(await builder.buildLightLlmHomeMap('user-1'));

    expect(map.devices).toEqual([expect.objectContaining({ name: 'Kitchen light', roomName: 'Kitchen' })]);
    expect(map.scenes).toEqual([expect.objectContaining({ name: 'Movie', estimatedActions: 1 })]);
    expect(map.recentActions).toEqual([{ deviceName: 'Kitchen light', commandName: 'turn_on', status: 'success' }]);
    expect(map.lastConversationEntities).toEqual([{ name: 'Kitchen light', type: 'light', roomName: 'Kitchen' }]);
    expect(light.devices).toEqual([expect.objectContaining({ name: 'Kitchen light', alias: 'kitchen', room: 'Kitchen', on: true })]);
  });

  it('returns an empty map for users without homes and preserves compatibility for no user identity', async () => {
    const devices = createMockDeviceRepository({ findAll: jest.fn().mockResolvedValue([createTestDevice({ id: 'legacy' })]) });
    const scenes = createMockSceneRepository({ findAll: jest.fn().mockResolvedValue([createTestScene({ name: 'Legacy scene' })]) });
    const homes = createMockHomeRepository({ findHomesByUserId: jest.fn().mockResolvedValue([]) });
    const builder = new AssistantContextBuilder(devices, scenes, undefined, undefined, homes);

    expect(JSON.parse(await builder.buildLlmHomeMap('user-without-homes'))).toEqual({ devices: [], scenes: [], recentActions: [], lastConversationEntities: [] });
    expect(JSON.parse(await builder.build(null))).toEqual(expect.objectContaining({ devices: [expect.objectContaining({ id: 'legacy' })], scenes: [expect.objectContaining({ name: 'Legacy scene' })] }));
  });

  it('produces an ultra-light map only when the prompt needs matching scenes or memory', async () => {
    const devices = createMockDeviceRepository({ findAll: jest.fn().mockResolvedValue([createTestDevice({ id: 'device-1', name: 'Kitchen light', roomId: null, lastKnownState: { on: true } })]) });
    const scenes = createMockSceneRepository({ findAll: jest.fn().mockResolvedValue([createTestScene({ name: 'Movie' })]) });
    const assistantMemory = memory();
    const builder = new AssistantContextBuilder(devices, scenes, assistantMemory as never);

    const plain = await builder.buildUltraLightLlmHomeMap('turn on the light', 'user-1');
    const contextual = await builder.buildUltraLightLlmHomeMap('activate scene and turn it off', 'user-1');

    expect(plain).toEqual(expect.objectContaining({ devicesCount: 1, text: expect.stringContaining('Kitchen light|No Room|light|on|alias:kitchen') }));
    expect(plain.text).not.toContain('Scenes:');
    expect(plain.text).not.toContain('Memory:');
    expect(contextual.text).toContain('Scenes: Movie');
    expect(contextual.text).toContain('Memory: Kitchen light');
    expect(assistantMemory.getShortTermMemory).toHaveBeenCalledWith('user-1');
  });
  it('limits recent action context and does not read user memory without an identity', async () => {
    const devices = createMockDeviceRepository({ findAll: jest.fn().mockResolvedValue([]) });
    const scenes = createMockSceneRepository({ findAll: jest.fn().mockResolvedValue([]) });
    const assistantMemory = memory({
      getRecentActions: jest.fn().mockResolvedValue([
        { actions: Array.from({ length: 6 }, (_, index) => ({ deviceId: 'd-' + index, commandName: 'turn_on', status: 'success' })) },
      ]),
    });
    const contextBuilder = new AssistantContextBuilder(devices, scenes, assistantMemory as never);

    const context = JSON.parse(await contextBuilder.build(null));

    expect(context.recentActions).toHaveLength(5);
    expect(context.lastConversationEntities).toEqual([]);
    expect(assistantMemory.getShortTermMemory).not.toHaveBeenCalled();
  });
  it('keeps the normal map privacy-safe without memory and labels unresolved rooms explicitly', async () => {
    const devices = createMockDeviceRepository({
      findAll: jest.fn().mockResolvedValue([createTestDevice({ id: 'device-1', name: 'Unknown-room light', roomId: 'missing-room', lastKnownState: { state: 'off' } })]),
    });
    const scenes = createMockSceneRepository({ findAll: jest.fn().mockResolvedValue([]) });
    const rooms = createMockRoomRepository({ findAll: jest.fn().mockResolvedValue([]) });
    const contextBuilder = new AssistantContextBuilder(devices, scenes, undefined, rooms);

    const normal = JSON.parse(await contextBuilder.build(null));
    const llm = JSON.parse(await contextBuilder.buildLlmHomeMap(null));
    const light = JSON.parse(await contextBuilder.buildLightLlmHomeMap(null));

    expect(normal).toEqual(expect.objectContaining({ recentActions: [], lastConversationEntities: [] }));
    expect(llm.devices).toEqual([expect.objectContaining({ roomName: 'Unknown' })]);
    expect(light.devices).toEqual([expect.objectContaining({ room: 'Unknown', on: false })]);
  });

  it('limits lightweight maps and omits oversized aliases while preserving scene and memory intent', async () => {
    const devices = createMockDeviceRepository({
      findAll: jest.fn().mockResolvedValue(Array.from({ length: 35 }, (_, index) => createTestDevice({
        id: `device-${index}`,
        name: `Device ${index}`,
        roomId: null,
      }))),
    });
    const scenes = createMockSceneRepository({ findAll: jest.fn().mockResolvedValue(Array.from({ length: 12 }, (_, index) => createTestScene({ name: `Scene ${index}` }))) });
    const assistantMemory = memory({ getAliases: jest.fn().mockResolvedValue({ 'an-alias-that-is-too-long': 'device-0' }) });
    const contextBuilder = new AssistantContextBuilder(devices, scenes, assistantMemory as never);

    const light = JSON.parse(await contextBuilder.buildLightLlmHomeMap('user-1'));
    const ultra = await contextBuilder.buildUltraLightLlmHomeMap('modo y esa luz', 'user-1');

    expect(light.devices).toHaveLength(30);
    expect(light.scenes).toHaveLength(10);
    expect(light.devices[0]).toEqual(expect.objectContaining({ alias: 'an-alias-that-is-too-long' }));
    expect(ultra.devicesCount).toBe(30);
    expect(ultra.text).toContain('Scenes: Scene 0, Scene 1');
    expect(ultra.text).not.toContain('an-alias-that-is-too-long');
  });
});