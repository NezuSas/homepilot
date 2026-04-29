import { PlannerV2Validator } from '../application/PlannerV2Validator';
import { PlannerV2Resolver } from '../application/PlannerV2Resolver';
import { AssistantContextBuilder } from '../application/AssistantContextBuilder';
import { PLANNER_V2_SCHEMA, AssistantPlanV2 } from '../application/ports/AssistantPlannerV2';
import { 
  createMockDeviceRepository, 
  createMockRoomRepository, 
  createMockSceneRepository, 
  createMockAssistantMemory,
  createTestDevice,
  createTestRoom,
  createTestScene
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

    it('should resolve category "luces"', async () => {
      const result = await resolver.resolve({ type: 'category', name: 'luces' }, 'user-1');
      expect(result.type).toBe('category');
      expect(result.deviceIds).toContain('dev-1');
      expect(result.deviceIds).toContain('dev-2');
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
