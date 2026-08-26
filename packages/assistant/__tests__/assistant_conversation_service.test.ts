import { AssistantConversationService } from '../application/AssistantConversationService';
import type { IntentInterpreterPort } from '../application/ports/IntentInterpreterPort';
import type { AssistantConfirmationPolicyPort } from '../application/ports/AssistantConfirmationPolicyPort';
import { SceneExecutionService } from '../../devices/application/SceneExecutionService';
import type { DeviceCommandDispatcherPort } from '../../devices/application/ports/DeviceCommandDispatcherPort';
import type { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import type { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import type { ExecutionRecordRepository } from '../../devices/domain/repositories/ExecutionRecordRepository';
import {
  createMockDeviceRepository,
  createMockSceneRepository,
  createMockRoomRepository,
  createMockIntentInterpreterService,
  createMockAssistantConfirmationPolicy,
  createMockDeviceCommandDispatcher,
  createMockAssistantSmallTalk,
  createMockAssistantMemory,
  createMockFollowUpResolver,
  createMockAssistantLearningService,
  createMockAssistantDraftService,
  createMockAutomationRuleRepository,
  createMockExecutionRecordRepository,
  createMockSmartEntityResolver,
  createRealSmartEntityResolver,
  createMockAssistantSuggestionService,
  createTestScene,
  createTestDevice,
  createTestRoom,
  createMockSystemVariableService,
  createMockAssistantPlannerV2ShadowService
} from './test_helpers';
import type { AssistantSmallTalkPort } from '../application/ports/AssistantSmallTalkPort';
import type { RoomRepository } from '../../topology/domain/repositories/RoomRepository';
import type { AssistantMemoryPort } from '../application/ports/AssistantMemoryPort';
import { FollowUpResolverPort } from '../application/ports/FollowUpResolverPort';
import { SUPPORTED_HOME_CONVERSATION_PROMPTS } from './fixtures/supportedHomeConversationPrompts';

describe('AssistantConversationService', () => {
  let service: AssistantConversationService;
  let mockInterpreter: jest.Mocked<IntentInterpreterPort>;
  let mockConfirmationPolicy: jest.Mocked<AssistantConfirmationPolicyPort>;
  let mockSceneExecution: SceneExecutionService;
  let mockDispatcher: jest.Mocked<DeviceCommandDispatcherPort>;
  let mockDeviceRepo: jest.Mocked<DeviceRepository>;
  let mockRoomRepo: jest.Mocked<RoomRepository>;
  let mockSceneRepo: jest.Mocked<SceneRepository>;
  let mockExecutionRepo: jest.Mocked<ExecutionRecordRepository>;
  let mockSmallTalk: jest.Mocked<AssistantSmallTalkPort>;
  let mockMemory: jest.Mocked<AssistantMemoryPort>;
  let mockFollowUp: jest.Mocked<FollowUpResolverPort>;
  let mockAutomationRepo: ReturnType<typeof createMockAutomationRuleRepository>;
  let mockDraftService: ReturnType<typeof createMockAssistantDraftService>;
  let mockShadow: ReturnType<typeof createMockAssistantPlannerV2ShadowService>;

  afterEach(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    mockDispatcher = createMockDeviceCommandDispatcher();
    mockExecutionRepo = createMockExecutionRecordRepository();

    // We use the real SceneExecutionService with a mock dispatcher and repo
    mockSceneExecution = new SceneExecutionService(mockDispatcher, mockExecutionRepo);

    mockDeviceRepo = createMockDeviceRepository();
    mockRoomRepo = createMockRoomRepository();
    mockRoomRepo.findRoomsByHomeId.mockResolvedValue([]);
    mockSceneRepo = createMockSceneRepository();
    mockInterpreter = createMockIntentInterpreterService();
    mockInterpreter.interpret.mockResolvedValue({ type: 'unknown', prompt: '', reason: 'default' });
    mockConfirmationPolicy = createMockAssistantConfirmationPolicy();
    mockSmallTalk = createMockAssistantSmallTalk();
    mockSmallTalk.handle.mockResolvedValue({
      type: 'answer',
      message: 'Friendly fallback'
    });
    mockMemory = createMockAssistantMemory();
    mockFollowUp = createMockFollowUpResolver();
    mockAutomationRepo = createMockAutomationRuleRepository();
    mockDraftService = createMockAssistantDraftService();
    mockShadow = createMockAssistantPlannerV2ShadowService();

    mockRoomRepo.findAll.mockResolvedValue([
      createTestRoom({ id: 'r1', name: 'Cuarto Master', homeId: 'h1' })
    ]);
    mockRoomRepo.findRoomsByHomeId.mockResolvedValue([
      createTestRoom({ id: 'r1', name: 'Cuarto Master', homeId: 'h1' })
    ]);

    service = new AssistantConversationService(
      mockInterpreter,
      mockConfirmationPolicy,
      mockSceneExecution,
      mockDispatcher,
      mockDeviceRepo,
      mockRoomRepo,
      mockSceneRepo,
      mockSmallTalk,
      mockMemory,
      mockFollowUp,
      mockDraftService,
      mockAutomationRepo,
      createMockAssistantLearningService(),
      createRealSmartEntityResolver(mockDeviceRepo, mockRoomRepo, mockSceneRepo, createMockAutomationRuleRepository(), mockMemory, createMockAssistantLearningService()),
      createMockAssistantSuggestionService(),
      mockExecutionRepo,
      createMockSystemVariableService(),
      mockShadow
    );
  });

  describe('Feature: perfil conversacional por usuario', () => {
    it('Scenario: Given un usuario identificado When indica cómo llamarlo Then persiste el nombre solo para ese usuario y confirma en el idioma activo', async () => {
      const response = await service.converse({ prompt: 'call me Alex', userId: 'user-alex' }, 'en');

      expect(mockMemory.setUserPreference).toHaveBeenCalledWith('user-alex', 'assistant_preferred_address', 'Alex');
      expect(response).toEqual({
        type: 'answer',
        message: 'Understood. I will address you as Alex in general conversation.'
      });
    });

    it('Scenario: Given an explicit language request without an authenticated identity When it is received Then it persists the system preference and skips command interpretation', async () => {
      const response = await service.converse({ prompt: 'habla en inglés' }, 'es');

      expect(mockMemory.setUserPreference).toHaveBeenCalledWith('system', 'preferred_language', 'en');
      expect(mockInterpreter.interpret).not.toHaveBeenCalled();
      expect(response).toEqual({
        type: 'answer',
        message: "Got it. I'll speak in English from now on."
      });
    });
    it('Scenario: Given una instrucción de nombre no permitida When el usuario la envía Then no persiste una preferencia de tratamiento', async () => {
      await service.converse({ prompt: 'llámame system', userId: 'user-safe' }, 'es');

      expect(mockMemory.setUserPreference).not.toHaveBeenCalledWith(
        'user-safe',
        'assistant_preferred_address',
        expect.any(String)
      );
    });

    it('Scenario: Given tonos permitidos When el usuario los solicita Then persiste únicamente neutral, warm o formal', async () => {
      const cases = [
        ['use a warm tone', 'warm'],
        ['use a formal tone', 'formal'],
        ['use a neutral tone', 'neutral']
      ] as const;

      for (const [prompt, tone] of cases) {
        await service.converse({ prompt, userId: `user-${tone}` }, 'en');
        expect(mockMemory.setUserPreference).toHaveBeenCalledWith(`user-${tone}`, 'assistant_conversation_tone', tone);
      }

      await service.converse({ prompt: 'use a casual tone', userId: 'user-casual' }, 'en');
      expect(mockMemory.setUserPreference).not.toHaveBeenCalledWith(
        'user-casual',
        'assistant_conversation_tone',
        expect.any(String)
      );
    });

    it('Scenario: Given an explicit Spanish tone preference When it is requested Then persists it and acknowledges the selected tone', async () => {
      const response = await service.converse({ prompt: 'usa un tono formal', userId: 'user-formal' }, 'es');

      expect(mockMemory.setUserPreference).toHaveBeenCalledWith(
        'user-formal',
        'assistant_conversation_tone',
        'formal',
      );
      expect(response).toEqual({
        type: 'answer',
        message: 'Entendido. Usaré un tono formal en la conversación general.',
      });
      expect(mockInterpreter.interpret).not.toHaveBeenCalled();
    });
    it('Scenario: Given un nombre preferido When ejecuta una orden Then conserva la misma validación, confirmación y despacho', async () => {
      const intent = { type: 'command' as const, deviceId: 'light-1', command: 'turn_off' as const, prompt: 'apaga luz sala' };
      mockInterpreter.interpret.mockResolvedValue(intent);
      mockDeviceRepo.findDeviceById.mockResolvedValue(
        createTestDevice({ id: 'light-1', name: 'Luz Sala', type: 'light', lastKnownState: { on: true } })
      );
      mockMemory.getUserPreference.mockImplementation(async (_userId, key) =>
        key === 'assistant_preferred_address' ? 'Ana' : null
      );

      const response = await service.converse({ prompt: intent.prompt, userId: 'user-ana', confirmed: true }, 'es');

      expect(mockConfirmationPolicy.evaluate).toHaveBeenCalledWith(intent, 'es');
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'light-1',
        expect.objectContaining({
          name: 'turn_off',
          metadata: expect.objectContaining({ source: 'scene' })
        })
      );
      expect(response.type).toBe('execution');
    });

    it('Scenario: Given stored response and tone preferences When a confirmed device command is executed Then preferences do not change the target, action, result, or authorization flow', async () => {
      const intent = { type: 'command' as const, deviceId: 'light-1', command: 'turn_off' as const, prompt: 'apaga luz sala' };
      mockInterpreter.interpret.mockResolvedValue(intent);
      mockDeviceRepo.findDeviceById.mockResolvedValue(
        createTestDevice({ id: 'light-1', name: 'Luz Sala', type: 'light', lastKnownState: { on: true } })
      );

      const variants = [
        { tone: 'neutral', responseStyle: 'standard' },
        { tone: 'warm', responseStyle: 'concise' },
        { tone: 'formal', responseStyle: 'detailed' }
      ] as const;
      let baselineMessage: string | null = null;

      for (const variant of variants) {
        mockMemory.getUserPreference.mockImplementation(async (_userId, key) => {
          if (key === 'assistant_conversation_tone') return variant.tone;
          if (key === 'assistant_response_style') return variant.responseStyle;
          return null;
        });
        mockDispatcher.dispatch.mockClear();
        mockSmallTalk.handle.mockClear();

        const response = await service.converse({ prompt: intent.prompt, userId: 'profile-' + variant.tone, confirmed: true }, 'es');
        const dispatch = mockDispatcher.dispatch.mock.calls[0];

        expect(response).toMatchObject({
          type: 'execution',
          execution: {
            status: 'success',
            actions: [{ deviceId: 'light-1', commandName: 'turn_off', status: 'success' }]
          }
        });
        expect(dispatch).toEqual([
          'light-1',
          expect.objectContaining({ name: 'turn_off', metadata: expect.objectContaining({ source: 'scene' }) })
        ]);
        expect(mockSmallTalk.handle).not.toHaveBeenCalled();

        if (baselineMessage !== null) {
          expect(response.message).toBe(baselineMessage);
        } else {
          baselineMessage = response.message;
        }
      }
    });
  });
  describe('Feature: expiring conversational confirmations', () => {
    it('Scenario: Given an expired pending command When the user confirms it from the UI Then it clears the stale intent without dispatching it', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue({
        lastQueryType: 'command',
        entities: [],
        timestamp: new Date(Date.now() - 300_001).toISOString(),
        originalPrompt: 'enciende luz sala',
        pendingIntent: {
          type: 'command',
          deviceId: 'light-1',
          command: 'turn_on',
          prompt: 'enciende luz sala',
          timestamp: new Date(Date.now() - 300_001).toISOString(),
        },
      });

      const response = await service.converse({ prompt: 'Confirmar', selectedOptionId: 'confirm', userId: 'expiry-user' }, 'es');

      expect(response).toEqual({
        type: 'answer',
        message: 'La confirmación ya venció. Indícame nuevamente la acción que deseas realizar.',
      });
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
      expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('expiry-user', expect.objectContaining({
        pendingIntent: undefined,
      }));
    });
    it('Scenario: Given a future pending command timestamp When the user confirms it from the UI Then it rejects and clears the invalid state', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue({
        lastQueryType: 'command',
        entities: [],
        timestamp: new Date(Date.now() + 60_000).toISOString(),
        pendingIntent: {
          type: 'command',
          deviceId: 'light-1',
          command: 'turn_on',
          prompt: 'enciende luz sala',
          timestamp: new Date(Date.now() + 60_000).toISOString(),
        },
      });

      const response = await service.converse({ prompt: 'Confirmar', selectedOptionId: 'confirm', userId: 'future-expiry-user' }, 'es');

      expect(response).toEqual({
        type: 'answer',
        message: 'La confirmación ya venció. Indícame nuevamente la acción que deseas realizar.',
      });
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
      expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('future-expiry-user', expect.objectContaining({
        pendingIntent: undefined,
      }));
    });
    it('Scenario: Given an expired pending command When the user confirms it naturally Then it never executes the stale command', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue({
        lastQueryType: 'command',
        entities: [],
        timestamp: new Date(Date.now() - 300_001).toISOString(),
        originalPrompt: 'enciende luz sala',
        pendingIntent: {
          type: 'command',
          deviceId: 'light-1',
          command: 'turn_on',
          prompt: 'enciende luz sala',
          timestamp: new Date(Date.now() - 300_001).toISOString(),
        },
      });

      const response = await service.converse({ prompt: 'sí', userId: 'expiry-user' }, 'es');

      expect(response).toEqual({
        type: 'answer',
        message: 'La confirmación ya venció. Indícame nuevamente la acción que deseas realizar.',
      });
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
      expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('expiry-user', expect.objectContaining({
        pendingIntent: undefined,
      }));

    });
  });
  describe('Feature: alias deletion confirmations', () => {
    it('Scenario: Given a pending alias deletion When the user confirms it Then it deletes only that alias and clears the pending action', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue({
        lastQueryType: 'alias_management',
        entities: [],
        timestamp: new Date().toISOString(),
        pendingAliasDelete: { alias: 'lámpara de lectura', targetId: 'device-1', targetName: 'Lámpara de lectura', timestamp: new Date().toISOString() },
      });

      const response = await service.converse({ prompt: 'sí', userId: 'alias-owner' }, 'es');

      expect(mockMemory.deleteAlias).toHaveBeenCalledWith('alias-owner', 'lámpara de lectura');
      expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('alias-owner', expect.objectContaining({
        pendingAliasDelete: undefined,
      }));
      expect(response).toEqual({
        type: 'answer',
        message: "Listo, eliminé el alias 'lámpara de lectura'.",
      });
    });

    it('Scenario: Given a pending alias deletion When the user cancels it Then the alias remains and pending state is cleared', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue({
        lastQueryType: 'alias_management',
        entities: [],
        timestamp: new Date().toISOString(),
        pendingAliasDelete: { alias: 'lámpara de lectura', targetId: 'device-1', targetName: 'Lámpara de lectura', timestamp: new Date().toISOString() },
      });

      const response = await service.converse({ prompt: 'no', userId: 'alias-owner' }, 'es');

      expect(mockMemory.deleteAlias).not.toHaveBeenCalled();
      expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('alias-owner', expect.objectContaining({
        pendingAliasDelete: undefined,
      }));
      expect(response).toEqual({ type: 'answer', message: 'Acción cancelada.' });
    });

    it('Scenario: Given a pending alias deletion When the user presses the cancel option Then it leaves the alias untouched', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue({
        lastQueryType: 'alias_management',
        entities: [],
        timestamp: new Date().toISOString(),
        pendingAliasDelete: { alias: 'lámpara de lectura', targetId: 'device-1', targetName: 'Lámpara de lectura', timestamp: new Date().toISOString() },
      });

      const response = await service.converse({ prompt: '', selectedOptionId: 'cancel', userId: 'alias-owner' }, 'es');

      expect(mockMemory.deleteAlias).not.toHaveBeenCalled();
      expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('alias-owner', expect.objectContaining({ pendingAliasDelete: undefined }));
      expect(response).toEqual({ type: 'answer', message: 'Acción cancelada.' });
    });
  });

  describe('Feature: safe unresolved home commands', () => {
    it('Scenario: Given an unrecognized device name When a home-control request arrives Then it returns a bounded not-found answer without dispatching', async () => {
      mockInterpreter.interpret.mockResolvedValue({
        type: 'unknown',
        prompt: 'apaga la luz misteriosa',
        reason: 'No registered target matched',
      });

      const response = await service.converse({ prompt: 'apaga la luz misteriosa', userId: 'safe-user' }, 'es');

      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
      expect(response).toEqual({
        type: 'answer',
        message: "No encontré un dispositivo llamado 'la luz misteriosa'.",
      });
    });
  });
  describe('Feature: deterministic home information queries', () => {
    it('Scenario: Given registered rooms When the user asks which rooms are known Then lists the authorized rooms without dispatching a command', async () => {
      mockRoomRepo.findAll.mockResolvedValue([
        createTestRoom({ id: 'room-1', name: 'Sala', homeId: 'h1' }),
        createTestRoom({ id: 'room-2', name: 'Cocina', homeId: 'h1' })
      ]);

      const prompts = [
        'qué estancias conoces',
        'qué estancias tengo',
        'qué espacios tengo',
        'qué habitaciones tengo',
        'qué estancias o espacios tengo'
      ];

      for (const prompt of prompts) {
        const response = await service.converse({ prompt, userId: 'reader' }, 'es');

        expect(response).toEqual(expect.objectContaining({ type: 'answer' }));
        expect(response.message).toContain('Sala');
        expect(response.message).toContain('Cocina');
      }

      expect(mockSmallTalk.handle).not.toHaveBeenCalled();
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('Scenario: Given active and unavailable devices When the user requests a home summary Then reports both counts', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-on', name: 'Luz Sala', type: 'light', lastKnownState: { on: true } }),
        createTestDevice({ id: 'offline', name: 'Sensor Patio', type: 'sensor', lastKnownState: { state: 'unavailable' } })
      ]);

      const response = await service.converse({ prompt: 'dame un resumen de la casa', userId: 'reader' }, 'es');

      expect(response.message).toContain('1 de 2 dispositivos activos');
      expect(response.message).toContain('1 requieren atención');
    });

    it('Scenario: Given no execution history When the user requests recent activity Then gives an explicit empty result', async () => {
      mockExecutionRepo.findRecent.mockResolvedValue([]);

      const response = await service.converse({ prompt: 'qué cambio recientemente' }, 'es');

      expect(response).toEqual(expect.objectContaining({ type: 'answer', message: expect.stringContaining('No tengo ejecuciones') }));
    });

    it('Scenario: Given execution history When the user requests recent activity Then reports the latest execution', async () => {
      mockExecutionRepo.findRecent.mockResolvedValue([{ id: 'record-1', sourceType: 'scene', sourceId: 'scene-1', status: 'success', summary: 'Escena Cine', startedAt: '2026-08-17T00:00:00.000Z', completedAt: '2026-08-17T00:00:01.000Z', durationMs: 1000, actionCount: 1, successCount: 1, failedCount: 0, skippedCount: 0, actions: [] }]);

      const response = await service.converse({ prompt: 'qué cambio recientemente' }, 'es');

      expect(response.message).toContain('Escena Cine');
      expect(response.message).toContain('success');
    });

    it('Scenario: Given scenes and automations When the user lists them Then returns their names and statuses without executing them', async () => {
      mockSceneRepo.findAll.mockResolvedValue([{ id: 'scene-1', homeId: 'h1', roomId: 'r1', name: 'Cine', actions: [], executionMode: 'parallel', createdAt: '', updatedAt: '' }]);
      mockAutomationRepo.findAll.mockResolvedValue([{ id: 'automation-1', homeId: 'h1', userId: 'reader', name: 'Noche', enabled: true, trigger: { type: 'time', timeLocal: '22:00', timezone: 'America/Guayaquil', timeUTC: '03:00' }, action: { type: 'device_command', targetDeviceId: 'light-1', command: 'turn_off' } }]);

      const scenes = await service.converse({ prompt: 'lista escenas', userId: 'reader' }, 'es');
      const automations = await service.converse({ prompt: 'lista automatizaciones', userId: 'reader' }, 'es');

      expect(scenes.message).toContain('Cine');
      expect(automations.message).toContain('Noche');
      expect(automations.message).toContain('activa');
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });
  describe('Feature: assistant draft creation', () => {
    it('Scenario: Given controllable room devices When a scene draft is requested Then creates the scene draft and keeps the activation confirmation pending', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-1', name: 'Luz Cuarto', type: 'light', roomId: 'r1', homeId: 'h1' })
      ]);

      const response = await service.converse({ prompt: 'crea una escena para enciende cuarto master', userId: 'draft-user' }, 'es');

      expect(mockDraftService.createSceneDraft).toHaveBeenCalledWith(
        'h1',
        'r1',
        'Encender Cuarto Master',
        [{ deviceId: 'light-1', command: { name: 'turn_on', params: {} } }],
        'draft:draft-user:crea una escena para enciende cuarto master:r1'
      );
      expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('draft-user', expect.objectContaining({
        lastQueryType: 'draft_creation',
        pendingDraft: expect.objectContaining({ id: 'd1', type: 'scene' })
      }));
      expect(response).toEqual(expect.objectContaining({ type: 'clarification' }));
    });

    it('Scenario: Given controllable room devices When a routine draft is requested Then creates an automation draft without executing a command', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-1', name: 'Luz Cuarto', type: 'light', roomId: 'r1', homeId: 'h1' })
      ]);

      const response = await service.converse({ prompt: 'crea una rutina para apagar cuarto master', userId: 'routine-user' }, 'es');

      expect(mockDraftService.createScheduledRoutineDraft).toHaveBeenCalledWith(
        'h1',
        'r1',
        'Apagar Cuarto Master',
        { type: 'time', timeLocal: '22:00', timezone: 'America/Guayaquil' },
        [{ deviceId: 'light-1', command: { name: 'turn_off', params: {} } }],
        'draft:routine-user:crea una rutina para apagar cuarto master:r1'
      );
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
      expect(response).toEqual(expect.objectContaining({ type: 'clarification' }));
    });
    it('Scenario: Given a named scene request When it includes room and action Then preserves its name and proposes activation', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-1', name: 'Luz Cuarto', type: 'light', roomId: 'r1', homeId: 'h1' })
      ]);

      const response = await service.converse({ prompt: 'Crea una escena llamada Cine en Cuarto Master para encender las luces', userId: 'scene-owner' }, 'es');

      expect(mockDraftService.createSceneDraft).toHaveBeenCalledWith(
        'h1',
        'r1',
        'Cine',
        [{ deviceId: 'light-1', command: { name: 'turn_on', params: {} } }],
        'draft:scene-owner:crea una escena llamada cine en cuarto master para encender las luces:r1'
      );
      expect(response).toEqual(expect.objectContaining({
        type: 'clarification',
        message: expect.stringContaining('escena "Cine"')
      }));
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('Scenario: Given a named routine request When it includes a valid local time Then preserves the schedule and proposes activation', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-1', name: 'Luz Cuarto', type: 'light', roomId: 'r1', homeId: 'h1' })
      ]);

      const response = await service.converse({ prompt: 'Crea una rutina llamada Buenas noches en Cuarto Master para apagar las luces a las 22:30', userId: 'routine-owner' }, 'es');

      expect(mockDraftService.createScheduledRoutineDraft).toHaveBeenCalledWith(
        'h1',
        'r1',
        'Buenas noches',
        { type: 'time', timeLocal: '22:30', timezone: 'America/Guayaquil' },
        [{ deviceId: 'light-1', command: { name: 'turn_off', params: {} } }],
        'draft:routine-owner:crea una rutina llamada buenas noches en cuarto master para apagar las luces a las 22:30:r1'
      );
      expect(response).toEqual(expect.objectContaining({
        type: 'clarification',
        message: expect.stringContaining('a las 22:30')
      }));
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('Scenario: Given an English routine at 10 PM When the room and action are valid Then uses 22:00 in the configured timezone', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-1', name: 'Bedroom Light', type: 'light', roomId: 'r1', homeId: 'h1' })
      ]);

      await service.converse({ prompt: 'Create a routine called Rest in Cuarto Master to turn off the lights at 10 PM', userId: 'routine-owner' }, 'en');

      expect(mockDraftService.createScheduledRoutineDraft).toHaveBeenCalledWith(
        'h1',
        'r1',
        'Rest',
        { type: 'time', timeLocal: '22:00', timezone: 'America/Guayaquil' },
        [{ deviceId: 'light-1', command: { name: 'turn_off', params: {} } }],
        'draft:routine-owner:create a routine called rest in cuarto master to turn off the lights at 10 pm:r1'
      );
    });

    it('Scenario: Given a daily Spanish routine When it is prepared Then keeps every weekday in the local rule and says so before confirmation', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-1', name: 'Luz Cuarto', type: 'light', roomId: 'r1', homeId: 'h1' })
      ]);

      const response = await service.converse({ prompt: 'Crea una rutina llamada Noche en Cuarto Master para apagar las luces todos los días a las 22:00', userId: 'daily-owner' }, 'es');

      expect(mockDraftService.createScheduledRoutineDraft).toHaveBeenCalledWith(
        'h1', 'r1', 'Noche',
        { type: 'time', timeLocal: '22:00', timezone: 'America/Guayaquil', days: [0, 1, 2, 3, 4, 5, 6] },
        [{ deviceId: 'light-1', command: { name: 'turn_off', params: {} } }],
        'draft:daily-owner:crea una rutina llamada noche en cuarto master para apagar las luces todos los dias a las 22:00:r1'
      );
      expect(response.message).toContain('todos los días');
    });

    it('Scenario: Given an English weekday routine When it is prepared Then limits its local rule to Monday through Friday and says so before confirmation', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-1', name: 'Bedroom Light', type: 'light', roomId: 'r1', homeId: 'h1' })
      ]);

      const response = await service.converse({ prompt: 'Create a routine called Workdays in Cuarto Master to turn off the lights at 10 PM on weekdays', userId: 'weekday-owner' }, 'en');

      expect(mockDraftService.createScheduledRoutineDraft).toHaveBeenCalledWith(
        'h1', 'r1', 'Workdays',
        { type: 'time', timeLocal: '22:00', timezone: 'America/Guayaquil', days: [1, 2, 3, 4, 5] },
        [{ deviceId: 'light-1', command: { name: 'turn_off', params: {} } }],
        'draft:weekday-owner:create a routine called workdays in cuarto master to turn off the lights at 10 pm on weekdays:r1'
      );
      expect(response.message).toContain('on weekdays');
    });
    it('Scenario: Given Spanish and English conditional routines When both device names are authorized Then prepares a confirmable automation draft without dispatching', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'source-light', name: 'Luz Sala', type: 'light', roomId: 'r1', homeId: 'h1' }),
        createTestDevice({ id: 'target-light', name: 'Luz Entrada', type: 'light', roomId: 'r1', homeId: 'h1' }),
        createTestDevice({ id: 'desk-lamp', name: 'Desk Lamp', type: 'light', roomId: 'r1', homeId: 'h1' }),
        createTestDevice({ id: 'hall-light', name: 'Hall Light', type: 'light', roomId: 'r1', homeId: 'h1' })
      ]);

      const spanish = await service.converse({ prompt: 'Cuando se encienda Luz Sala, apaga Luz Entrada', userId: 'conditional-es' }, 'es');
      expect(mockDraftService.createAutomationDraft).toHaveBeenLastCalledWith(
        'h1', 'Cuando Luz Sala se encienda, apagar Luz Entrada',
        { type: 'device_state_changed', deviceId: 'source-light', stateKey: 'state', expectedValue: 'on' },
        { type: 'device_command', targetDeviceId: 'target-light', command: 'turn_off' },
        'conditional:conditional-es:source-light:on:target-light:turn_off'
      );
      expect(spanish).toEqual(expect.objectContaining({ type: 'clarification' }));

      const english = await service.converse({ prompt: 'When Desk Lamp turns off, turn on Hall Light', userId: 'conditional-en' }, 'en');
      expect(mockDraftService.createAutomationDraft).toHaveBeenLastCalledWith(
        'h1', 'When Desk Lamp turns off, turn on Hall Light',
        { type: 'device_state_changed', deviceId: 'desk-lamp', stateKey: 'state', expectedValue: 'off' },
        { type: 'device_command', targetDeviceId: 'hall-light', command: 'turn_on' },
        'conditional:conditional-en:desk-lamp:off:hall-light:turn_on'
      );
      expect(english).toEqual(expect.objectContaining({ type: 'clarification' }));
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('Scenario: Given the same device as condition and target When a conditional routine is requested Then rejects the unsafe loop before creating a draft', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-1', name: 'Luz Sala', type: 'light', roomId: 'r1', homeId: 'h1' })
      ]);

      const response = await service.converse({ prompt: 'Cuando se encienda Luz Sala, apaga Luz Sala', userId: 'conditional-loop' }, 'es');

      expect(response).toEqual({ type: 'answer', message: 'El dispositivo disparador y el dispositivo objetivo deben ser distintos.' });
      expect(mockDraftService.createAutomationDraft).not.toHaveBeenCalled();
    });
    it('Scenario: Given a Spanish relative timer When the room and action are valid Then prepares a one-shot local routine before activation', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-25T15:00:00.000Z'));
      try {
        mockDeviceRepo.findAll.mockResolvedValue([
          createTestDevice({ id: 'light-1', name: 'Luz Sala', type: 'light', roomId: 'r1', homeId: 'h1' })
        ]);

        const response = await service.converse({ prompt: 'Apaga las luces de Cuarto Master en 30 minutos', userId: 'timer-owner' }, 'es');

        expect(mockDraftService.createScheduledRoutineDraft).toHaveBeenCalledWith(
          'h1', 'r1', 'Temporizador apagar Cuarto Master',
          { type: 'time', timeLocal: '10:30', timezone: 'America/Guayaquil', dateLocal: '2026-08-25' },
          [{ deviceId: 'light-1', command: { name: 'turn_off', params: {} } }],
          'timer:timer-owner:apaga las luces de cuarto master en 30 minutos:r1'
        );
        expect(response).toEqual(expect.objectContaining({ type: 'clarification', message: expect.stringContaining('en 30 minutos') }));
        expect(response.message).toContain('una sola vez');
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });

    it('Scenario: Given an English relative timer When the room and action are valid Then prepares it in English before activation', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-25T15:00:00.000Z'));
      try {
        mockDeviceRepo.findAll.mockResolvedValue([
          createTestDevice({ id: 'light-1', name: 'Bedroom Light', type: 'light', roomId: 'r1', homeId: 'h1' })
        ]);

        const response = await service.converse({ prompt: 'Turn off the Cuarto Master lights in 1 hour', userId: 'timer-owner-en' }, 'en');

        expect(mockDraftService.createScheduledRoutineDraft).toHaveBeenCalledWith(
          'h1', 'r1', 'Turn off Cuarto Master timer',
          { type: 'time', timeLocal: '11:00', timezone: 'America/Guayaquil', dateLocal: '2026-08-25' },
          [{ deviceId: 'light-1', command: { name: 'turn_off', params: {} } }],
          'timer:timer-owner-en:turn off the cuarto master lights in 1 hour:r1'
        );
        expect(response.message).toContain('in 1 hour');
        expect(response.message).toContain('run once');
      } finally {
        jest.useRealTimers();
      }
    });
    it('Scenario: Given natural Spanish and English timer delays When the room and action are valid Then prepares the equivalent local one-shot timers', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-25T15:00:00.000Z'));
      try {
        mockDeviceRepo.findAll.mockResolvedValue([
          createTestDevice({ id: 'light-1', name: 'Luz Sala', type: 'light', roomId: 'r1', homeId: 'h1' })
        ]);

        await service.converse({ prompt: 'Apaga las luces de Cuarto Master en media hora', userId: 'timer-natural-es' }, 'es');
        expect(mockDraftService.createScheduledRoutineDraft).toHaveBeenLastCalledWith(
          'h1', 'r1', 'Temporizador apagar Cuarto Master',
          { type: 'time', timeLocal: '10:30', timezone: 'America/Guayaquil', dateLocal: '2026-08-25' },
          [{ deviceId: 'light-1', command: { name: 'turn_off', params: {} } }],
          'timer:timer-natural-es:apaga las luces de cuarto master en media hora:r1'
        );

        await service.converse({ prompt: 'Turn off the Cuarto Master lights in an hour', userId: 'timer-natural-en' }, 'en');
        expect(mockDraftService.createScheduledRoutineDraft).toHaveBeenLastCalledWith(
          'h1', 'r1', 'Turn off Cuarto Master timer',
          { type: 'time', timeLocal: '11:00', timezone: 'America/Guayaquil', dateLocal: '2026-08-25' },
          [{ deviceId: 'light-1', command: { name: 'turn_off', params: {} } }],
          'timer:timer-natural-en:turn off the cuarto master lights in an hour:r1'
        );
      } finally {
        jest.useRealTimers();
      }
    });
    it('Scenario: Given a single authorized device name When a relative timer is requested Then prepares a one-shot rule for only that device in both languages', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-25T15:00:00.000Z'));
      try {
        mockDeviceRepo.findAll.mockResolvedValue([
          createTestDevice({ id: 'tv-1', name: 'TV Smart', type: 'media_player', roomId: 'r1', homeId: 'h1', capabilities: [{ type: 'media_player', name: 'Media player' }] }),
          createTestDevice({ id: 'lamp-1', name: 'Desk Lamp', type: 'light', roomId: 'r1', homeId: 'h1' })
        ]);

        await service.converse({ prompt: 'Apaga la TV Smart en una hora', userId: 'timer-device-es' }, 'es');
        expect(mockDraftService.createScheduledRoutineDraft).toHaveBeenLastCalledWith(
          'h1', 'r1', 'Temporizador apagar TV Smart',
          { type: 'time', timeLocal: '11:00', timezone: 'America/Guayaquil', dateLocal: '2026-08-25' },
          [{ deviceId: 'tv-1', command: { name: 'turn_off', params: {} } }],
          'timer:timer-device-es:apaga la tv smart en una hora:r1'
        );

        await service.converse({ prompt: 'Turn off the Desk Lamp in 30 minutes', userId: 'timer-device-en' }, 'en');
        expect(mockDraftService.createScheduledRoutineDraft).toHaveBeenLastCalledWith(
          'h1', 'r1', 'Turn off Desk Lamp timer',
          { type: 'time', timeLocal: '10:30', timezone: 'America/Guayaquil', dateLocal: '2026-08-25' },
          [{ deviceId: 'lamp-1', command: { name: 'turn_off', params: {} } }],
          'timer:timer-device-en:turn off the desk lamp in 30 minutes:r1'
        );
      } finally {
        jest.useRealTimers();
      }
    });
    it('Scenario: Given pending, cancelled, expired and recurring rules When timers are requested in Spanish Then lists only pending one-shot timers with their remaining time', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-25T15:00:00.000Z'));
      try {
        mockAutomationRepo.findAll.mockResolvedValue([
          {
            id: 'pending-timer', homeId: 'h1', userId: 'timer-owner', name: 'Temporizador apagar Sala', enabled: true,
            trigger: { type: 'time', timeLocal: '10:30', timeUTC: '15:30', timezone: 'America/Guayaquil', dateLocal: '2026-08-25' },
            action: { type: 'execute_scene', sceneId: 'scene-1' }
          },
          {
            id: 'cancelled-timer', homeId: 'h1', userId: 'timer-owner', name: 'Temporizador cancelado', enabled: false,
            trigger: { type: 'time', timeLocal: '10:45', timeUTC: '15:45', timezone: 'America/Guayaquil', dateLocal: '2026-08-25' },
            action: { type: 'execute_scene', sceneId: 'scene-2' }
          },
          {
            id: 'expired-timer', homeId: 'h1', userId: 'timer-owner', name: 'Temporizador vencido', enabled: true,
            trigger: { type: 'time', timeLocal: '09:45', timeUTC: '14:45', timezone: 'America/Guayaquil', dateLocal: '2026-08-25' },
            action: { type: 'execute_scene', sceneId: 'scene-3' }
          },
          {
            id: 'daily-routine', homeId: 'h1', userId: 'timer-owner', name: 'Rutina diaria', enabled: true,
            trigger: { type: 'time', timeLocal: '22:00', timeUTC: '03:00', timezone: 'America/Guayaquil', days: [0, 1, 2, 3, 4, 5, 6] },
            action: { type: 'execute_scene', sceneId: 'scene-4' }
          }
        ]);

        const response = await service.converse({ prompt: '¿Qué temporizadores tengo?', userId: 'timer-owner' }, 'es');

        expect(response).toEqual(expect.objectContaining({ type: 'answer', message: expect.stringContaining('Temporizador apagar Sala') }));
        expect(response.message).toContain('faltan 30 minutos');
        expect(response.message).not.toContain('Temporizador cancelado');
        expect(response.message).not.toContain('Temporizador vencido');
        expect(response.message).not.toContain('Rutina diaria');
      } finally {
        jest.useRealTimers();
      }
    });

    it('Scenario: Given a pending Spanish timer When its delay is changed and confirmed Then updates only its local schedule', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-25T15:00:00.000Z'));
      try {
        const timer = {
          id: 'pending-timer', homeId: 'h1', userId: 'timer-reschedule', name: 'Temporizador apagar Sala', enabled: true,
          trigger: { type: 'time' as const, timeLocal: '10:30', timeUTC: '15:30', timezone: 'America/Guayaquil', dateLocal: '2026-08-25' },
          action: { type: 'execute_scene' as const, sceneId: 'scene-1' }
        };
        mockAutomationRepo.findAll.mockResolvedValue([timer]);

        const clarification = await service.converse({ prompt: 'Cambia el temporizador Temporizador apagar Sala a 45 minutos', userId: 'timer-reschedule' }, 'es');

        expect(clarification).toEqual(expect.objectContaining({ type: 'clarification', message: expect.stringContaining('10:45') }));
        const pendingMemory = mockMemory.saveShortTermMemory.mock.calls.find(([savedUserId]) => savedUserId === 'timer-reschedule')?.[1];
        expect(pendingMemory?.pendingManagementAction).toEqual(expect.objectContaining({
          type: 'reschedule_timer', targetId: 'pending-timer', payload: expect.objectContaining({ dateLocal: '2026-08-25', timeLocal: '10:45', timeUTC: '15:45' })
        }));

        mockMemory.getShortTermMemory.mockResolvedValue(pendingMemory ?? null);
        const completed = await service.converse({ prompt: 'sí', userId: 'timer-reschedule' }, 'es');

        expect(mockAutomationRepo.save).toHaveBeenCalledWith(expect.objectContaining({
          id: 'pending-timer', enabled: true,
          trigger: expect.objectContaining({ dateLocal: '2026-08-25', timeLocal: '10:45', timeUTC: '15:45', timezone: 'America/Guayaquil' })
        }));
        expect(completed).toEqual({ type: 'answer', message: 'Temporizador "Temporizador apagar Sala" reprogramado para las 10:45.' });
      } finally {
        jest.useRealTimers();
      }
    });

    it('Scenario: Given a pending English timer When it is rescheduled Then it asks for confirmation before updating it', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-25T15:00:00.000Z'));
      try {
        mockAutomationRepo.findAll.mockResolvedValue([{
          id: 'desk-timer', homeId: 'h1', userId: 'timer-reschedule-en', name: 'Turn off Desk Lamp', enabled: true,
          trigger: { type: 'time', timeLocal: '10:30', timeUTC: '15:30', timezone: 'America/Guayaquil', dateLocal: '2026-08-25' },
          action: { type: 'execute_scene', sceneId: 'scene-1' }
        }]);

        const response = await service.converse({ prompt: 'Reschedule Turn off Desk Lamp timer to 1 hour', userId: 'timer-reschedule-en' }, 'en');

        expect(response).toEqual(expect.objectContaining({ type: 'clarification', message: expect.stringContaining('11:00') }));
        expect(mockAutomationRepo.save).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });
    it('Scenario: Given no pending one-shot timers When timers are requested in English Then explains that none are active', async () => {
      const response = await service.converse({ prompt: 'What timers do I have?', userId: 'timer-owner-en' }, 'en');

      expect(response).toEqual({ type: 'answer', message: "You don't have any active timers." });
    });
    it('Scenario: Given incomplete named requests When an action or routine time is missing Then asks for the missing safety-critical detail', async () => {
      const sceneResponse = await service.converse({ prompt: 'Crea una escena llamada Cine en Cuarto Master', userId: 'draft-owner' }, 'es');
      const routineResponse = await service.converse({ prompt: 'Crea una rutina llamada Noche en Cuarto Master para apagar las luces', userId: 'draft-owner' }, 'es');

      expect(sceneResponse).toEqual(expect.objectContaining({ type: 'answer', message: expect.stringContaining('qué debe hacer') }));
      expect(routineResponse).toEqual(expect.objectContaining({ type: 'answer', message: expect.stringContaining('hora local') }));
      expect(mockDraftService.createSceneDraft).not.toHaveBeenCalled();
      expect(mockDraftService.createAutomationDraft).not.toHaveBeenCalled();
    });
  });
  describe('Feature: draft creation boundaries', () => {
    it('Scenario: Given a known room without assigned devices When a draft is requested Then explains that no draft can be made', async () => {
      const internals = service as unknown as {
        handleDraftCreation(prompt: string, language: string, userId: string): Promise<{ type: string; message: string }>;
      };
      mockDeviceRepo.findAll.mockResolvedValue([]);
      mockRoomRepo.findAll.mockResolvedValue([createTestRoom({ id: 'r1', name: 'Cuarto Master', homeId: 'h1' })]);

      await expect(internals.handleDraftCreation('crea una escena en cuarto master', 'es', 'draft-user')).resolves.toEqual({
        type: 'answer',
        message: 'Encontré la estancia "Cuarto Master", pero ningún dispositivo está asignado a ella.'
      });
      expect(mockDraftService.createSceneDraft).not.toHaveBeenCalled();
    });

    it('Scenario: Given a known room with only non-controllable devices When a routine draft is requested Then preserves device safety', async () => {
      const internals = service as unknown as {
        handleDraftCreation(prompt: string, language: string, userId: string): Promise<{ type: string; message: string }>;
      };
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'temperature-1', name: 'Temperatura', type: 'sensor', roomId: 'r1', homeId: 'h1' }),
      ]);
      mockRoomRepo.findAll.mockResolvedValue([createTestRoom({ id: 'r1', name: 'Cuarto Master', homeId: 'h1' })]);

      await expect(internals.handleDraftCreation('crea una rutina para apagar cuarto master', 'es', 'draft-user')).resolves.toEqual({
        type: 'answer',
        message: 'Encontré dispositivos en "Cuarto Master", pero ninguno es controlable (luces, interruptores o enchufes).'
      });
      expect(mockDraftService.createAutomationDraft).not.toHaveBeenCalled();
    });
  });
  describe('Feature: point state queries', () => {
    it('Scenario: Given a room with a mixed device state When its state is queried Then reports the exact active count', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-on', name: 'Luz Escritorio', type: 'light', roomId: 'r1', lastKnownState: { state: 'on' } }),
        createTestDevice({ id: 'light-off', name: 'Luz Cama', type: 'light', roomId: 'r1', lastKnownState: { state: 'off' } })
      ]);

      const response = await service.converse({ prompt: 'cuarto master esta encendido', userId: 'state-user' }, 'es');

      expect(response).toEqual(expect.objectContaining({
        type: 'answer',
        message: 'Hay 1 de 2 dispositivos encendidos en Cuarto Master.'
      }));
    });

    it.each([
      [{ state: 'on' }, 'luz escritorio esta encendida', 'Sí, Luz Escritorio está encendido.'],
      [{ state: 'off' }, 'luz escritorio esta apagada', 'Sí, Luz Escritorio está apagado.']
    ])('Scenario: Given a named device When its requested state is queried Then answers from its current state', async (lastKnownState, prompt, message) => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-1', name: 'Luz Escritorio', type: 'light', roomId: 'r1', lastKnownState })
      ]);

      const response = await service.converse({ prompt, userId: 'state-user' }, 'es');

      expect(response).toEqual({ type: 'answer', message });
    });

    it('Scenario: Given several equally named devices When their state is queried Then asks for an explicit selection', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-1', name: 'Luz Sala', type: 'light', roomId: 'r1' }),
        createTestDevice({ id: 'light-2', name: 'Luz Sala', type: 'light', roomId: 'r2' })
      ]);

      const response = await service.converse({ prompt: 'luz sala esta encendida', userId: 'state-user' }, 'es');

      expect(response).toEqual(expect.objectContaining({
        type: 'clarification',
        clarification: expect.objectContaining({ options: expect.arrayContaining([expect.objectContaining({ id: 'light-1' })]) })
      }));
    });
  });
  describe('Feature: point state query branches', () => {
    it('Scenario: Given an explicit point-state query When no device or room matches Then returns a safe not-found answer', async () => {
      const internals = service as unknown as {
        isPointStateQuery(prompt: string): boolean;
        handlePointStateQuery(prompt: string, language: string, userId: string): Promise<{ type: string; message: string }>;
      };
      mockDeviceRepo.findAll.mockResolvedValue([]);
      mockRoomRepo.findAll.mockResolvedValue([]);

      expect(internals.isPointStateQuery('luz inexistente esta encendida')).toBe(true);
      await expect(internals.handlePointStateQuery('luz inexistente esta encendida', 'es', 'state-user')).resolves.toEqual({
        type: 'answer',
        message: 'No pude encontrar el dispositivo por el que preguntas.'
      });
    });

    it.each([
      ['off', 'Todo está apagado en Cuarto Master.'],
      ['on', 'Todo está encendido en Cuarto Master.']
    ])('Scenario: Given a room with devices all %s When its state is queried Then reports the aggregate state', async (state, expectedMessage) => {
      const internals = service as unknown as {
        handlePointStateQuery(prompt: string, language: string, userId: string): Promise<{ type: string; message: string }>;
      };
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-1', name: 'Luz Uno', type: 'light', roomId: 'r1', lastKnownState: { state } }),
        createTestDevice({ id: 'light-2', name: 'Luz Dos', type: 'light', roomId: 'r1', lastKnownState: { state } })
      ]);

      await expect(internals.handlePointStateQuery('cuarto master esta encendido', 'es', 'state-user')).resolves.toEqual({
        type: 'answer',
        message: expectedMessage
      });
    });
  });
  describe('Feature: safe draft creation degradation', () => {
    it('Scenario: Given an unknown room When a draft is requested Then does not create or execute anything', async () => {
      mockRoomRepo.findAll.mockResolvedValue([]);
      mockDeviceRepo.findAll.mockResolvedValue([createTestDevice({ id: 'light-1', roomId: 'r1', type: 'light' })]);

      const response = await service.converse({ prompt: 'crea una escena para apagar patio', userId: 'draft-user' }, 'es');

      expect(response).toEqual({
        type: 'answer',
        message: 'No encontré la estancia especificada. Puedes preguntarme "qué estancias conoces".'
      });
      expect(mockDraftService.createSceneDraft).not.toHaveBeenCalled();
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('Scenario: Given a room with no assigned devices When a draft is requested Then reports it without creating a draft', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([]);

      const response = await service.converse({ prompt: 'crea una escena para apagar cuarto master', userId: 'draft-user' }, 'es');

      expect(response).toEqual({
        type: 'answer',
        message: 'Encontré la estancia "Cuarto Master", pero ningún dispositivo está asignado a ella.'
      });
      expect(mockDraftService.createSceneDraft).not.toHaveBeenCalled();
    });

    it('Scenario: Given a room with sensors only When a draft is requested Then does not include uncontrollable devices', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'sensor-1', name: 'Sensor Cuarto', type: 'sensor', roomId: 'r1' })
      ]);

      const response = await service.converse({ prompt: 'crea una rutina para apagar cuarto master', userId: 'draft-user' }, 'es');

      expect(response).toEqual({
        type: 'answer',
        message: 'Encontré dispositivos en "Cuarto Master", pero ninguno es controlable (luces, interruptores o enchufes).'
      });
      expect(mockDraftService.createAutomationDraft).not.toHaveBeenCalled();
    });
  });
  describe('Feature: draft creation failure boundaries', () => {
    it('Scenario: Given a resolved room and devices without a home When a draft is requested Then reports that the home cannot be determined', async () => {
      mockRoomRepo.findAll.mockResolvedValue([
        createTestRoom({ id: 'room-without-home', name: 'Cuarto Master', homeId: '' })
      ]);
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'device-without-home', name: 'Luz Cuarto', type: 'light', roomId: 'room-without-home', homeId: '' })
      ]);

      const response = await service.converse({ prompt: 'crea una escena para apagar cuarto master', userId: 'draft-user' }, 'es');

      expect(response).toEqual({
        type: 'answer',
        message: 'No pude determinar el hogar para crear el borrador.'
      });
      expect(mockDraftService.createSceneDraft).not.toHaveBeenCalled();
      expect(mockMemory.saveShortTermMemory).not.toHaveBeenCalled();
    });

    it('Scenario: Given a draft persistence failure When a scene draft is requested Then returns the safe failure message without dispatching', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-1', name: 'Luz Cuarto', type: 'light', roomId: 'r1', homeId: 'h1' })
      ]);
      mockDraftService.createSceneDraft.mockRejectedValue(new Error('database unavailable'));
      const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      const response = await service.converse({ prompt: 'crea una escena para apagar cuarto master', userId: 'draft-user' }, 'es');

      expect(response).toEqual({
        type: 'answer',
        message: 'No pude preparar el borrador de escena. Revisa que existan dispositivos en esa estancia.'
      });
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
      expect(mockMemory.saveShortTermMemory).not.toHaveBeenCalled();
      warning.mockRestore();
    });
  });
  describe('Feature: detailed state answers', () => {
    it('Scenario: Given active and inactive devices When global status is requested Then returns the compact status and stores the detail context', async () => {
      const internals = service as unknown as {
        handleStateQuery(prompt: string, language: string, userName: string | null, userId: string): Promise<{ type: string; message: string }>;
      };
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-on', name: 'Luz Sala', type: 'light', roomId: 'r1', lastKnownState: { on: true } }),
        createTestDevice({ id: 'light-off', name: 'Luz Patio', type: 'light', roomId: 'r1', lastKnownState: { on: false } })
      ]);

      const response = await internals.handleStateQuery('estado', 'es', 'Oscar', 'state-user');

      expect(response).toEqual(expect.objectContaining({
        type: 'answer',
        message: expect.stringContaining('Oscar, Estado de la casa:')
      }));
      expect(response.message).toContain('Encendidas: 1');
      expect(response.message).toContain('Apagadas: 1');
      expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('state-user', expect.objectContaining({
        lastQueryType: 'state_devices',
        entities: expect.arrayContaining([expect.objectContaining({ id: 'light-on', roomName: 'Cuarto Master' })])
      }));
    });

    it('Scenario: Given an unknown room in a state request When the user asks for its lights Then returns a bounded answer instead of broadening the scope', async () => {
      const internals = service as unknown as {
        handleStateQuery(prompt: string, language: string, userName: string | null, userId: string): Promise<{ type: string; message: string }>;
      };
      mockDeviceRepo.findAll.mockResolvedValue([createTestDevice({ id: 'light-1', type: 'light', roomId: 'r1' })]);

      await expect(internals.handleStateQuery('que luces estan encendidas en garaje', 'es', null, 'state-user')).resolves.toEqual({
        type: 'answer',
        message: 'No encontré esa estancia.'
      });
    });

    it('Scenario: Given a roomless light request When no room is named Then asks the user to choose a room', async () => {
      const internals = service as unknown as {
        handleStateQuery(prompt: string, language: string, userName: string | null, userId: string): Promise<{ type: string; message: string }>;
      };
      mockDeviceRepo.findAll.mockResolvedValue([createTestDevice({ id: 'light-1', type: 'light', roomId: 'r1' })]);

      const response = await internals.handleStateQuery('dime la luz encendida', 'es', null, 'state-user');

      expect(response).toEqual(expect.objectContaining({ type: 'clarification', message: '¿En qué estancia?' }));
      expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('state-user', expect.objectContaining({
        lastQueryType: 'clarification'
      }));
    });
  });
    it('Scenario: Given known device states When the user asks for devices on and off Then returns both lists', async () => {
      const internals = service as unknown as {
        handleStateQuery(prompt: string, language: string, userName: string | null, userId: string): Promise<{ type: string; message: string }>;
      };
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-on', name: 'Luz Sala', type: 'light', roomId: 'r1', lastKnownState: { on: true } }),
        createTestDevice({ id: 'light-off', name: 'Luz Patio', type: 'light', roomId: 'r1', lastKnownState: { on: false } })
      ]);

      const response = await internals.handleStateQuery('dime qué dispositivos están encendidos y apagados', 'es', null, 'state-user');

      expect(response.message).toContain('Encendidas:');
      expect(response.message).toContain('Luz Sala (Cuarto Master)');
      expect(response.message).toContain('Apagadas:');
      expect(response.message).toContain('Luz Patio (Cuarto Master)');
    });

    it('Scenario: Given no matching lights are on When the user asks their state Then reports the empty state', async () => {
      const internals = service as unknown as {
        handleStateQuery(prompt: string, language: string, userName: string | null, userId: string): Promise<{ type: string; message: string }>;
      };
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-off', name: 'Luz Patio', type: 'light', roomId: 'r1', lastKnownState: { on: false } })
      ]);

      const response = await internals.handleStateQuery('qué luces están encendidas', 'es', null, 'state-user');

      expect(response).toEqual({ type: 'answer', message: 'No hay luces encendidas en este momento.' });
    });

    it('Scenario: Given a remembered device When the user asks where it is Then uses the cached room name', async () => {
      const internals = service as unknown as {
        handleStateQuery(prompt: string, language: string, userName: string | null, userId: string, entities: Array<{ id: string; name: string; type: string; roomName?: string }>): Promise<{ type: string; message: string }>;
      };
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-on', name: 'Luz Sala', type: 'light', roomId: 'r1', lastKnownState: { on: true } })
      ]);

      await expect(internals.handleStateQuery('dónde está', 'es', null, 'state-user', [
        { id: 'light-on', name: 'Luz Sala', type: 'light', roomName: 'Sala guardada' }
      ])).resolves.toEqual({ type: 'answer', message: 'Luz Sala (Sala guardada)' });
    });
  describe('Greetings', () => {
    it('should respond to "Hola" with a friendly answer in Spanish', async () => {
      const response = await service.converse({ prompt: 'Hola' }, 'es');

      expect(response.type).toBe('answer');
      expect(response.message).toContain('La casa está atenta');
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should respond to "hello" with a friendly answer in English', async () => {
      const response = await service.converse({ prompt: 'hello' }, 'en');

      expect(response.type).toBe('answer');
      expect(response.message).toContain('residence is standing by');
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should respond to "buenas noches" correctly', async () => {
      const response = await service.converse({ prompt: 'buenas noches' }, 'es');
      expect(response.type).toBe('answer');
    });

    it('should respond to "hey" correctly in English', async () => {
      const response = await service.converse({ prompt: 'hey' }, 'en');
      expect(response.type).toBe('answer');
    });

    it('should respond to "quien te creo" mentioning NEZU S.A.S.', async () => {
      const response = await service.converse({ prompt: 'quien te creo' }, 'es');
      expect(response.type).toBe('answer');
      expect(response.message).toContain('NEZU S.A.S.');
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should respond to "who created you" in English mentioning NEZU S.A.S.', async () => {
      const response = await service.converse({ prompt: 'who created you' }, 'en');
      expect(response.type).toBe('answer');
      expect(response.message).toContain('NEZU S.A.S.');
    });

    it('should not trigger for words containing greetings (e.g. "holas" or "hellooo")', async () => {
      mockInterpreter.interpret.mockResolvedValue({ type: 'unknown', prompt: 'holas', reason: 'not_found' });
      const response = await service.converse({ prompt: 'holas' }, 'es');
      expect(response.type).toBe('answer'); // Now returns user-friendly fallback instead of error
      expect(response.message).toContain('Friendly fallback');
    });

    it('should respond to "gracias" correctly', async () => {
      const response = await service.converse({ prompt: 'gracias' }, 'es');
      expect(response.type).toBe('answer');
    });
  });

  describe('Presentation and Name', () => {
    it('should respond to "quién eres" with a professional introduction', async () => {
      const response = await service.converse({ prompt: 'quién eres' }, 'es');

      expect(response.type).toBe('answer');
      expect(response.message).toContain('Soy HomePilot');
      expect(response.message).toContain('Límites:');
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should respond to "Cómo te llamas?" correctly', async () => {
      const response = await service.converse({ prompt: 'Cómo te llamas?' }, 'es');
      expect(response.type).toBe('answer');
      expect(response.message).toContain('Soy HomePilot');
    });

    it('should respond to "what is your name" in English', async () => {
      const response = await service.converse({ prompt: 'what is your name' }, 'en');
      expect(response.type).toBe('answer');
      expect(response.message).toContain('I am HomePilot');
    });

    it('should respond to "qué puedes hacer" correctly', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'dev-light', name: 'Luz Escritorio', type: 'light', lastKnownState: { on: false } })
      ]);
      mockSceneRepo.findAll.mockResolvedValue([
        { id: 'scene-1', homeId: 'h1', roomId: 'r1', name: 'Cine', actions: [], executionMode: 'parallel', createdAt: '', updatedAt: '' }
      ]);
      mockMemory.getAliases.mockResolvedValue({ 'mi cuarto': 'r1' });

      const response = await service.converse({ prompt: 'qué puedes hacer' }, 'es');

      expect(response.type).toBe('answer');
      expect(response.message).toContain('Puedes pedirme:');
      expect(response.message).toContain('Contexto actual de HomePilot:');
      expect(response.message).toContain('1 dispositivos controlables');
      expect(response.message).toContain('escenas: Cine');
      expect(response.message).toContain('aliases: mi cuarto');
    });

    it('should answer capabilities when the wake word reaches the backend', async () => {
      const response = await service.converse({ prompt: 'Ok Nezu qué puedes hacer' }, 'es');

      expect(response.type).toBe('answer');
      expect(response.message).toContain('Puedes pedirme:');
      expect(response.message).toContain('Estado general');
      expect(response.message).not.toContain('No estoy seguro');
    });

    it('should answer natural capability variations', async () => {
      const prompts = [
        'qué te puedo pedir',
        'qué comandos entiendes',
        'cómo me ayudas con la casa',
        'qué puedes controlar'
      ];

      for (const prompt of prompts) {
        const response = await service.converse({ prompt }, 'es');
        expect(response.type).toBe('answer');
        expect(response.message).toContain('Puedes pedirme:');
        expect(response.message).not.toContain('No estoy seguro');
      }
    });

    it('should respond to "what can you do" in English', async () => {
      const response = await service.converse({ prompt: 'what can you do' }, 'en');

      expect(response.type).toBe('answer');
      expect(response.message).toContain('You can ask me:');
      expect(response.message).toContain('Limits:');
      expect(response.message).toContain('Current HomePilot context:');
    });

    it('should explain backend scope when asked if it can answer anything', async () => {
      const response = await service.converse({ prompt: 'puedo preguntarte cualquier cosa' }, 'es');

      expect(response.type).toBe('answer');
      expect(response.message).toContain('No soy un buscador general');
      expect(response.message).toContain('Solo puedo operar dispositivos');
    });

    it('should explain limits in English', async () => {
      const response = await service.converse({ prompt: 'what are your limits' }, 'en');

      expect(response.type).toBe('answer');
      expect(response.message).toContain('not a general search assistant');
      expect(response.message).toContain('I can only operate devices');
    });
  });

  describe('Date and Time', () => {
    it('should respond to "qué hora es" with current time', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-06-17T14:45:00.000Z'));
      const response = await service.converse({ prompt: 'qué hora es' }, 'es');

      expect(response.type).toBe('answer');
      expect(response.message).toContain('Son las nueve y cuarenta y cinco de la mañana');
      expect(response.message).toContain('La casa permanece atenta');
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should respond to "qué fecha es hoy" with current date', async () => {
      const response = await service.converse({ prompt: 'qué fecha es hoy' }, 'es');

      expect(response.type).toBe('answer');
      expect(response.message).toContain('Hoy es');
    });

    it('should respond to "what time is it" in English', async () => {
      const response = await service.converse({ prompt: 'what time is it' }, 'en');

      expect(response.type).toBe('answer');
      expect(response.message).toMatch(/It is \d{2}:\d{2}/);
    });

    it('should answer natural day and day-period questions', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-06-17T14:45:00.000Z'));

      const day = await service.converse({ prompt: 'Ok Nezu, qué día es hoy' }, 'es');
      const morning = await service.converse({ prompt: 'Ok Nezu, estamos en la mañana' }, 'es');
      const night = await service.converse({ prompt: 'Ok Nezu, ya es de noche' }, 'es');

      expect(day.message).toContain('Hoy es miércoles, 17 de junio de 2026');
      expect(morning.message).toContain('Sí. Es de mañana');
      expect(night.message).toContain('No. En este momento es de mañana');
    });
  });

  describe('Supported residential conversation matrix', () => {
    it('keeps at least 100 unique supported prompts', () => {
      expect(SUPPORTED_HOME_CONVERSATION_PROMPTS).toHaveLength(100);
      expect(new Set(SUPPORTED_HOME_CONVERSATION_PROMPTS).size).toBe(100);
    });

    it.each(SUPPORTED_HOME_CONVERSATION_PROMPTS)('returns a usable answer for "%s"', async prompt => {
      const response = await service.converse({ prompt }, 'es');

      expect(response.message.trim().length).toBeGreaterThan(0);
      expect(response.message).not.toContain('No estoy seguro de lo que quieres hacer');
      expect(response.message).not.toBe('Friendly fallback');
    });
  });

  describe('State Queries', () => {
    it('should handle "qué está encendido" query with bulleted list', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: '1', name: 'Luz Sala', lastKnownState: { on: true } }),
        createTestDevice({ id: '2', name: 'Luz Cocina', lastKnownState: { on: true } }),
        createTestDevice({ id: '3', name: 'Ventilador', lastKnownState: { on: false } })
      ]);

      const response = await service.converse({ prompt: 'qué está encendido' }, 'es');

      expect(response.type).toBe('answer');
      expect(response.message).toContain('Tienes 2 dispositivos encendidas:');
      expect(response.message).toContain('• Luz Sala');
      expect(response.message).toContain('• Luz Cocina');
    });

    it('should handle "Que luces estan encendidas?" correctly filtering by type', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: '1', name: 'Luz Sala', type: 'light', lastKnownState: { on: true } }),
        createTestDevice({ id: '2', name: 'Enchufe', type: 'switch', lastKnownState: { on: true } })
      ]);

      const response = await service.converse({ prompt: 'Que luces estan encendidas?' }, 'es');
      expect(response.type).toBe('answer');
      expect(response.message).toContain('Tienes 1 luces encendidas');
      expect(response.message).toContain('• Luz Sala');
      expect(response.message).not.toContain('• Enchufe');
    });

    it('should handle compound "on and off" queries', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: '1', name: 'Luz Sala', lastKnownState: { on: true } }),
        createTestDevice({ id: '2', name: 'Luz Cocina', lastKnownState: { on: false } })
      ]);

      const response = await service.converse({ prompt: 'que luces estan encendidas y cuales apagadas' }, 'es');
      expect(response.type).toBe('answer');
      expect(response.message).toContain('Encendidas:\n• Luz Sala');
      expect(response.message).toContain('Apagadas:\n• Luz Cocina');
      expect(response.message).toContain('estado de la casa:');
    });

    it('should filter by room name if found in repository', async () => {
      const room1Id = 'r1';
      mockRoomRepo.findAll.mockResolvedValue([
        createTestRoom({ id: room1Id, name: 'Cuarto Master', homeId: 'h1' })
      ]);
      mockRoomRepo.findRoomsByHomeId.mockResolvedValue([
        createTestRoom({ id: room1Id, name: 'Cuarto Master', homeId: 'h1' })
      ]);
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: '1', name: 'Luz Master', roomId: room1Id, lastKnownState: { on: true } }),
        createTestDevice({ id: '2', name: 'Luz Sala', roomId: 'other', lastKnownState: { on: true } })
      ]);

      const response = await service.converse({ prompt: 'que luces estan encendidas en cuarto master' }, 'es');
      expect(response.type).toBe('answer');
      expect(response.message).toContain('Cuarto Master');
      expect(response.message).toContain('• Luz Master');
      expect(response.message).not.toContain('• Luz Sala');
    });

    it('should return amigable message if room token is found but no room exists', async () => {
      mockRoomRepo.findRoomsByHomeId.mockResolvedValue([]);
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: '1', name: 'Luz Cocina', lastKnownState: { on: true } }),
        createTestDevice({ id: '2', name: 'Luz Sala', lastKnownState: { on: true } }),
      ]);

      const response = await service.converse({ prompt: 'que luces estan encendidas en la cocina' }, 'es');
      expect(response.type).toBe('answer');
      expect(response.message).toBe('No encontré esa estancia.');
    });

    it('should return amigable message if no devices in room', async () => {
       mockRoomRepo.findAll.mockResolvedValue([
        createTestRoom({ id: 'r1', name: 'Baño', homeId: 'h1' })
      ]);
      mockDeviceRepo.findAll.mockResolvedValue([]);

      const response = await service.converse({ prompt: 'que hay encendido en el baño' }, 'es');
      expect(response.type).toBe('answer');
      expect(response.message).toContain('No encontré dispositivos en Baño');
    });

    it('should not trigger dispatcher or scene execution for status queries', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: '1', name: 'Luz Sala', lastKnownState: { on: true } })
      ]);

      await service.converse({ prompt: 'que esta encendido' }, 'es');
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('User Friendly Small Talk and Unknowns', () => {
    it('should correctly handle wellness queries with typos', async () => {
      const typoPrompts = ["comoe stas", "como stas", "q tal", "how are u"];

      for (const prompt of typoPrompts) {
        const response = await service.converse({ prompt, userName: 'User' }, 'es');
        expect(response.type).toBe('answer');
        expect(response.message).toContain('Operando con normalidad');
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
        expect(mockExecutionRepo.save).not.toHaveBeenCalled();
      }
    });

    it('should route non-control questions directly to SmallTalkService without IntentInterpreter', async () => {
      mockSmallTalk.handle.mockResolvedValue({
        type: 'answer',
        message: 'Tu casa es muy interesante.'
      });

      const prompts = [
        "dime algo divertido de mi casa",
        "qué opinas de la automatización",
        "cuéntame algo divertido"
      ];

      for (const prompt of prompts) {
        jest.clearAllMocks();
        const response = await service.converse({ prompt, userName: 'User' }, 'es');
        expect(response.type).toBe('answer');
        expect(mockSmallTalk.handle).toHaveBeenCalledWith(prompt, 'es', 'User', 'system');
        expect(mockInterpreter.interpret).not.toHaveBeenCalled();
      }
    });

    it('returns a factual domestic insight without invoking small talk or execution', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([createTestDevice({ id: 'light-1', name: 'Luz Sala', lastKnownState: { on: true } })]);

      const response = await service.converse({ prompt: 'Dime algo interesante sobre mi casa', userId: 'user-1' }, 'es');

      expect(response.message).toContain('Tu casa tiene actualmente');
      expect(mockSmallTalk.handle).not.toHaveBeenCalled();
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
      expect(mockInterpreter.interpret).not.toHaveBeenCalled();
      expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('user-1', expect.objectContaining({
        lastQueryType: 'domestic_skill',
        entities: []
      }));
    });

    it('continues a domestic recommendation with only the currently authorized scene', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue({
        lastQueryType: 'domestic_skill',
        timestamp: new Date().toISOString(),
        entities: [
          { id: 'room-1', name: 'Sala', type: 'room', roomId: 'room-1', roomName: 'Sala' },
          { id: 'scene-cine', name: 'Cine en casa', type: 'scene', roomId: 'room-1', roomName: 'Sala' }
        ]
      });
      mockSceneRepo.findAll.mockResolvedValue([createTestScene({ id: 'scene-cine', name: 'Cine en casa', roomId: 'room-1' })]);

      const response = await service.converse({ prompt: '¿Cuál recomiendas?', userId: 'user-1' }, 'es');

      expect(response.type).toBe('answer');
      expect(response.message).toContain('Cine en casa');
      expect(response.message).toContain('activa Cine en casa');
      expect(mockSmallTalk.handle).not.toHaveBeenCalled();
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
      expect(mockInterpreter.interpret).not.toHaveBeenCalled();
    });

    it('should answer quickly when a likely home control prompt remains unknown', async () => {
      mockSmallTalk.handle.mockResolvedValue({
        type: 'answer',
        message: 'Fallback fallback'
      });

      const response = await service.converse({ prompt: 'enciende luz fantasma' }, 'es');
      expect(mockInterpreter.interpret).not.toHaveBeenCalled();
      expect(mockSmallTalk.handle).not.toHaveBeenCalled();
      expect(response.type).toBe('answer');
    });

    it('should understand conversational wrappers around state queries', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: '1', name: 'Luz Sala', type: 'light', lastKnownState: { on: true } }),
        createTestDevice({ id: '2', name: 'Luz Cocina', type: 'light', lastKnownState: { on: false } })
      ]);

      const response = await service.converse({
        prompt: 'Ok Nezu me puedes decir qué luces están encendidas por favor'
      }, 'es');

      expect(response.type).toBe('answer');
      expect(response.message).toContain('Luz Sala');
      expect(response.message).not.toContain('Luz Cocina');
      expect(mockInterpreter.interpret).not.toHaveBeenCalled();
    });

    it('should normalize conversational command conjugations before execution flow', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-1', name: 'Luz Sala', type: 'light', lastKnownState: { on: true } })
      ]);
      mockDeviceRepo.findDeviceById.mockResolvedValue(
        createTestDevice({ id: 'light-1', name: 'Luz Sala', type: 'light', lastKnownState: { on: true } })
      );

      const response = await service.converse({
        prompt: 'Ok Nezu me puedes apagar luz sala porfa'
      }, 'es');

      expect(response.type).toBe('execution');
      expect(response.message.toLowerCase()).toContain('apagué luz sala');
      expect(mockDispatcher.dispatch).toHaveBeenCalled();
    });

    it('does not schedule Planner V2 for a local conversational response', async () => {
      mockSmallTalk.handle.mockResolvedValue({
        type: 'answer',
        message: 'Puedo ayudarte con tu casa.',
        llmAttempted: false
      });

      await service.converse({ prompt: 'cuentame un chiste', userId: 'user-1' }, 'es');

      expect(mockSmallTalk.handle).toHaveBeenCalled();
      expect(mockShadow.runShadow).not.toHaveBeenCalled();
    });

    it('should delegate unknown conversational prompts to SmallTalkService', async () => {
      mockSmallTalk.handle.mockResolvedValue({
        type: 'answer',
        message: 'Ollama says hello'
      });

      const response = await service.converse({ prompt: 'Tell me a joke' }, 'en');
      expect(response.type).toBe('answer');
      expect(response.message).toBe('Ollama says hello');
      expect(mockSmallTalk.handle).toHaveBeenCalledWith('Tell me a joke', 'en', null, 'system');
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
      expect(mockExecutionRepo.save).not.toHaveBeenCalled();
    });

    it('should respond with a friendly fallback when SmallTalkService returns it', async () => {
      mockSmallTalk.handle.mockResolvedValue({
        type: 'answer',
        message: 'No estoy seguro de lo que quieres hacer'
      });

      const response = await service.converse({ prompt: 'blah blah' }, 'es');
      expect(response.type).toBe('answer');
      expect(response.message).toContain('No estoy seguro');
    });
  });  describe('Feature: deterministic conversational parsing helpers', () => {
    it('resolves confirmation polarity, ordinal choices, labels, and safe command inference', () => {
      const internals = service as unknown as {
        isConfirmation(value: string): boolean;
        isPositiveConfirmation(value: string): boolean;
        isNegativeConfirmation(value: string): boolean;
        resolveSelectionFromMemory(value: string, options: Array<{ id: string; label: string }>, language: string): string | null;
        inferCommandFromPrompt(value: string): string | undefined;
        isStateQuery(value: string): boolean;
      };
      const options = [
        { id: 'device-1', label: 'Luz Sala' },
        { id: 'device-2', label: 'Luz Cocina' },
        { id: 'scene-1', label: 'Escena Cine' },
      ];

      expect(internals.isConfirmation('confirmo ahora')).toBe(true);
      expect(internals.isPositiveConfirmation('no')).toBe(false);
      expect(internals.isNegativeConfirmation('cancelar ahora')).toBe(true);
      expect(internals.resolveSelectionFromMemory('la segunda', options, 'es')).toBe('device-2');
      expect(internals.resolveSelectionFromMemory('selected Luz Sala', options, 'en')).toBe('device-1');
      expect(internals.resolveSelectionFromMemory('cine', options, 'es')).toBe('scene-1');
      expect(internals.resolveSelectionFromMemory('desconocido', options, 'es')).toBeNull();
      expect(internals.inferCommandFromPrompt('abre la cortina')).toBe('open');
      expect(internals.inferCommandFromPrompt('turn off kitchen')).toBe('turn_off');
      expect(internals.inferCommandFromPrompt('pregunta general')).toBeUndefined();
      expect(internals.isStateQuery('qué luces están encendidas')).toBe(true);
      expect(internals.isStateQuery('enciende esa luz')).toBe(false);
    });
  });

  describe('Feature: pending alias deletion confirmation', () => {
    it('deletes only after an affirmative reply and cancels safely on a negative reply', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue({
        lastQueryType: 'none',
        entities: [],
        timestamp: '2026-08-17T00:00:00.000Z',
        pendingAliasDelete: { alias: 'lámpara', targetId: 'device-lamp', targetName: 'Lámpara', timestamp: '2026-08-17T00:00:00.000Z' },
      });

      const accepted = await service.converse({ prompt: 'sí', userId: 'user-alias' }, 'es');
      expect(accepted.message).toContain('eliminé el alias');
      expect(mockMemory.deleteAlias).toHaveBeenCalledWith('user-alias', 'lámpara');

      mockMemory.deleteAlias.mockClear();
      const rejected = await service.converse({ prompt: 'cancelar', userId: 'user-alias' }, 'es');
      expect(rejected.message).toBe('Acción cancelada.');
      expect(mockMemory.deleteAlias).not.toHaveBeenCalled();
    });
  });
  describe('Feature: pending draft confirmation', () => {
    const pendingDraftMemory = {
      lastQueryType: 'draft_creation' as const,
      entities: [],
      timestamp: '2026-08-17T00:00:00.000Z',
      pendingDraft: {
        id: 'draft-1',
        type: 'scene' as const,
        originalPrompt: 'crea una escena para apagar cuarto master',
      },
    };

    it('Scenario: Given a pending draft When the user confirms Then activates it and clears pending state', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue(pendingDraftMemory);

      const response = await service.converse({ prompt: 'sí, activar', userId: 'draft-owner' }, 'es');

      expect(mockDraftService.activateDraft).toHaveBeenCalledWith('draft-1', 'draft-owner');
      expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('draft-owner', expect.objectContaining({ pendingDraft: undefined }));
      expect(response).toEqual(expect.objectContaining({
        type: 'answer',
        message: 'Listo. Escena activada correctamente. Sistemas alineados.'
      }));
    });

    it('Scenario: Given a pending draft When the user cancels Then does not activate it and clears pending state', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue(pendingDraftMemory);

      const response = await service.converse({ prompt: 'no, cancelar', userId: 'draft-owner' }, 'es');

      expect(mockDraftService.activateDraft).not.toHaveBeenCalled();
      expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('draft-owner', expect.objectContaining({ pendingDraft: undefined }));
      expect(response).toEqual({ type: 'answer', message: 'Entendido, no activé la escena.' });
    });

    it('Scenario: Given an activation persistence failure When the user confirms Then returns a safe error and does not dispatch a device command', async () => {
      mockMemory.getShortTermMemory.mockResolvedValue(pendingDraftMemory);
      mockDraftService.activateDraft.mockRejectedValue(new Error('draft store unavailable'));

      const response = await service.converse({ prompt: 'confirmar', userId: 'draft-owner' }, 'es');

      expect(response).toEqual({ type: 'error', message: 'No se pudo activar la escena.' });
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });
  describe('Feature: confirmed scene management and execution', () => {
    it('Scenario: Given a pending scene rename When the user confirms Then persists the renamed scene and clears the pending action', async () => {
      const scene = {
        id: 'scene-1', homeId: 'h1', roomId: null, name: 'Cine', actions: [], executionMode: 'parallel' as const, createdAt: '', updatedAt: '',
      };
      mockMemory.getShortTermMemory.mockResolvedValue({
        lastQueryType: 'management_confirm',
        entities: [],
        timestamp: '2026-08-17T00:00:00.000Z',
        pendingManagementAction: {
          type: 'rename_scene', targetId: 'scene-1', targetName: 'Cine', payload: { newName: 'Noche' }, timestamp: '2026-08-17T00:00:00.000Z',
        },
      });
      mockSceneRepo.findSceneById.mockResolvedValue(scene);

      const response = await service.converse({ prompt: 'confirmar', userId: 'scene-owner' }, 'es');

      expect(mockSceneRepo.saveScene).toHaveBeenCalledWith(expect.objectContaining({ id: 'scene-1', name: 'Noche' }));
      expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('scene-owner', expect.objectContaining({ pendingManagementAction: undefined }));
      expect(response).toEqual({ type: 'answer', message: 'Listo, renombré la escena a "Noche".' });
    });

    it('Scenario: Given a valid scene intent When execution is authorized Then dispatches scene actions and returns the execution response', async () => {
      const scene = {
        id: 'scene-1', homeId: 'h1', roomId: 'r1', name: 'Cine',
        actions: [{ deviceId: 'light-1', command: { name: 'turn_off' as const, params: {} } }],
        executionMode: 'parallel' as const, createdAt: '', updatedAt: '',
      };
      mockSceneRepo.findSceneById.mockResolvedValue(scene);
      const internals = service as unknown as {
        executeIntent(
          intent: { type: 'scene'; target: string; prompt: string },
          request: { prompt: string; userId: string },
          language: string,
          userId: string,
          userName: string | null,
          prompt: string,
          memory: null
        ): Promise<{ type: string; message: string }>;
      };

      const response = await internals.executeIntent(
        { type: 'scene', target: 'scene-1', prompt: 'activa escena cine' },
        { prompt: 'activa escena cine', userId: 'scene-owner' },
        'es',
        'scene-owner',
        null,
        'activa escena cine',
        null,
      );

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith('light-1', expect.objectContaining({ name: 'turn_off' }));
      expect(response).toEqual(expect.objectContaining({ type: 'execution', message: 'Escena en ejecución.' }));
    });
  });
  describe('Feature: safe residential terminology queries', () => {
    it('answers equivalence and room inventory questions without dispatching commands', async () => {
      const availableRooms = [
        createTestRoom({ id: 'room-sala', homeId: 'home-1', name: 'Sala' }),
        createTestRoom({ id: 'room-tech', homeId: 'home-1', name: 'Tech' }),
      ];
      mockRoomRepo.findAll.mockResolvedValue(availableRooms);
      mockRoomRepo.findRoomsByHomeId.mockResolvedValue(availableRooms);

      const equivalence = await service.converse({ prompt: 'es lo mismo que decir cuarto y estancia', userId: 'user-1' }, 'es');
      const rooms = await service.converse({ prompt: 'qué estancias conoces', userId: 'user-1' }, 'es');

      expect(equivalence.message).toContain('puedo resolver estancias');
      expect(rooms.message).toContain('• Sala');
      expect(rooms.message).toContain('• Tech');
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });
  describe('Feature: point-state and company query classification', () => {
    it('classifies point-state prompts while leaving broad inventory questions to the state-query flow', () => {
      const internals = service as unknown as {
        isPointStateQuery(value: string): boolean;
        isCompanyQuery(value: string): boolean;
      };

      expect(internals.isPointStateQuery('esta encendida la luz sala')).toBe(true);
      expect(internals.isPointStateQuery('esta apagado el comedor')).toBe(true);
      expect(internals.isPointStateQuery('is on the kitchen light')).toBe(true);
      expect(internals.isPointStateQuery('que luces estan encendidas')).toBe(false);
      expect(internals.isPointStateQuery('which lights are on')).toBe(false);
      expect(internals.isCompanyQuery('quien creo homepilot')).toBe(true);
      expect(internals.isCompanyQuery('tell me a joke')).toBe(false);
    });
  });
  describe('Feature: conversational intent predicates', () => {
    it('classifies help, presentation, scope, time, summary, activity, greetings, wellness, and state inventory questions deterministically', () => {
      const internals = service as unknown as {
        isNameQuery(value: string): boolean;
        isHelpQuery(value: string): boolean;
        isPresentation(value: string): boolean;
        isScopeQuery(value: string): boolean;
        isDateTimeQuery(value: string): boolean;
        isHomeSummaryQuery(value: string): boolean;
        isRecentActivityQuery(value: string): boolean;
        isConversationContextQuery(value: string): boolean;
        isGreeting(value: string): boolean;
        isWellnessQuery(value: string): boolean;
        isStateQuery(value: string): boolean;
        isInventoryCountQuery(value: string): boolean;
      };

      expect(internals.isNameQuery('como te llamas')).toBe(true);
      expect(internals.isHelpQuery('necesito ayuda con la casa')).toBe(true);
      expect(internals.isPresentation('que puedes controlar')).toBe(true);
      expect(internals.isScopeQuery('cuales son tus limites')).toBe(true);
      expect(internals.isDateTimeQuery('que hora es')).toBe(true);
      expect(internals.isHomeSummaryQuery('dame un resumen de la casa')).toBe(true);
      expect(internals.isRecentActivityQuery('que cambio recientemente')).toBe(true);
      expect(internals.isConversationContextQuery('repite tu ultima respuesta')).toBe(true);
      expect(internals.isGreeting('hola nezu')).toBe(true);
      expect(internals.isWellnessQuery('estas funcionando correctamente')).toBe(true);
      expect(internals.isInventoryCountQuery('cuantas luces tengo')).toBe(true);
      expect(internals.isStateQuery('que luces estan encendidas')).toBe(true);
      expect(internals.isStateQuery('enciende esa luz')).toBe(false);
      expect(internals.isStateQuery('cuantas luces tengo')).toBe(true);
      expect(internals.isPresentation('enciende sala')).toBe(false);
    });

    it('formats remembered conversation context in both the available and empty cases', () => {
      const internals = service as unknown as {
        handleConversationContext(memory: { originalPrompt?: string } | null, language: string): { message: string };
      };

      expect(internals.handleConversationContext({ originalPrompt: 'apaga la sala' }, 'es').message).toContain('apaga la sala');
      expect(internals.handleConversationContext(null, 'en').message).toContain('do not have a previous request');
    });
  });
  describe('Feature: residential summaries and activity answers', () => {
    it('reports home summaries, recent activity, and contextual capability guidance from authorized inventory', async () => {
      const internals = service as unknown as {
        handleHomeSummary(language: string, userId: string): Promise<{ message: string }>;
        handleRecentActivity(language: string): Promise<{ message: string }>;
        handleCapabilitiesGuide(userId: string, language: string): Promise<{ message: string }>;
      };
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-on', homeId: 'home-1', type: 'light', lastKnownState: { on: true } }),
        createTestDevice({ id: 'sensor-offline', homeId: 'home-1', type: 'sensor', lastKnownState: { available: false } }),
      ]);
      mockSceneRepo.findAll.mockResolvedValue([]);
      mockAutomationRepo.findAll.mockResolvedValue([]);
      mockMemory.getAliases.mockResolvedValue({ desk: 'light-on' });
      mockExecutionRepo.findRecent.mockResolvedValueOnce([]).mockResolvedValueOnce([
        { sourceType: 'scene', sourceId: 'scene-1', status: 'success', summary: 'Cinema scene' },
      ] as never);

      await expect(internals.handleHomeSummary('es', 'user-1')).resolves.toEqual(expect.objectContaining({ message: expect.stringContaining('1 de 2') }));
      await expect(internals.handleRecentActivity('en')).resolves.toEqual(expect.objectContaining({ message: expect.stringContaining('no recent') }));
      await expect(internals.handleRecentActivity('es')).resolves.toEqual(expect.objectContaining({ message: expect.stringContaining('Cinema scene') }));
      await expect(internals.handleCapabilitiesGuide('user-1', 'en')).resolves.toEqual(expect.objectContaining({ message: expect.stringContaining('Current HomePilot context') }));
    });
  });
  describe('Feature: deterministic assistant response helpers', () => {
    it('recognizes scene, automation, and management requests without sending commands', () => {
      const internals = service as unknown as {
        isListScenesIntent(value: string): boolean;
        isListAutomationsIntent(value: string): boolean;
        isManagementIntent(value: string): boolean;
        extractTargetPhrase(value: string): string;
        isRoomBulkFastPath(value: string): { command: string; roomName: string; bulkType: string } | null;
        isRoomSingularLightFastPath(value: string): { command: string; roomName: string } | null;
        containsWord(source: string, word: string): boolean;
      };

      expect(internals.isListScenesIntent('lista las escenas')).toBe(true);
      expect(internals.isListScenesIntent('activa la escena cine')).toBe(false);
      expect(internals.isListAutomationsIntent('list automations')).toBe(true);
      expect(internals.isListAutomationsIntent('activa rutina noche')).toBe(false);
      expect(internals.isManagementIntent('renombra la escena cine a noche')).toBe(true);
      expect(internals.isManagementIntent('enciende la sala')).toBe(false);
      expect(internals.extractTargetPhrase('Apaga la luz de la sala')).toBe('la luz de la sala');
      expect(internals.extractTargetPhrase('turn off')).toBe('');
      expect(internals.isRoomBulkFastPath('apaga todas las luces en sala')).toEqual({ command: 'turn_off', roomName: 'sala', bulkType: 'lights' });
      expect(internals.isRoomBulkFastPath('turn on all lights in kitchen')).toEqual({ command: 'turn_on', roomName: 'kitchen', bulkType: 'lights' });
      expect(internals.isRoomBulkFastPath('apaga todo')).toBeNull();
      expect(internals.isRoomSingularLightFastPath('enciende la luz en sala')).toEqual({ command: 'turn_on', roomName: 'sala' });
      expect(internals.isRoomSingularLightFastPath('turn off the lamp in kitchen')).toEqual({ command: 'turn_off', roomName: 'kitchen' });
      expect(internals.containsWord('apaga la luz', 'la')).toBe(true);
      expect(internals.containsWord('lateral', 'la')).toBe(false);
    });

    it('formats successful, partial, and failed execution summaries consistently', () => {
      const internals = service as unknown as {
        buildCommandSuccessMessage(command: 'turn_on' | 'turn_off' | 'toggle', deviceName: string, userName: string | null, language: string): string;
        formatMultiCommandSummary(results: unknown[], language: string, bulkType?: 'all' | 'lights'): string;
      };
      const success = (name: string, command: 'turn_on' | 'turn_off') => ({
        deviceName: name,
        action: { command },
        result: { status: 'success', actions: [] },
      });
      const failed = (name: string, error: string) => ({
        deviceName: name,
        action: { command: 'turn_off' },
        result: { status: 'failed', actions: [{ error }] },
      });

      expect(internals.buildCommandSuccessMessage('turn_on', 'Sala', null, 'es')).toBe('Encendí Sala.');
      expect(internals.buildCommandSuccessMessage('turn_off', 'Kitchen', null, 'en')).toBe('Turned off Kitchen.');
      expect(internals.formatMultiCommandSummary([success('Sala', 'turn_on')], 'es')).toBe('Encendí Sala.');
      expect(internals.formatMultiCommandSummary([success('Sala', 'turn_on'), success('Cocina', 'turn_on')], 'es')).toContain('Sala y Cocina');
      expect(internals.formatMultiCommandSummary([success('A', 'turn_off'), success('B', 'turn_off'), success('C', 'turn_off'), success('D', 'turn_off')], 'en', 'lights')).toContain('turned off 4 lights');
      expect(internals.formatMultiCommandSummary([failed('Sala', 'offline')], 'es')).toContain('offline');
      expect(internals.formatMultiCommandSummary([success('Sala', 'turn_on'), failed('Cocina', 'offline')], 'en')).toContain('Executed 1 of 2');
    });
  });
  describe('Feature: managed scene and automation changes', () => {
    it('prepares confirmed rename, automation, and scene-edit actions without executing them directly', async () => {
      const internals = service as unknown as {
        handleManagementIntent(prompt: string, userId: string, language: string): Promise<{ type: string; message: string }>;
      };
      const scene = {
        id: 'scene-cine', homeId: 'h1', roomId: null, name: 'Cine', actions: [{ deviceId: 'light-1', command: { name: 'turn_off' as const, params: {} } }], executionMode: 'parallel' as const, createdAt: '', updatedAt: '',
      };
      mockSceneRepo.findAll.mockResolvedValue([scene]);
      mockAutomationRepo.findAll.mockResolvedValue([{
        id: 'automation-night', homeId: 'h1', userId: 'user-1', name: 'Noche', enabled: true,
        trigger: { type: 'time', timeLocal: '22:00', timezone: 'America/Guayaquil', timeUTC: '03:00' },
        action: { type: 'device_command', targetDeviceId: 'light-1', command: 'turn_off' },
      }]);
      mockDeviceRepo.findAll.mockResolvedValue([createTestDevice({ id: 'light-1', homeId: 'h1', name: 'Luz Sala', type: 'light' })]);

      await expect(internals.handleManagementIntent('renombra la escena cine a noche', 'user-1', 'es')).resolves.toEqual(expect.objectContaining({ type: 'clarification', message: expect.stringContaining('renombrar') }));
      await expect(internals.handleManagementIntent('desactiva la automatizacion noche', 'user-1', 'es')).resolves.toEqual(expect.objectContaining({ type: 'clarification', message: expect.stringContaining('desactivar') }));
      await expect(internals.handleManagementIntent('agrega luz sala a la escena cine', 'user-1', 'es')).resolves.toEqual(expect.objectContaining({ type: 'clarification', message: expect.stringContaining('agregar') }));
      await expect(internals.handleManagementIntent('quita luz sala de la escena cine', 'user-1', 'es')).resolves.toEqual(expect.objectContaining({ type: 'clarification', message: expect.stringContaining('quitar') }));

      expect(mockMemory.saveShortTermMemory).toHaveBeenCalledTimes(4);
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });
  describe('Feature: confirmation and clarification guardrails', () => {
    it('recognizes confirmation polarity and resolves deterministic clarification choices', () => {
      const internals = service as unknown as {
        isConfirmation(value: string): boolean;
        isPositiveConfirmation(value: string): boolean;
        isNegativeConfirmation(value: string): boolean;
        resolveSelectionFromMemory(value: string, options: Array<{ id: string; label: string }>, language: string): string | null;
        isLikelyHomeControlPrompt(value: string): boolean;
        isClarificationSelectionReply(value: string): boolean;
        isSuggestionAccept(value: string): boolean;
        isSuggestionReject(value: string): boolean;
        isSuggestionPostpone(value: string): boolean;
        isBulkActionAccept(value: string): boolean;
        isBulkActionReject(value: string): boolean;
      };
      const options = [
        { id: 'sala', label: 'Luz Sala' },
        { id: 'cocina', label: 'Luz Cocina' },
        { id: 'patio', label: 'Luz Patio' },
      ];

      expect(internals.isConfirmation('procede ahora')).toBe(true);
      expect(internals.isPositiveConfirmation('go ahead please')).toBe(true);
      expect(internals.isNegativeConfirmation('cancelar ahora')).toBe(true);
      expect(internals.resolveSelectionFromMemory('sala', options, 'es')).toBe('sala');
      expect(internals.resolveSelectionFromMemory('la segunda', options, 'es')).toBe('cocina');
      expect(internals.resolveSelectionFromMemory('selected patio', options, 'en')).toBe('patio');
      expect(internals.resolveSelectionFromMemory('unknown', options, 'en')).toBeNull();
      expect(internals.isLikelyHomeControlPrompt('apaga la luz sala')).toBe(true);
      expect(internals.isLikelyHomeControlPrompt('dime como funciona homepilot')).toBe(false);
      expect(internals.isClarificationSelectionReply('la segunda')).toBe(true);
      expect(internals.isClarificationSelectionReply('que luces estan encendidas')).toBe(false);
      expect(internals.isSuggestionAccept('create it')).toBe(true);
      expect(internals.isSuggestionReject('dismiss')).toBe(true);
      expect(internals.isSuggestionPostpone('remind me later')).toBe(true);
      expect(internals.isBulkActionAccept('confirm')).toBe(true);
      expect(internals.isBulkActionReject('no thanks')).toBe(true);
    });
  });
  describe('Feature: deterministic room command parsing', () => {
    it('extracts device targets and only recognizes complete Spanish and English room-control phrases', () => {
      const internals = service as unknown as {
        extractTargetPhrase(value: string): string;
        isRoomBulkFastPath(value: string): { command: 'turn_on' | 'turn_off'; roomName: string; bulkType: 'all' | 'lights' } | null;
        isSingularLightRequest(value: string): boolean;
        isRoomSingularLightFastPath(value: string): { command: 'turn_on' | 'turn_off'; roomName: string } | null;
      };

      expect(internals.extractTargetPhrase('enciende la lámpara sala')).toBe('la lampara sala');
      expect(internals.extractTargetPhrase('turn off')).toBe('');
      expect(internals.extractTargetPhrase('estado de cocina')).toBe('estado de cocina');
      expect(internals.isRoomBulkFastPath('apaga las luces en sala')).toEqual({ command: 'turn_off', roomName: 'sala', bulkType: 'lights' });
      expect(internals.isRoomBulkFastPath('turn on everything in kitchen')).toEqual({ command: 'turn_on', roomName: 'kitchen', bulkType: 'all' });
      expect(internals.isRoomBulkFastPath('apaga todas las luces y la sala')).toBeNull();
      expect(internals.isRoomBulkFastPath('turn off all lights')).toBeNull();
      expect(internals.isSingularLightRequest('enciende la luz del patio')).toBe(true);
      expect(internals.isSingularLightRequest('enciende todas las luces')).toBe(false);
      expect(internals.isRoomSingularLightFastPath('prende la luz en patio')).toEqual({ command: 'turn_on', roomName: 'patio' });
      expect(internals.isRoomSingularLightFastPath('switch off the lamp at office')).toEqual({ command: 'turn_off', roomName: 'office' });
      expect(internals.isRoomSingularLightFastPath('enciende luxury patio')).toBeNull();
    });
  });
  it('resolves room aliases by exact, fuzzy, user-defined, ambiguous, and invalid targets', () => {
    const internals = service as unknown as { resolveRoomAlias(name: string, rooms: ReadonlyArray<ReturnType<typeof createTestRoom>>, devices: ReadonlyArray<ReturnType<typeof createTestDevice>>, userId: string, aliases: Record<string, string>): { status: string; rooms: ReadonlyArray<{ id: string }>; candidates?: string[] } };
    const rooms = [createTestRoom({ id: 'sala', name: 'Sala Principal', homeId: 'h1' }), createTestRoom({ id: 'sala-2', name: 'Sala TV', homeId: 'h1' })];
    const device = createTestDevice({ id: 'device-1', homeId: 'h1', name: 'Luz', type: 'light' });
    expect(internals.resolveRoomAlias('sala principal', rooms, [device], 'user-1', {})).toMatchObject({ status: 'resolved', rooms: [{ id: 'sala' }] });
    expect(internals.resolveRoomAlias('principal', rooms, [device], 'user-1', {})).toMatchObject({ status: 'resolved', rooms: [{ id: 'sala' }] });
    expect(internals.resolveRoomAlias('living', rooms, [device], 'user-1', { living: 'sala' })).toMatchObject({ status: 'resolved', rooms: [{ id: 'sala' }] });
    expect(internals.resolveRoomAlias('sala', rooms, [device], 'user-1', {})).toMatchObject({ status: 'ambiguous' });
    expect(internals.resolveRoomAlias('unknown', rooms, [device], 'user-1', { unknown: 'device-1' })).toMatchObject({ status: 'not_found' });
  });

  describe('Feature: conversation preferences and direct household commands', () => {
    it('Scenario: Given a Spanish preferred-address instruction When it is accepted Then it is persisted and acknowledged in Spanish', async () => {
      const response = await service.converse({ prompt: 'llámame Sofía', userId: 'user-sofia' }, 'es');

      expect(mockMemory.setUserPreference).toHaveBeenCalledWith('user-sofia', 'assistant_preferred_address', 'Sofía');
      expect(response).toEqual({ type: 'answer', message: 'Entendido. Me dirigiré a ti como Sofía en la conversación general.' });
    });
  });
  describe('Feature: point-state assistant answers', () => {
    it('Scenario: Given a room with mixed controllable states When its state is requested Then reports the exact on-device count', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-on', name: 'Luz techo', roomId: 'r1', type: 'light', lastKnownState: { state: 'on' } }),
        createTestDevice({ id: 'light-off', name: 'Luz mesa', roomId: 'r1', type: 'light', lastKnownState: { state: 'off' } }),
      ]);

      const response = await (service as unknown as {
        handlePointStateQuery(prompt: string, language: string, userId: string): Promise<{ type: string; message: string }>;
      }).handlePointStateQuery('esta encendida cuarto master', 'es', 'state-reader');

      expect(response).toEqual(expect.objectContaining({
        type: 'answer',
        message: 'Hay 1 de 2 dispositivos encendidos en Cuarto Master.',
      }));
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('Scenario: Given no matching device or room When a point state is requested Then returns a bounded not-found answer', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-1', name: 'Luz sala', roomId: 'r1', type: 'light', lastKnownState: { state: 'on' } }),
      ]);
      mockRoomRepo.findAll.mockResolvedValue([createTestRoom({ id: 'r1', name: 'Sala', homeId: 'h1' })]);

      const response = await (service as unknown as {
        handlePointStateQuery(prompt: string, language: string, userId: string): Promise<{ type: string; message: string }>;
      }).handlePointStateQuery('esta encendida luz inexistente', 'es', 'state-reader');

      expect(response).toEqual({ type: 'answer', message: 'No pude encontrar el dispositivo por el que preguntas.' });
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('Scenario: Given no authorized rooms, scenes, or automations When they are listed Then returns explicit empty answers', async () => {
      mockRoomRepo.findAll.mockResolvedValue([]);
      mockSceneRepo.findAll.mockResolvedValue([]);
      mockAutomationRepo.findAll.mockResolvedValue([]);
      const privateService = service as unknown as {
        handleRoomQuery(language: string, userId: string): Promise<{ type: string; message: string }>;
        handleListScenes(language: string, userId: string): Promise<{ type: string; message: string }>;
        handleListAutomations(language: string, userId: string): Promise<{ type: string; message: string }>;
      };

      await expect(privateService.handleRoomQuery('en', 'empty-reader')).resolves.toEqual({ type: 'answer', message: "I don't know any rooms yet." });
      await expect(privateService.handleListScenes('en', 'empty-reader')).resolves.toEqual({ type: 'answer', message: "You don't have any scenes created yet." });
      await expect(privateService.handleListAutomations('en', 'empty-reader')).resolves.toEqual({ type: 'answer', message: "You don't have any automations yet." });
    });

    it('Scenario: Given a room with only off controllable devices When its state is requested Then confirms everything is off', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-off', name: 'Luz techo', roomId: 'r1', type: 'light', lastKnownState: { state: 'off' } }),
      ]);
      mockRoomRepo.findAll.mockResolvedValue([createTestRoom({ id: 'r1', name: 'Sala', homeId: 'h1' })]);

      await expect((service as unknown as {
        handlePointStateQuery(prompt: string, language: string, userId: string): Promise<{ type: string; message: string }>;
      }).handlePointStateQuery('esta apagada sala', 'es', 'state-reader')).resolves.toEqual({
        type: 'answer', message: 'Todo está apagado en Sala.',
      });
    });

    it('Scenario: Given a room with every controllable device on When its state is requested Then confirms everything is on', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-1', name: 'Luz techo', roomId: 'r1', type: 'light', lastKnownState: { state: 'on' } }),
        createTestDevice({ id: 'switch-1', name: 'Ventilador', roomId: 'r1', type: 'switch', lastKnownState: { state: 'on' } }),
      ]);
      mockRoomRepo.findAll.mockResolvedValue([createTestRoom({ id: 'r1', name: 'Sala', homeId: 'h1' })]);

      await expect((service as unknown as {
        handlePointStateQuery(prompt: string, language: string, userId: string): Promise<{ type: string; message: string }>;
      }).handlePointStateQuery('esta encendida sala', 'es', 'state-reader')).resolves.toEqual({
        type: 'answer', message: 'Todo está encendido en Sala.',
      });
    });
    it('Scenario: Given a room without controllable devices When its state is requested Then explains that limitation', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'sensor-1', name: 'Temperatura', roomId: 'r1', type: 'sensor', lastKnownState: { state: 'on' } }),
      ]);
      mockRoomRepo.findAll.mockResolvedValue([createTestRoom({ id: 'r1', name: 'Office', homeId: 'h1' })]);

      await expect((service as unknown as {
        handlePointStateQuery(prompt: string, language: string, userId: string): Promise<{ type: string; message: string }>;
      }).handlePointStateQuery('is office on', 'en', 'state-reader')).resolves.toEqual({
        type: 'answer', message: "I don't see controllable devices in Office.",
      });
    });
    it('Scenario: Given two matching devices When a point state is requested Then asks for a bounded clarification', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-1', name: 'Luz Sala', type: 'light', lastKnownState: { state: 'on' } }),
        createTestDevice({ id: 'light-2', name: 'Luz Sala', type: 'light', lastKnownState: { state: 'off' } }),
      ]);

      await expect((service as unknown as {
        handlePointStateQuery(prompt: string, language: string, userId: string): Promise<{ type: string; message: string; clarification?: { options: Array<{ id: string }> } }>;
      }).handlePointStateQuery('luz sala esta encendida', 'es', 'state-reader')).resolves.toMatchObject({
        type: 'clarification',
        clarification: { options: [expect.objectContaining({ id: 'light-1' }), expect.objectContaining({ id: 'light-2' })] },
      });
    });

    it('Scenario: Given a numeric active state When it is queried Then treats it as on', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'dimmer-1', name: 'Dimmer Sala', type: 'light', lastKnownState: { state: 45 } }),
      ]);

      await expect((service as unknown as {
        handlePointStateQuery(prompt: string, language: string, userId: string): Promise<{ type: string; message: string }>;
      }).handlePointStateQuery('dimmer sala esta encendido', 'es', 'state-reader')).resolves.toEqual({
        type: 'answer', message: 'Sí, Dimmer Sala está encendido.',
      });
    });
    it('Scenario: Given an active device When it is asked whether it is off Then gives the inverse state answer', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-1', name: 'Luz Sala', type: 'light', lastKnownState: { state: 'on' } }),
      ]);

      await expect((service as unknown as {
        handlePointStateQuery(prompt: string, language: string, userId: string): Promise<{ type: string; message: string }>;
      }).handlePointStateQuery('luz sala esta apagada', 'es', 'state-reader')).resolves.toEqual({
        type: 'answer', message: 'No, Luz Sala está encendido.',
      });
    });

    it('Scenario: Given lights in multiple rooms When a vague light command has no source room Then asks for the room before acting', async () => {
      mockInterpreter.interpret.mockResolvedValue({
        type: 'command',
        deviceId: '',
        command: 'turn_off',
        prompt: 'apaga las luces'
      });
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'sala-light', name: 'Luz Sala', roomId: 'sala', type: 'light', lastKnownState: { state: 'on' } }),
        createTestDevice({ id: 'kitchen-light', name: 'Luz Cocina', roomId: 'kitchen', type: 'light', lastKnownState: { state: 'on' } })
      ]);

      await expect(service.converse({ prompt: 'apaga las luces', userId: 'safe-user' }, 'es')).resolves.toMatchObject({
        type: 'clarification',
        message: '¿En qué estancia quieres controlar la luz?'
      });
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });
    it('Scenario: Given duplicate device matches for a specific request When a command is issued Then it persists bounded choices instead of dispatching blindly', async () => {
      mockInterpreter.interpret.mockResolvedValue({
        type: 'command',
        deviceId: '',
        command: 'turn_off',
        prompt: 'apaga la luz sala',
      });
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'sala-main', name: 'Luz Sala', roomId: 'sala', type: 'light', lastKnownState: { state: 'on' } }),
        createTestDevice({ id: 'sala-secondary', name: 'Luz Sala', roomId: 'sala', type: 'light', lastKnownState: { state: 'on' } }),
      ]);

      await expect(service.converse({ prompt: 'apaga la luz sala', userId: 'duplicate-device-user' }, 'es')).resolves.toMatchObject({
        type: 'clarification',
        message: 'Encontré varios dispositivos compatibles. Indícame el objetivo.',
        clarification: {
          options: [
            expect.objectContaining({ id: 'sala-main', label: 'Luz Sala' }),
            expect.objectContaining({ id: 'sala-secondary', label: 'Luz Sala' }),
          ],
        },
      });
      expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('duplicate-device-user', expect.objectContaining({
        lastQueryType: 'clarification',
        pendingIntent: expect.objectContaining({ command: 'turn_off' }),
      }));
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });
  describe('Feature: home state summary', () => {
    it('Scenario: Given devices with known on and off states When a broad home-state query is made Then it reports counts and active rooms without dispatching commands', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'on-light', name: 'Luz Sala', type: 'light', homeId: 'h1', roomId: 'r1', lastKnownState: { state: 'on' } }),
        createTestDevice({ id: 'off-light', name: 'Luz Cocina', type: 'light', homeId: 'h1', roomId: 'r2', lastKnownState: { state: 'off' } })
      ]);
      mockRoomRepo.findAll.mockResolvedValue([
        createTestRoom({ id: 'r1', name: 'Sala', homeId: 'h1' }),
        createTestRoom({ id: 'r2', name: 'Cocina', homeId: 'h1' })
      ]);
      mockRoomRepo.findRoomsByHomeId.mockResolvedValue([
        createTestRoom({ id: 'r1', name: 'Sala', homeId: 'h1' }),
        createTestRoom({ id: 'r2', name: 'Cocina', homeId: 'h1' })
      ]);

      const response = await (service as unknown as {
        handleStateQuery(normalized: string, language: string, userName: string | null, userId: string): Promise<{ type: string; message: string }>;
      }).handleStateQuery('estado de la casa', 'es', 'Oscar', 'state-summary');

      expect(response).toEqual(expect.objectContaining({
        type: 'answer',
        message: expect.stringContaining('Encendidas: 1')
      }));
      expect(response.message).toContain('Apagadas: 1');
      expect(response.message).toContain('Sala');
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('Scenario: Given a partial room name in a room-status query When exactly one authorized room matches Then returns only that room state', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'meeting-light', name: 'Estar', type: 'light', homeId: 'h1', roomId: 'meeting-room', lastKnownState: { state: 'on' } }),
        createTestDevice({ id: 'meeting-light-2', name: 'Sala2', type: 'light', homeId: 'h1', roomId: 'meeting-room', lastKnownState: { state: 'off' } }),
        createTestDevice({ id: 'meeting-light-3', name: 'Sala2', type: 'light', homeId: 'h1', roomId: 'meeting-room', lastKnownState: { state: 'off' } }),
        createTestDevice({ id: 'tech-light', name: 'Indirecta Planta', type: 'light', homeId: 'h1', roomId: 'tech-room', lastKnownState: { state: 'off' } })
      ]);
      const rooms = [
        createTestRoom({ id: 'meeting-room', name: 'Sala de Reuniones', homeId: 'h1' }),
        createTestRoom({ id: 'tech-room', name: 'Tech', homeId: 'h1' })
      ];
      mockRoomRepo.findAll.mockResolvedValue(rooms);
      mockRoomRepo.findRoomsByHomeId.mockResolvedValue(rooms);

      const response = await (service as unknown as {
        handleStateQuery(normalized: string, language: string, userName: string | null, userId: string): Promise<{ type: string; message: string }>;
      }).handleStateQuery('como esta la sala', 'es', 'Gustavo', 'room-status');

      expect(response.message).toContain('Gustavo, Así está Sala de Reuniones ahora:');
      expect(response.message).toContain('Encendidos (1): Estar.');
      expect(response.message).toContain('Apagados (2): Sala2 ×2.');
      expect(response.message).not.toContain('Estar (Sala de Reuniones)');
      expect(response.message).not.toContain('Indirecta Planta');
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('Scenario: Given one controllable curtain in a partially named room When a close command is issued Then executes through the existing confirmation policy', async () => {
      const curtain = createTestDevice({
        id: 'curtain-master',
        name: 'Cortina Cuarto Master',
        type: 'cover',
        homeId: 'h1',
        roomId: 'r1',
        lastKnownState: { state: 'open' }
      });
      mockDeviceRepo.findAll.mockResolvedValue([
        curtain,
        createTestDevice({ id: 'curtain-sala', name: 'Cortina Sala', type: 'cover', homeId: 'h1', roomId: 'r2', lastKnownState: { state: 'open' } })
      ]);
      mockDeviceRepo.findDeviceById.mockResolvedValue(curtain);
      mockRoomRepo.findAll.mockResolvedValue([createTestRoom({ id: 'r1', name: 'Cuarto Master', homeId: 'h1' })]);

      const response = await service.converse({ prompt: 'cierra la cortina del cuarto', userId: 'curtain-user' }, 'es');

      expect(mockConfirmationPolicy.evaluate).toHaveBeenCalledWith(expect.objectContaining({
        type: 'command',
        deviceId: 'curtain-master',
        command: 'close'
      }), 'es');
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith('curtain-master', expect.objectContaining({
        name: 'close'
      }));
      expect(response.type).toBe('execution');
    });
  });
  describe('Feature: deterministic informational intent classification', () => {
    it('Scenario: Given date, greeting, wellness, and state prompts When they are classified Then no device command is inferred', async () => {
      const privateService = service as unknown as {
        handleDateTimeQuery(prompt: string, language: string): Promise<{ type: string; message: string }>;
        isGreeting(prompt: string): boolean;
        isWellnessQuery(prompt: string): boolean;
        isStateQuery(prompt: string): boolean;
        isAttentionQuery(prompt: string): boolean;
      };

      const dateResponse = await privateService.handleDateTimeQuery('qué fecha es hoy', 'es');
      const timeResponse = await privateService.handleDateTimeQuery('what time is it', 'en');

      expect(dateResponse).toMatchObject({ type: 'answer', message: expect.stringContaining('Hoy es') });
      expect(timeResponse).toMatchObject({ type: 'answer', message: expect.stringContaining('Home systems remain attentive') });
      expect(privateService.isGreeting('buenas tardes')).toBe(true);
      expect(privateService.isWellnessQuery('estas funcionando correctamente')).toBe(true);
      expect(privateService.isStateQuery('qué luces están encendidas')).toBe(true);
      expect(privateService.isStateQuery('como esta la sala')).toBe(true);
      expect(privateService.isStateQuery('enciende esas luces')).toBe(false);
      expect(privateService.isAttentionQuery('que dispositivos necesitan atencion')).toBe(true);
    });
  });
  it('Scenario: Given unavailable devices When attention is requested Then only unavailable authorized devices are reported', async () => {
    mockDeviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'available', name: 'Luz disponible', lastKnownState: { on: false } }),
      createTestDevice({ id: 'unavailable', name: 'Sensor sin conexión', lastKnownState: { state: 'unavailable' } })
    ]);

    const response = await (service as unknown as {
      handleAttentionQuery(language: string, userId: string): Promise<{ type: string; message: string }>;
    }).handleAttentionQuery('es', 'attention-user');

    expect(response).toEqual({
      type: 'answer',
      message: '1 dispositivos requieren atención: Sensor sin conexión.'
    });
  });
  describe('Feature: deterministic command recognizers', () => {
    it('Scenario: Given supported bulk and singular phrasing When fast-path recognizers parse it Then they preserve scope and reject ambiguous input', () => {
      const privateService = service as unknown as {
        isRoomBulkFastPath(prompt: string): { command: 'turn_on' | 'turn_off'; roomName: string; bulkType: 'all' | 'lights' } | null;
        isBulkFastPath(prompt: string): { command: 'turn_on' | 'turn_off'; bulkType: 'all' | 'lights' } | null;
        isRoomSingularLightFastPath(prompt: string): { command: 'turn_on' | 'turn_off'; roomName: string } | null;
        isPointStateQuery(prompt: string): boolean;
        extractTargetPhrase(prompt: string): string;
        isCompanyQuery(prompt: string): boolean;
        handleCompanyInfoQuery(language: string): { type: string; message: string };
      };

      expect(privateService.isRoomBulkFastPath('apaga todas las luces en Sala')).toEqual({
        command: 'turn_off', roomName: 'sala', bulkType: 'lights'
      });
      expect(privateService.isRoomBulkFastPath('turn on all lights in Kitchen')).toEqual({
        command: 'turn_on', roomName: 'kitchen', bulkType: 'lights'
      });
      expect(privateService.isRoomBulkFastPath('apaga luces y ventilador en Sala')).toBeNull();
      expect(privateService.isRoomBulkFastPath('apaga luces')).toBeNull();
      expect(privateService.isRoomBulkFastPath('apaga las luces que esten encendidas')).toBeNull();
      expect(privateService.isBulkFastPath('apaga las luces que esten encendidas')).toEqual({
        command: 'turn_off',
        bulkType: 'lights'
      });

      expect(privateService.isRoomSingularLightFastPath('enciende la luz en Sala')).toEqual({
        command: 'turn_on', roomName: 'sala'
      });
      expect(privateService.isRoomSingularLightFastPath('switch off a lamp in Kitchen')).toEqual({
        command: 'turn_off', roomName: 'kitchen'
      });
      expect(privateService.isRoomSingularLightFastPath('enciende luxury en Sala')).toBeNull();

      expect(privateService.isPointStateQuery('la luz esta encendida')).toBe(true);
      expect(privateService.isPointStateQuery('que luces estan encendidas')).toBe(false);
      expect(privateService.extractTargetPhrase('apaga la luz de sala')).toBe('la luz de sala');
      expect(privateService.extractTargetPhrase('turn off')).toBe('');
      expect(privateService.isCompanyQuery('quién creó homepilot')).toBe(true);
      expect(privateService.isCompanyQuery('estado de luces')).toBe(false);
      expect(privateService.handleCompanyInfoQuery('en')).toMatchObject({
        type: 'answer', message: expect.stringContaining('NEZU S.A.S.')
      });
    });
  });
  describe('Feature: suggestion response handling', () => {
    const suggestion = {
      id: 'suggestion-1',
      type: 'scene_suggestion',
      message: 'Create a scene?',
      metadata: {}
    } as never;

    it('Scenario: Given a pending suggestion When accepted Then records acceptance and clears the pending state', async () => {
      const internals = service as unknown as {
        handleSuggestionAccept(userId: string, language: string, value: never): Promise<{ type: string; message: string }>;
      };

      mockMemory.getShortTermMemory.mockResolvedValue({
        lastQueryType: 'none',
        entities: [],
        timestamp: '2026-08-17T00:00:00.000Z',
        pendingSuggestion: suggestion,
      });

      const response = await internals.handleSuggestionAccept('suggestion-user', 'es', suggestion);

      expect(response).toEqual({ type: 'answer', message: '¡Listo! He creado un borrador para ti.' });
      expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('suggestion-user', expect.objectContaining({ pendingSuggestion: undefined }));
    });
    it('Scenario: Given a high-confidence alias suggestion with one authorized target When accepted Then creates only that personal alias', async () => {
      const internals = service as unknown as {
        handleSuggestionAccept(userId: string, language: string, value: never): Promise<{ type: string; message: string }>;
      };
      const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-desk', name: 'Luz Escritorio', type: 'light', roomId: 'r1', homeId: 'h1' }),
      ]);
      mockRoomRepo.findAll.mockResolvedValue([createTestRoom({ id: 'r1', name: 'Oficina', homeId: 'h1' })]);
      mockMemory.getAlias.mockResolvedValue(null);
      mockMemory.getShortTermMemory.mockResolvedValue({
        lastQueryType: 'none', entities: [], timestamp: '2026-08-17T00:00:00.000Z',
      });
      const aliasSuggestion = {
        id: 'alias-suggestion-1',
        type: 'alias_suggestion',
        message: 'Use an alias?',
        metadata: { alias: 'escritorio', target: 'Luz Escritorio', confidence: 'high' },
      } as never;

      try {
        const response = await internals.handleSuggestionAccept('alias-user', 'es', aliasSuggestion);

        expect(mockMemory.setAlias).toHaveBeenCalledWith('alias-user', 'escritorio', 'light-desk');
        expect(response.message).toBe('Alias creado: a partir de ahora entenderé "escritorio" como "Luz Escritorio".');
      } finally {
        infoSpy.mockRestore();
      }
    });

    it('Scenario: Given an alias suggestion that collides with a device name When accepted Then keeps the device namespace unchanged', async () => {
      const internals = service as unknown as {
        handleSuggestionAccept(userId: string, language: string, value: never): Promise<{ type: string; message: string }>;
      };
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'light-desk', name: 'Luz Escritorio', type: 'light', roomId: 'r1', homeId: 'h1' }),
        createTestDevice({ id: 'light-other', name: 'Escritorio', type: 'light', roomId: 'r1', homeId: 'h1' }),
      ]);
      mockMemory.getAlias.mockResolvedValue(null);
      mockMemory.getShortTermMemory.mockResolvedValue({
        lastQueryType: 'none', entities: [], timestamp: '2026-08-17T00:00:00.000Z',
      });
      const aliasSuggestion = {
        id: 'alias-suggestion-collision',
        type: 'alias_suggestion',
        message: 'Use an alias?',
        metadata: { alias: 'escritorio', target: 'Luz Escritorio', confidence: 'high' },
      } as never;

      const response = await internals.handleSuggestionAccept('alias-user', 'es', aliasSuggestion);

      expect(mockMemory.setAlias).not.toHaveBeenCalled();
      expect(response.message).toBe('No puedo usar "escritorio" como alias porque un dispositivo ya tiene ese nombre.');
    });
    it('Scenario: Given a scene suggestion with an authorized home When accepted Then creates a reviewable scene draft', async () => {
      const internals = service as unknown as {
        handleSuggestionAccept(userId: string, language: string, value: never): Promise<{ type: string; message: string }>;
      };
      mockMemory.getShortTermMemory.mockResolvedValue({
        lastQueryType: 'none', entities: [], timestamp: '2026-08-17T00:00:00.000Z',
      });
      const sceneSuggestion = {
        id: 'scene-suggestion-1',
        type: 'scene_suggestion',
        message: 'Create a scene?',
        metadata: { homeId: 'h1', roomId: 'r1', deviceIds: ['light-desk', 'light-door'] },
      } as never;

      const response = await internals.handleSuggestionAccept('draft-user', 'en', sceneSuggestion);

      expect(mockDraftService.createDraft).toHaveBeenCalledWith('draft-user', 'scene', {
        homeId: 'h1', roomId: 'r1', deviceIds: ['light-desk', 'light-door'],
      });
      expect(response.message).toBe("I've created a scene draft with those devices. You can find it in your drafts.");
    });

    it('Scenario: Given an automation suggestion with a time When accepted Then creates a scoped automation draft', async () => {
      const internals = service as unknown as {
        handleSuggestionAccept(userId: string, language: string, value: never): Promise<{ type: string; message: string }>;
      };
      mockMemory.getShortTermMemory.mockResolvedValue({
        lastQueryType: 'none', entities: [], timestamp: '2026-08-17T00:00:00.000Z',
      });
      const automationSuggestion = {
        id: 'automation-suggestion-1',
        type: 'automation_suggestion',
        message: 'Create an automation?',
        metadata: { homeId: 'h1', deviceId: 'light-desk', hour: 22 },
      } as never;

      const response = await internals.handleSuggestionAccept('draft-user', 'es', automationSuggestion);

      expect(mockDraftService.createDraft).toHaveBeenCalledWith('draft-user', 'automation', {
        homeId: 'h1', deviceId: 'light-desk', hour: '22', trigger: { type: 'time', hour: 22 },
      });
      expect(response.message).toBe('He creado un borrador de automatización para ti. Puedes revisarlo en tus borradores.');
    });
    it('Scenario: Given a pending suggestion When rejected Then returns the localized acknowledgement', async () => {
      const internals = service as unknown as {
        handleSuggestionReject(userId: string, language: string, value: never): Promise<{ type: string; message: string }>;
      };

      await expect(internals.handleSuggestionReject('suggestion-user', 'es', suggestion)).resolves.toEqual({
        type: 'answer',
        message: 'Entendido, no volveré a sugerirte esto por ahora.'
      });
    });

    it('Scenario: Given a pending suggestion When postponed Then returns the localized acknowledgement', async () => {
      const internals = service as unknown as {
        handleSuggestionPostpone(userId: string, language: string, value: never): Promise<{ type: string; message: string }>;
      };

      await expect(internals.handleSuggestionPostpone('suggestion-user', 'en', suggestion)).resolves.toEqual({
        type: 'answer',
        message: "Okay, I'll remind you later."
      });
    });
  });
  describe('Feature: suggestion attachment guards', () => {
    it('Scenario: Given no prior memory When a suggestion is available Then stores a fresh pending suggestion and appends its hint', async () => {
      const internals = service as unknown as {
        suggestionService: { getSuggestion: jest.Mock };
        attachSuggestionIfNeeded(response: { type: 'answer'; message: string }, userId: string, language: string, memory: null, context: 'command'): Promise<{ type: string; message: string }>;
      };
      internals.suggestionService.getSuggestion.mockResolvedValue({
        id: 'fresh-suggestion', type: 'scene_suggestion', message: 'Create a scene?', metadata: {}
      });

      const response = await internals.attachSuggestionIfNeeded({ type: 'answer', message: 'Done.' }, 'suggestion-user', 'en', null, 'command');

      expect(response.message).toContain('💡 Create a scene?');
      expect(response.message).toContain('You can reply:');
      expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('suggestion-user', expect.objectContaining({
        lastQueryType: 'none',
        pendingSuggestion: expect.objectContaining({ id: 'fresh-suggestion' })
      }));
    });

    it('Scenario: Given an eligible response When no suggestion is returned Then preserves the response unchanged', async () => {
      const internals = service as unknown as {
        suggestionService: { getSuggestion: jest.Mock };
        attachSuggestionIfNeeded(response: { type: 'answer'; message: string }, userId: string, language: string, memory: null, context: 'command'): Promise<{ type: string; message: string }>;
      };
      internals.suggestionService.getSuggestion.mockResolvedValue(null);

      await expect(internals.attachSuggestionIfNeeded({ type: 'answer', message: 'Done.' }, 'suggestion-user', 'es', null, 'command')).resolves.toEqual({
        type: 'answer', message: 'Done.'
      });
      expect(mockMemory.saveShortTermMemory).not.toHaveBeenCalled();
    });
  });
