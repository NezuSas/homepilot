import { PlannerV2Validator } from '../application/PlannerV2Validator';
import { PlannerV2Resolver } from '../application/PlannerV2Resolver';
import { AssistantContextBuilder } from '../application/AssistantContextBuilder';
import { PLANNER_V2_SCHEMA, AssistantPlanV2 } from '../application/ports/AssistantPlannerV2';
import { 
  createMockDeviceRepository, 
  createMockRoomRepository, 
  createMockSceneRepository,
  createMockHomeRepository,
  createMockAssistantMemory,
  createTestDevice,
  createTestRoom,
  createTestScene,
  createTestHome
} from './test_helpers';

describe('Assistant Planner V2 Foundation', () => {
  describe('Contract & Schema', () => {
    it('should have a valid JSON schema defined', () => {
      expect(PLANNER_V2_SCHEMA).toBeDefined();
      expect(PLANNER_V2_SCHEMA.type).toBe('object');
      expect(PLANNER_V2_SCHEMA.required).toContain('actions');
    });
  });

  describe('PlannerV2Validator', () => {
    let validator: PlannerV2Validator;

    beforeEach(() => {
      validator = new PlannerV2Validator();
    });

    it('should validate a correct plan', () => {
      const validPlan: AssistantPlanV2 = {
        type: 'plan',
        plan_confidence: 0.9,
        actions: [{
          type: 'set_state',
          target: { type: 'device', name: 'luz sala' },
          command: 'turn_on',
          params: { brightness: 50 },
          confidence: 0.95
        }],
        user_feedback_draft: 'Encendiendo la luz de la sala'
      };

      expect(validator.validate(validPlan)).toBeNull();
    });

    it('should reject invalid command', () => {
      const invalidPlan = {
        type: 'plan',
        plan_confidence: 0.9,
        actions: [{
          type: 'set_state',
          target: { type: 'device', name: 'luz' },
          command: 'INVALID_COMMAND',
          confidence: 0.8
        }],
        user_feedback_draft: 'test'
      };

      expect(validator.validate(invalidPlan)).toContain('Invalid command');
    });

    it('should reject ID leakage (UUID)', () => {
      const leakyPlan = {
        type: 'plan',
        plan_confidence: 0.9,
        actions: [{
          type: 'set_state',
          target: { type: 'device', name: '550e8400-e29b-41d4-a716-446655440000' },
          command: 'turn_on',
          confidence: 0.8
        }],
        user_feedback_draft: 'test'
      };

      expect(validator.validate(leakyPlan)).toContain('ID Leakage detected');
    });

    it('should reject ID leakage (Integration style)', () => {
      const leakyPlan = {
        type: 'plan',
        plan_confidence: 0.9,
        actions: [{
          type: 'set_state',
          target: { type: 'device', name: 'light.kitchen' },
          command: 'turn_on',
          confidence: 0.8
        }],
        user_feedback_draft: 'test'
      };

      expect(validator.validate(leakyPlan)).toContain('ID Leakage detected');
    });

    it('should NOT reject normal strings with dots that are not entity IDs', () => {
      const safePlan = {
        type: 'plan',
        plan_confidence: 0.9,
        actions: [{
          type: 'set_state',
          target: { type: 'device', name: 'v1.0.0' },
          command: 'turn_on',
          confidence: 0.8
        }],
        user_feedback_draft: 'test'
      };

      expect(validator.validate(safePlan)).toBeNull();
    });

    it('should reject a plan exceeding the maximum of 8 actions', () => {
      const tooManyActions = {
        type: 'plan',
        plan_confidence: 0.9,
        actions: new Array(9).fill(null).map(() => ({
          type: 'set_state',
          target: { type: 'device', name: 'luz' },
          command: 'turn_on',
          confidence: 0.9
        })),
        user_feedback_draft: 'test'
      };

      expect(validator.validate(tooManyActions)).toContain('maximum of 8 actions');
    });

    it('should accept a plan with exactly 8 actions', () => {
      const eightActions = {
        type: 'plan',
        plan_confidence: 0.9,
        actions: new Array(8).fill(null).map(() => ({
          type: 'set_state',
          target: { type: 'device', name: 'luz' },
          command: 'turn_on',
          confidence: 0.9
        })),
        user_feedback_draft: 'test'
      };

      expect(validator.validate(eightActions)).toBeNull();
    });
  });

    it('should reject malformed confidence, targets and action parameters', () => {
      const validator = new PlannerV2Validator();
      const invalidPlans = [
        { type: 'plan', plan_confidence: 2, actions: [], user_feedback_draft: 'x' },
        { type: 'plan', plan_confidence: 0.5, actions: [{ type: 'set_state', command: 'turn_on', confidence: 0.5 }], user_feedback_draft: 'x' },
        { type: 'plan', plan_confidence: 0.5, actions: [{ type: 'set_state', target: { type: 'device', name: 'Luz' }, command: 'turn_on', confidence: 0.5, params: { brightness: 101 } }], user_feedback_draft: 'x' },
        { type: 'plan', plan_confidence: 0.5, actions: [{ type: 'set_state', target: { type: 'device', name: 'Luz' }, command: 'turn_on', confidence: 0.5, params: { position: -1 } }], user_feedback_draft: 'x' },
      ];

      expect(validator.validate(invalidPlans[0])).toContain('plan_confidence');
      expect(validator.validate(invalidPlans[1])).toContain('Action target is missing');
      expect(validator.validate(invalidPlans[2])).toContain('Brightness');
      expect(validator.validate(invalidPlans[3])).toContain('Position');
    });
  describe('AssistantContextBuilder - Zero-ID Leakage', () => {
    it('should build a home map without exposing internal IDs', async () => {
      const deviceRepo = createMockDeviceRepository({
        findAll: jest.fn().mockResolvedValue([
          createTestDevice({ id: 'real-device-uuid-123', name: 'Luz Cocina', roomId: 'real-room-uuid-456' })
        ])
      });
      const roomRepo = createMockRoomRepository({
        findAll: jest.fn().mockResolvedValue([
          createTestRoom({ id: 'real-room-uuid-456', name: 'Cocina' })
        ])
      });
      const sceneRepo = createMockSceneRepository({
        findAll: jest.fn().mockResolvedValue([
          createTestScene({ id: 'real-scene-uuid-789', name: 'Cena' })
        ])
      });
      const memory = createMockAssistantMemory();

      const builder = new AssistantContextBuilder(deviceRepo, sceneRepo, memory, roomRepo);
      const mapJson = await builder.buildLlmHomeMap('user-1');
      
      expect(mapJson).toContain('Luz Cocina');
      expect(mapJson).toContain('Cocina');
      expect(mapJson).toContain('Cena');
      
      // Strict ID checks
      expect(mapJson).not.toContain('real-device-uuid-123');
      expect(mapJson).not.toContain('real-room-uuid-456');
      expect(mapJson).not.toContain('real-scene-uuid-789');
    });
  });

  describe('PlannerV2Resolver', () => {
    let resolver: PlannerV2Resolver;
    let deviceRepo: any;
    let roomRepo: any;
    let sceneRepo: any;
    let memory: any;

    beforeEach(() => {
      deviceRepo = createMockDeviceRepository({
        findAll: jest.fn().mockResolvedValue([
          createTestDevice({ id: 'dev-1', name: 'Luz Techo', roomId: 'room-1', type: 'light' }),
          createTestDevice({ id: 'dev-2', name: 'Luz Mesa', roomId: 'room-1', type: 'light' })
        ])
      });
      roomRepo = createMockRoomRepository({
        findAll: jest.fn().mockResolvedValue([
          createTestRoom({ id: 'room-1', name: 'Sala' })
        ])
      });
      sceneRepo = createMockSceneRepository({
        findAll: jest.fn().mockResolvedValue([
          createTestScene({ id: 'scene-1', name: 'Cine' })
        ])
      });
      memory = createMockAssistantMemory({
        getShortTermMemory: jest.fn().mockResolvedValue({
          entities: [{ id: 'dev-1', name: 'Luz Techo', type: 'light', roomId: 'room-1' }],
          timestamp: new Date().toISOString()
        })
      });

      resolver = new PlannerV2Resolver(deviceRepo, roomRepo, sceneRepo, memory);
    });

    it('should resolve single device by name', async () => {
      const result = await resolver.resolve({ type: 'device', name: 'Luz Mesa' }, 'user-1');
      expect(result.type).toBe('single');
      expect(result.deviceId).toBe('dev-2');
    });

    it('should resolve room and expand to devices', async () => {
      const result = await resolver.resolve({ type: 'room', name: 'Sala' }, 'user-1');
      expect(result.type).toBe('room');
      expect(result.deviceIds).toContain('dev-1');
      expect(result.deviceIds).toContain('dev-2');
    });

    it('should resolve context reference "it"', async () => {
      const result = await resolver.resolve({ type: 'context_reference', name: 'it', context_hint: 'it' }, 'user-1');
      expect(result.type).toBe('single');
      expect(result.deviceId).toBe('dev-1');
    });

    it('should resolve context reference "turn_it_off"', async () => {
      const result = await resolver.resolve({ type: 'context_reference', name: 'apagala', context_hint: 'turn_it_off' }, 'user-1');
      expect(result.type).toBe('single');
      expect(result.deviceId).toBe('dev-1');
    });

    it('should resolve alias from memory', async () => {
      memory.getAlias.mockResolvedValue('dev-2');
      const result = await resolver.resolve({ type: 'alias', name: 'mi lampara' }, 'user-1');
      expect(result.type).toBe('single');
      expect(result.deviceId).toBe('dev-2');
    });

    it('should resolve category "luces" matching light devices and light-named switches', async () => {
      // Mock deviceRepo to return a mix of types
      deviceRepo.findAll.mockResolvedValueOnce([
        createTestDevice({ id: 'dev-1', name: 'Luz Techo', type: 'light' }),
        createTestDevice({ id: 'dev-2', name: 'Switch Pasillo', type: 'switch' }),
        createTestDevice({ id: 'dev-3', name: 'Foco Patio', type: 'switch' }),
        createTestDevice({ id: 'dev-4', name: 'Ventilador', type: 'fan' })
      ]);
      const result = await resolver.resolve({ type: 'category', name: 'luces' }, 'user-1');
      expect(result.type).toBe('category');
      expect(result.deviceIds).toContain('dev-1'); // light
      expect(result.deviceIds).toContain('dev-3'); // switch named 'Foco...'
      expect(result.deviceIds).not.toContain('dev-2'); // switch not named light
      expect(result.deviceIds).not.toContain('dev-4'); // fan
    });

    it('should resolve category "luz" same as luces', async () => {
      deviceRepo.findAll.mockResolvedValueOnce([
        createTestDevice({ id: 'dev-1', name: 'Luz Techo', type: 'light' }),
        createTestDevice({ id: 'dev-3', name: 'Foco Patio', type: 'switch' }),
      ]);
      const result = await resolver.resolve({ type: 'category', name: 'luz' }, 'user-1');
      expect(result.type).toBe('category');
      expect(result.deviceIds).toContain('dev-1');
      expect(result.deviceIds).toContain('dev-3');
    });

    it('should resolve category "focos"', async () => {
      deviceRepo.findAll.mockResolvedValueOnce([
        createTestDevice({ id: 'dev-1', name: 'Luz Techo', type: 'light' }),
        createTestDevice({ id: 'dev-3', name: 'Foco Patio', type: 'switch' }),
      ]);
      const result = await resolver.resolve({ type: 'category', name: 'focos' }, 'user-1');
      expect(result.type).toBe('category');
      expect(result.deviceIds).toContain('dev-1');
      expect(result.deviceIds).toContain('dev-3');
    });

    it('should resolve category "lamparas"', async () => {
      deviceRepo.findAll.mockResolvedValueOnce([
        createTestDevice({ id: 'dev-1', name: 'Luz Techo', type: 'light' }),
        createTestDevice({ id: 'dev-3', name: 'Lámpara de pie', type: 'switch' }),
      ]);
      const result = await resolver.resolve({ type: 'category', name: 'lamparas' }, 'user-1');
      expect(result.type).toBe('category');
      expect(result.deviceIds).toContain('dev-1');
      expect(result.deviceIds).toContain('dev-3');
    });

    it('should resolve category "cortinas" to cover devices', async () => {
      deviceRepo.findAll.mockResolvedValueOnce([
        createTestDevice({ id: 'dev-1', name: 'Cortina', type: 'cover' }),
        createTestDevice({ id: 'dev-2', name: 'Luz', type: 'light' }),
      ]);
      const result = await resolver.resolve({ type: 'category', name: 'cortinas' }, 'user-1');
      expect(result.type).toBe('category');
      expect(result.deviceIds).toContain('dev-1');
      expect(result.deviceIds).not.toContain('dev-2');
    });

    it('should return none for unknown category', async () => {
      deviceRepo.findAll.mockResolvedValueOnce([
        createTestDevice({ id: 'dev-1', name: 'Luz', type: 'light' })
      ]);
      const result = await resolver.resolve({ type: 'category', name: 'patos' }, 'user-1');
      expect(result.type).toBe('none');
    });

    describe('NLP Matching logic', () => {
      beforeEach(() => {
        deviceRepo = createMockDeviceRepository({
          findAll: jest.fn().mockResolvedValue([
            createTestDevice({ id: 'dev-1', name: 'Luz Sala', roomId: 'room-1', type: 'light' }),
            createTestDevice({ id: 'dev-2', name: 'Luz Escritorio', roomId: 'room-2', type: 'light' }),
            createTestDevice({ id: 'dev-3', name: 'Luz Cocina', roomId: 'room-3', type: 'light' }),
            createTestDevice({ id: 'dev-4', name: 'Cortina Sala Curtain', roomId: 'room-1', type: 'cover' })
          ])
        });
        resolver = new PlannerV2Resolver(deviceRepo, roomRepo, sceneRepo, memory);
      });

      it('should resolve "luz de la sala" to "Luz Sala" ignoring stopwords', async () => {
        const result = await resolver.resolve({ type: 'device', name: 'luz de la sala' }, 'user-1');
        expect(result.type).toBe('single');
        expect(result.deviceId).toBe('dev-1');
      });

      it('should resolve "la luz del escritorio" to "Luz Escritorio"', async () => {
        const result = await resolver.resolve({ type: 'device', name: 'la luz del escritorio' }, 'user-1');
        expect(result.type).toBe('single');
        expect(result.deviceId).toBe('dev-2');
      });

      it('should resolve "luz de cocina" to "Luz Cocina"', async () => {
        const result = await resolver.resolve({ type: 'device', name: 'luz de cocina' }, 'user-1');
        expect(result.type).toBe('single');
        expect(result.deviceId).toBe('dev-3');
      });

      it('should resolve "cortina de la sala" to "Cortina Sala Curtain" via token overlap', async () => {
        const result = await resolver.resolve({ type: 'device', name: 'cortina de la sala' }, 'user-1');
        expect(result.type).toBe('single');
        expect(result.deviceId).toBe('dev-4');
      });

      it('should return multiple if ambiguous (e.g. just "luz")', async () => {
        const result = await resolver.resolve({ type: 'device', name: 'luz' }, 'user-1');
        expect(result.type).toBe('multiple');
        expect(result.deviceIds?.length).toBe(3); // Sala, Escritorio, Cocina
      });

      it('should return none if no match found', async () => {
        const result = await resolver.resolve({ type: 'device', name: 'ventilador del baño' }, 'user-1');
        expect(result.type).toBe('none');
      });
    });
  });
});


