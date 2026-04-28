/// <reference types="jest" />
import { Device } from '../../devices/domain/types';
import { Room } from '../../topology/domain/types';
import { Scene } from '../../devices/domain/Scene';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { RoomRepository } from '../../topology/domain/repositories/RoomRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { AutomationRuleRepository } from '../../devices/domain/repositories/AutomationRuleRepository';
import { AssistantMemoryPort } from '../application/ports/AssistantMemoryPort';
import { IntentInterpreterPort } from '../application/ports/IntentInterpreterPort';
import { AssistantConfirmationPolicyPort } from '../application/ports/AssistantConfirmationPolicyPort';
import { AssistantSmallTalkPort } from '../application/ports/AssistantSmallTalkPort';
import { FollowUpResolverPort } from '../application/ports/FollowUpResolverPort';
import { AssistantLearningService } from '../application/AssistantLearningService';
import { SmartEntityResolver } from '../application/SmartEntityResolver';
import { AssistantSuggestionService } from '../application/AssistantSuggestionService';
import { ExecutionRecordRepository } from '../../devices/domain/repositories/ExecutionRecordRepository';
import { DeviceCommandDispatcherPort } from '../../devices/application/ports/DeviceCommandDispatcherPort';
import { SceneExecutionService } from '../../devices/application/SceneExecutionService';
import { OllamaClientPort } from '../application/ports/OllamaClientPort';
import { AssistantContextBuilderPort } from '../application/ports/AssistantContextBuilderPort';
import { LlmIntentInterpreterPort } from '../application/ports/LlmIntentInterpreterPort';

import { AssistantDraftService } from '../application/AssistantDraftService';
import { AssistantDraftRepository } from '../domain/repositories/AssistantDraftRepository';
import { AssistantLearningRepository } from '../domain/repositories/AssistantLearningRepository';