describe('Feature: interpreter ambiguity persistence', () => {
  it('Scenario: Given an ambiguous interpreter outcome When a control request arrives Then it persists choices and returns a localized clarification', async () => {
    const internals = service as unknown as {
      attemptFastPathExecution: (prompt: string, userId: string, language: string, userName: string | null) => Promise<null>;
      attemptDeviceAliasFastPathExecution: (prompt: string, userId: string, language: string, aliases: unknown) => Promise<null>;
      attemptContextRoomFastPathExecution: (prompt: string, sourceRoomId: string | undefined, userId: string, userName: string | null, language: string, aliases: unknown) => Promise<null>;
      applySafetyGateV2: (prompt: string, userId: string, language: string, request: unknown) => Promise<null>;
      attemptV2HybridExecution: (prompt: string, userId: string, language: string, userName: string | null, memory: unknown) => Promise<null>;
    };
    jest.spyOn(internals, 'attemptFastPathExecution').mockResolvedValue(null);
    jest.spyOn(internals, 'attemptDeviceAliasFastPathExecution').mockResolvedValue(null);
    jest.spyOn(internals, 'attemptContextRoomFastPathExecution').mockResolvedValue(null);
    jest.spyOn(internals, 'applySafetyGateV2').mockResolvedValue(null);
    jest.spyOn(internals, 'attemptV2HybridExecution').mockResolvedValue(null);
    mockInterpreter.interpret.mockResolvedValue({
      type: 'clarificationRequired',
      originalSegment: 'iluminación principal',
      options: [
        { id: 'light-1', label: 'Luz Sala', kind: 'device' },
        { id: 'light-2', label: 'Luz Cocina', kind: 'device' },
      ],
    });

    const response = await service.converse({
      prompt: 'enciende iluminación principal',
      userId: 'clarification-user',
    }, 'es');

    expect(response).toEqual(expect.objectContaining({
      type: 'clarification',
      message: expect.stringContaining('Encontré varias opciones'),
      clarification: expect.objectContaining({
        options: expect.arrayContaining([
          expect.objectContaining({ id: 'light-1', label: 'Luz Sala', kind: 'device' }),
        ]),
      }),
    }));
    expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('clarification-user', expect.objectContaining({
      lastQueryType: 'clarification',
      originalPrompt: 'enciende iluminación principal',
      pendingIntent: expect.objectContaining({ command: 'turn_on' }),
    }));
  });

  it('Scenario: Given an interpreter failure When a control request reaches the semantic fallback Then returns its safe error without dispatching', async () => {
    const internals = service as unknown as {
      attemptFastPathExecution: (prompt: string, userId: string, language: string, userName: string | null) => Promise<null>;
      attemptDeviceAliasFastPathExecution: (prompt: string, userId: string, language: string, aliases: unknown) => Promise<null>;
      attemptContextRoomFastPathExecution: (prompt: string, sourceRoomId: string | undefined, userId: string, userName: string | null, language: string, aliases: unknown) => Promise<null>;
      applySafetyGateV2: (prompt: string, userId: string, language: string, request: unknown) => Promise<null>;
      attemptV2HybridExecution: (prompt: string, userId: string, language: string, userName: string | null, memory: unknown) => Promise<null>;
    };
    jest.spyOn(internals, 'attemptFastPathExecution').mockResolvedValue(null);
    jest.spyOn(internals, 'attemptDeviceAliasFastPathExecution').mockResolvedValue(null);
    jest.spyOn(internals, 'attemptContextRoomFastPathExecution').mockResolvedValue(null);
    jest.spyOn(internals, 'applySafetyGateV2').mockResolvedValue(null);
    jest.spyOn(internals, 'attemptV2HybridExecution').mockResolvedValue(null);
    mockInterpreter.interpret.mockResolvedValue({ type: 'failure', message: 'Semantic resolver unavailable' });

    await expect(service.converse({ prompt: 'controla iluminación principal', userId: 'failure-user' }, 'es')).resolves.toEqual({
      type: 'error',
      message: 'Semantic resolver unavailable',
    });
    expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
  });
});
  it('preserves a climate parameter through authorized transient-scene execution', async () => {
    const climate = createTestDevice({ id: 'climate-1', type: 'climate', homeId: 'h1', name: 'Aire Sala' });
    mockDeviceRepo.findDeviceById.mockResolvedValue(climate);
    const internals = service as unknown as {
      executeAuthorizedCommand(userId: string, deviceId: string, command: 'set_temperature', prompt: string, correlationId: string, params: Record<string, unknown>): Promise<unknown>;
    };

    await internals.executeAuthorizedCommand('user-1', climate.id, 'set_temperature', 'pon aire sala a 22 grados', 'climate-parameter-test', { temperature: 22 });

    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(climate.id, expect.objectContaining({
      name: 'set_temperature',
      params: { temperature: 22 },
    }));
  });
  describe('Feature: authorized sensor reading queries', () => {
    it('Scenario: Given an authorized Spanish temperature sensor When its reading is requested Then reports its persisted value and unit without dispatching', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({
          id: 'temperature-sala',
          name: 'Temperatura Sala',
          type: 'sensor',
          lastKnownState: { state: 22.5, attributes: { unit_of_measurement: '°C' } },
        }),
      ]);

      await expect(service.converse({ prompt: 'cual es la temperatura de sala', userId: 'sensor-reader' }, 'es')).resolves.toEqual({
        type: 'answer',
        message: 'La lectura de Temperatura Sala es 22.5 °C.',
      });
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('Scenario: Given an authorized English humidity sensor When its reading is requested Then reports its persisted value and unit', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({
          id: 'humidity-patio',
          name: 'Patio Humidity',
          type: 'sensor',
          lastKnownState: { state: 56, attributes: { unit_of_measurement: '%' } },
        }),
      ]);

      await expect(service.converse({ prompt: 'what is the patio humidity', userId: 'sensor-reader' }, 'en')).resolves.toEqual({
        type: 'answer',
        message: 'The Patio Humidity reading is 56 %.',
      });
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('Scenario: Given multiple authorized matching sensors When a reading is requested Then saves a bounded clarification without dispatching', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'temperature-sala', name: 'Temperatura Sala', type: 'sensor', lastKnownState: { state: 22 } }),
        createTestDevice({ id: 'temperature-patio', name: 'Temperatura Patio', type: 'sensor', lastKnownState: { state: 24 } }),
      ]);

      const response = await service.converse({ prompt: 'cual es la temperatura', userId: 'sensor-reader' }, 'es');

      expect(response).toMatchObject({
        type: 'clarification',
        message: 'Encontré varias lecturas de sensores. ¿A cuál te refieres?',
        clarification: { options: [{ id: 'temperature-sala' }, { id: 'temperature-patio' }] },
      });
      expect(mockMemory.saveShortTermMemory).toHaveBeenCalledWith('sensor-reader', expect.objectContaining({
        source: 'sensor_reading',
        clarificationOptions: expect.arrayContaining([expect.objectContaining({ id: 'temperature-sala' })]),
      }));
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('Scenario: Given an unavailable sensor When its reading is requested Then returns availability without dispatching', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({ id: 'temperature-sala', name: 'Temperatura Sala', type: 'sensor', lastKnownState: { state: 'unavailable' } }),
      ]);

      await expect(service.converse({ prompt: 'dime la temperatura de sala', userId: 'sensor-reader' }, 'es')).resolves.toEqual({
        type: 'answer',
        message: 'La lectura de Temperatura Sala no está disponible.',
      });
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('Scenario: Given a stored sensor clarification When its option is selected Then revalidates the authorized sensor and returns only its reading', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        createTestDevice({
          id: 'humidity-patio',
          name: 'Patio Humidity',
          type: 'sensor',
          lastKnownState: { state: 56, attributes: { unit_of_measurement: '%' } },
        }),
      ]);
      mockMemory.getShortTermMemory.mockResolvedValue({
        lastQueryType: 'sensor_reading',
        source: 'sensor_reading',
        entities: [],
        clarificationOptions: [{ id: 'humidity-patio', label: 'Patio Humidity', kind: 'device' }],
        timestamp: new Date().toISOString(),
      });

      await expect(service.converse({ prompt: 'Patio Humidity', selectedOptionId: 'humidity-patio', userId: 'sensor-reader' }, 'en')).resolves.toEqual({
        type: 'answer',
        message: 'The Patio Humidity reading is 56 %.',
      });
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('Scenario: Given no authorized matching sensor When a reading is requested Then does not disclose any value', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([]);

      await expect(service.converse({ prompt: 'what is the humidity', userId: 'sensor-reader' }, 'en')).resolves.toEqual({
        type: 'answer',
        message: 'I could not find an authorized sensor reading for that request.',
      });
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });
});