describe('PlannerV2Resolver home isolation', () => {
  it('does not resolve devices from global repositories when the user has no authorized homes', async () => {
    const deviceRepo = createMockDeviceRepository({
      findAll: jest.fn(),
      findAllByHomeId: jest.fn(),
    });
    const roomRepo = createMockRoomRepository({ findAll: jest.fn(), findRoomsByHomeId: jest.fn() });
    const sceneRepo = createMockSceneRepository({ findAll: jest.fn(), findScenesByHomeId: jest.fn() });
    const memory = createMockAssistantMemory();
    const homeRepo = { findHomesByUserId: jest.fn().mockResolvedValue([]) };
    const resolver = new PlannerV2Resolver(deviceRepo, roomRepo, sceneRepo, memory, homeRepo as never);

    await expect(resolver.resolve({ type: 'device', name: 'Luz privada' }, 'user-without-home')).resolves.toEqual({ type: 'none' });
    expect(deviceRepo.findAll).not.toHaveBeenCalled();
    expect(deviceRepo.findAllByHomeId).not.toHaveBeenCalled();
  });
});
describe('PlannerV2Resolver remaining target contracts', () => {
  function createResolver() {
    const deviceRepo = createMockDeviceRepository({
      findAll: jest.fn().mockResolvedValue([
        createTestDevice({ id: 'switch-1', name: 'Interruptor Sala', type: 'switch' }),
        createTestDevice({ id: 'light-1', name: 'Luz Sala', type: 'light' }),
      ]),
    });
    const roomRepo = createMockRoomRepository({ findAll: jest.fn().mockResolvedValue([]) });
    const sceneRepo = createMockSceneRepository({
      findAll: jest.fn().mockResolvedValue([
        createTestScene({ id: 'scene-1', name: 'Cine Sala' }),
        createTestScene({ id: 'scene-2', name: 'Cine Patio' }),
      ]),
    });
    const memory = createMockAssistantMemory({ getShortTermMemory: jest.fn().mockResolvedValue(null) });
    return new PlannerV2Resolver(deviceRepo, roomRepo, sceneRepo, memory);
  }

  it('returns only physical switches for the switch category', async () => {
    const result = await createResolver().resolve({ type: 'category', name: 'interruptores' }, 'user-1');
    expect(result).toEqual({ type: 'category', deviceIds: ['switch-1'] });
  });

  it('does not select an ambiguous scene silently', async () => {
    const result = await createResolver().resolve({ type: 'scene', name: 'cine' }, 'user-1');
    expect(result).toEqual({ type: 'multiple', deviceIds: [] });
  });

  it('keeps unresolved context explicit when no short-term memory exists', async () => {
    const result = await createResolver().resolve({ type: 'context_reference', name: 'eso', context_hint: 'it' }, 'user-1');
    expect(result).toEqual({ type: 'none', contextSource: 'none' });
  });
});