export const createTestDevice = (overrides?: Partial<Device>): Device => ({
  id: 'dev-1',
  homeId: 'h1',
  externalId: 'ext-1',
  name: 'Device',
  type: 'light',
  roomId: 'r1',
  vendor: 'generic',
  status: 'ASSIGNED',
  integrationSource: 'test',
  invertState: false,
  capabilities: [],
  lastKnownState: { on: false },
  entityVersion: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

export const createTestRoom = (overrides?: Partial<Room>): Room => ({
  id: 'room-1',
  homeId: 'h1',
  name: 'Room',
  entityVersion: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

export const createTestScene = (overrides?: Partial<Scene>): Scene => ({
  id: 'scene-1',
  homeId: 'h1',
  roomId: null,
  name: 'Scene',
  actions: [],
  executionMode: 'parallel',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

export const createMockDeviceRepository = (overrides?: Partial<jest.Mocked<DeviceRepository>>): jest.Mocked<DeviceRepository> => ({
  findAll: jest.fn().mockResolvedValue([]),
  findDeviceById: jest.fn().mockResolvedValue(null),
  findAllByHomeId: jest.fn().mockResolvedValue([]),
  saveDevice: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
  ...overrides
} as jest.Mocked<DeviceRepository>);

export const createMockRoomRepository = (overrides?: Partial<jest.Mocked<RoomRepository>>): jest.Mocked<RoomRepository> => ({
  findAll: jest.fn().mockResolvedValue([]),
  findRoomsByHomeId: jest.fn().mockResolvedValue([]),
  findById: jest.fn().mockResolvedValue(null),
  save: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
  ...overrides
} as jest.Mocked<RoomRepository>);

export const createMockSceneRepository = (overrides?: Partial<jest.Mocked<SceneRepository>>): jest.Mocked<SceneRepository> => ({
  findAll: jest.fn().mockResolvedValue([]),
  findSceneById: jest.fn().mockResolvedValue(null),
  findScenesByHomeId: jest.fn().mockResolvedValue([]),
  saveScene: jest.fn().mockResolvedValue(undefined),
  deleteScene: jest.fn().mockResolvedValue(undefined),
  ...overrides
} as jest.Mocked<SceneRepository>);

export const createMockAutomationRuleRepository = (overrides?: Partial<jest.Mocked<AutomationRuleRepository>>): jest.Mocked<AutomationRuleRepository> => ({
  save: jest.fn().mockResolvedValue(undefined),
  findById: jest.fn().mockResolvedValue(null),
  findByTriggerDevice: jest.fn().mockResolvedValue([]),
  findByHomeId: jest.fn().mockResolvedValue([]),
  findAll: jest.fn().mockResolvedValue([]),
  delete: jest.fn().mockResolvedValue(undefined),
  ...overrides
} as jest.Mocked<AutomationRuleRepository>);

export const createMockAssistantMemory = (overrides?: Partial<jest.Mocked<AssistantMemoryPort>>): jest.Mocked<AssistantMemoryPort> => ({
  getShortTermMemory: jest.fn().mockResolvedValue(null),
  saveShortTermMemory: jest.fn().mockResolvedValue(undefined),
  clearShortTermMemory: jest.fn().mockResolvedValue(undefined),
  getAlias: jest.fn().mockResolvedValue(null),
  getAliases: jest.fn().mockResolvedValue({}),
  setAlias: jest.fn().mockResolvedValue(undefined),
  deleteAlias: jest.fn().mockResolvedValue(undefined),
  getRecentActions: jest.fn().mockResolvedValue([]),
  getLastDeviceUsed: jest.fn().mockResolvedValue(null),
  getLastSceneUsed: jest.fn().mockResolvedValue(null),
  getUserPreference: jest.fn().mockResolvedValue(null),
  setUserPreference: jest.fn().mockResolvedValue(undefined),
  ...overrides
} as jest.Mocked<AssistantMemoryPort>);

export const createMockIntentInterpreterService = (overrides?: Partial<jest.Mocked<IntentInterpreterPort>>): jest.Mocked<IntentInterpreterPort> => ({
  interpret: jest.fn().mockResolvedValue({ type: 'unknown' }),
  ...overrides
} as jest.Mocked<IntentInterpreterPort>);

export const createMockAssistantConfirmationPolicy = (overrides?: Partial<jest.Mocked<AssistantConfirmationPolicyPort>>): jest.Mocked<AssistantConfirmationPolicyPort> => ({
  evaluate: jest.fn().mockResolvedValue({ requiresConfirmation: false, reason: '', summary: '' }),
  ...overrides
} as jest.Mocked<AssistantConfirmationPolicyPort>);

export const createMockDeviceCommandDispatcher = (overrides?: Partial<jest.Mocked<DeviceCommandDispatcherPort>>): jest.Mocked<DeviceCommandDispatcherPort> => ({
  dispatch: jest.fn().mockResolvedValue({ status: 'success', actions: [] }),
  ...overrides
} as jest.Mocked<DeviceCommandDispatcherPort>);

export const createMockAssistantSmallTalk = (overrides?: Partial<jest.Mocked<AssistantSmallTalkPort>>): jest.Mocked<AssistantSmallTalkPort> => ({
  handle: jest.fn().mockResolvedValue({ type: 'answer', message: 'Hello' }),
  ...overrides
} as jest.Mocked<AssistantSmallTalkPort>);

export const createMockFollowUpResolver = (overrides?: Partial<jest.Mocked<FollowUpResolverPort>>): jest.Mocked<FollowUpResolverPort> => ({
  resolve: jest.fn().mockImplementation((prompt: string) => ({ handled: false, resolvedPrompt: prompt, referencesMemory: false })),
  ...overrides
} as jest.Mocked<FollowUpResolverPort>);

export const createMockAssistantLearningService = (overrides?: Partial<jest.Mocked<AssistantLearningService>>): jest.Mocked<AssistantLearningService> => ({
  recordDeviceUsed: jest.fn().mockResolvedValue(undefined),
  recordSceneUsed: jest.fn().mockResolvedValue(undefined),
  recordClarificationSelected: jest.fn().mockResolvedValue(undefined),
  recordAliasCreated: jest.fn().mockResolvedValue(undefined),
  recordCorrection: jest.fn().mockResolvedValue(undefined),
  recordCommandResult: jest.fn().mockResolvedValue(undefined),
  recordSuggestionResponse: jest.fn().mockResolvedValue(undefined),
  computeModifiers: jest.fn().mockResolvedValue({ typeModifiers: {}, explanations: {} }),
  getMostUsedDevices: jest.fn().mockResolvedValue([]),
  getMostUsedRooms: jest.fn().mockResolvedValue([]),
  getRecentCorrections: jest.fn().mockResolvedValue([]),
  getEventsInTimeRange: jest.fn().mockResolvedValue([]),
  ...overrides
} as unknown as jest.Mocked<AssistantLearningService>);

export const createMockAssistantLearningRepository = (overrides?: Partial<jest.Mocked<AssistantLearningRepository>>): jest.Mocked<AssistantLearningRepository> => ({
  save: jest.fn().mockResolvedValue(undefined),
  findByUserId: jest.fn().mockResolvedValue([]),
  getMostUsedEntities: jest.fn().mockResolvedValue([]),
  getMostUsedRooms: jest.fn().mockResolvedValue([]),
  getRecentCorrections: jest.fn().mockResolvedValue([]),
  ...overrides
} as jest.Mocked<AssistantLearningRepository>);

export const createMockAssistantDraftRepository = (overrides?: Partial<jest.Mocked<AssistantDraftRepository>>): jest.Mocked<AssistantDraftRepository> => ({
  save: jest.fn().mockResolvedValue(undefined),
  findById: jest.fn().mockResolvedValue(null),
  findByFingerprint: jest.fn().mockResolvedValue(null),
  updateStatus: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
  ...overrides
} as jest.Mocked<AssistantDraftRepository>);

export const createMockAssistantDraftService = (overrides?: Partial<jest.Mocked<AssistantDraftService>>): jest.Mocked<AssistantDraftService> => ({
  createAutomationDraft: jest.fn().mockResolvedValue({ id: 'd1', status: 'draft' }),
  createSceneDraft: jest.fn().mockResolvedValue({ id: 'd1', status: 'draft' }),
  createDraft: jest.fn().mockResolvedValue(undefined),
  activateDraft: jest.fn().mockResolvedValue(undefined),
  ...overrides
} as unknown as jest.Mocked<AssistantDraftService>);

export const createMockSmartEntityResolver = (overrides?: Partial<jest.Mocked<SmartEntityResolver>>): jest.Mocked<SmartEntityResolver> => ({
  resolveDevice: jest.fn().mockResolvedValue({ type: 'none' }),
  resolveRoom: jest.fn().mockResolvedValue({ type: 'none' }),
  resolveScene: jest.fn().mockResolvedValue({ type: 'none' }),
  ...overrides
} as unknown as jest.Mocked<SmartEntityResolver>);

export const createRealSmartEntityResolver = (
  deviceRepo: DeviceRepository,
  roomRepo: RoomRepository,
  sceneRepo: SceneRepository,
  automationRepo: AutomationRuleRepository,
  memory: AssistantMemoryPort,
  learning: AssistantLearningService
): SmartEntityResolver => {
  const { SmartEntityResolver: Resolver } = require('../application/SmartEntityResolver');
  return new Resolver(deviceRepo, roomRepo, sceneRepo, automationRepo, memory, learning);
};

export const createMockAssistantSuggestionService = (overrides?: Partial<jest.Mocked<AssistantSuggestionService>>): jest.Mocked<AssistantSuggestionService> => ({
  getSuggestion: jest.fn().mockResolvedValue(null),
  ...overrides
} as unknown as jest.Mocked<AssistantSuggestionService>);

export const createMockExecutionRecordRepository = (overrides?: Partial<jest.Mocked<ExecutionRecordRepository>>): jest.Mocked<ExecutionRecordRepository> => ({
  save: jest.fn().mockResolvedValue(undefined),
  findRecent: jest.fn().mockResolvedValue([]),
  findBySource: jest.fn().mockResolvedValue([]),
  findById: jest.fn().mockResolvedValue(null),
  ...overrides
} as jest.Mocked<ExecutionRecordRepository>);

export const createMockOllamaClient = (overrides?: Partial<jest.Mocked<OllamaClientPort>>): jest.Mocked<OllamaClientPort> => ({
  chat: jest.fn().mockResolvedValue({ message: { content: 'LLM response' } }),
  generateJson: jest.fn().mockResolvedValue({ text: 'LLM response' }),
  ...overrides
} as jest.Mocked<OllamaClientPort>);

export const createMockAssistantContextBuilder = (overrides?: Partial<jest.Mocked<AssistantContextBuilderPort>>): jest.Mocked<AssistantContextBuilderPort> => ({
  build: jest.fn().mockResolvedValue('Context'),
  ...overrides
} as jest.Mocked<AssistantContextBuilderPort>);

export const createMockIntentInterpreterPort = (overrides?: Partial<jest.Mocked<IntentInterpreterPort>>): jest.Mocked<IntentInterpreterPort> => ({
  interpret: jest.fn().mockResolvedValue({ type: 'unknown' }),
  ...overrides
} as jest.Mocked<IntentInterpreterPort>);

export const createMockLlmIntentInterpreter = (overrides?: Partial<jest.Mocked<LlmIntentInterpreterPort>>): jest.Mocked<LlmIntentInterpreterPort> => ({
  interpret: jest.fn().mockResolvedValue({ type: 'unknown' }),
  ...overrides
} as jest.Mocked<LlmIntentInterpreterPort>);

export const createMockSceneExecutionService = (overrides?: Partial<jest.Mocked<SceneExecutionService>>): jest.Mocked<SceneExecutionService> => ({
  execute: jest.fn().mockResolvedValue({ sceneId: 's1', status: 'success', actions: [] }),
  ...overrides
} as unknown as jest.Mocked<SceneExecutionService>);
