import { FollowUpResolver } from '../application/FollowUpResolver';
import { AssistantMemoryState } from '../application/ports/AssistantMemoryPort';

describe('FollowUpResolver', () => {
  let resolver: FollowUpResolver;

  beforeEach(() => {
    resolver = new FollowUpResolver();
  });

  const mockMemory: AssistantMemoryState = {
    lastQueryType: 'state_devices',
    entities: [
      { id: 'light-1', name: 'Luz Escritorio', type: 'light', roomId: 'room-1' },
      { id: 'light-2', name: 'Luz Techo', type: 'light', roomId: 'room-1' }
    ],
    timestamp: new Date().toISOString()
  };

  it('should resolve "esas" to device names', () => {
    const result = resolver.resolve('esas?', mockMemory, 'es');
    expect(result.resolvedPrompt).toBe('cuéntame sobre Luz Escritorio, Luz Techo');
    expect(result.handled).toBe(false);
    expect(result.referencesMemory).toBe(true);
  });

  it('should resolve "la primera" to the first device name', () => {
    const result = resolver.resolve('apaga la primera', mockMemory, 'es');
    expect(result.resolvedPrompt).toBe('apaga Luz Escritorio');
    expect(result.referencesMemory).toBe(true);
  });

  it('should resolve "the second" to the second device name in English', () => {
    const result = resolver.resolve('turn off the second', mockMemory, 'en');
    expect(result.resolvedPrompt).toBe('turn off Luz Techo');
    expect(result.referencesMemory).toBe(true);
  });

  it('should resolve "en que cuarto esta" for a single entity', () => {
    const singleMemory: AssistantMemoryState = {
      ...mockMemory,
      entities: [mockMemory.entities[0]]
    };
    const result = resolver.resolve('en que cuarto esta', singleMemory, 'es');
    expect(result.resolvedPrompt).toBe('cuarto de Luz Escritorio');
    expect(result.referencesMemory).toBe(true);
  });

  it('should resolve aliases correctly', () => {
    const aliases = { 'mi cuarto': 'sala' };
    const result = resolver.resolve('enciende las luces de mi cuarto', mockMemory, 'es', aliases);
    expect(result.resolvedPrompt).toBe('enciende las luces de sala');
    expect(result.referencesMemory).toBe(false);
  });

  it('should resolve "apagala" for a single entity', () => {
    const singleMemory: AssistantMemoryState = {
      ...mockMemory,
      entities: [mockMemory.entities[0]]
    };
    const result = resolver.resolve('apagala', singleMemory, 'es');
    expect(result.resolvedPrompt).toBe('apaga Luz Escritorio');
    expect(result.referencesMemory).toBe(true);
  });
});
