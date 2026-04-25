import { AssistantContextBuilder } from '../application/AssistantContextBuilder';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { createTestDevice, createTestScene, createMockDeviceRepository, createMockSceneRepository } from './test_helpers';

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