describe('PlannerV2Resolver authorized-home resolution', () => {
  it('resolves rooms and scenes only from the caller home membership', async () => {
    const homeRepo = createMockHomeRepository({
      findHomesByUserId: jest.fn().mockResolvedValue([
        createTestHome({ id: 'home-a', ownerId: 'user-a' }),
        createTestHome({ id: 'home-b', ownerId: 'user-a' }),
      ]),
    });
    const deviceRepo = createMockDeviceRepository({
      findAllByHomeId: jest.fn((homeId: string) => Promise.resolve(
        homeId === 'home-a' ? [createTestDevice({ id: 'device-a', name: 'Luz Sala', roomId: 'room-a', homeId })] : []
      )),
    });
    const roomRepo = createMockRoomRepository({
      findRoomsByHomeId: jest.fn((homeId: string) => Promise.resolve(
        homeId === 'home-a' ? [createTestRoom({ id: 'room-a', name: 'Sala', homeId })] : []
      )),
    });
    const sceneRepo = createMockSceneRepository({
      findScenesByHomeId: jest.fn((homeId: string) => Promise.resolve(
        homeId === 'home-b' ? [createTestScene({ id: 'scene-b', name: 'Cine', homeId })] : []
      )),
    });
    const resolver = new PlannerV2Resolver(deviceRepo, roomRepo, sceneRepo, createMockAssistantMemory(), homeRepo);

    await expect(resolver.resolve({ type: 'room', name: 'sala' }, 'user-a')).resolves.toEqual({ type: 'room', roomIds: ['room-a'], deviceIds: ['device-a'] });
    await expect(resolver.resolve({ type: 'scene', name: 'cine' }, 'user-a')).resolves.toEqual({ type: 'single', sceneId: 'scene-b' });
    await expect(resolver.resolve({ type: 'zone', name: 'no implementada' }, 'user-a')).resolves.toEqual({ type: 'none' });

    expect(roomRepo.findRoomsByHomeId).toHaveBeenCalledWith('home-a');
    expect(sceneRepo.findScenesByHomeId).toHaveBeenCalledWith('home-b');
    expect(deviceRepo.findAll).not.toHaveBeenCalled();
  });
});