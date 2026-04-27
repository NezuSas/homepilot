import type { Device } from '../../devices/domain/types';
import type { Scene } from '../../devices/domain/Scene';
import type { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import type { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import type { OllamaClientPort } from '../application/ports/OllamaClientPort';
import type { AssistantContextBuilderPort } from '../application/ports/AssistantContextBuilderPort';
import type { LlmIntentInterpreterPort } from '../application/ports/LlmIntentInterpreterPort';
import type { AssistantMemoryPort } from '../application/ports/AssistantMemoryPort';
import type { AssistantConfirmationPolicyPort } from '../application/ports/AssistantConfirmationPolicyPort';
import type { DeviceCommandDispatcherPort } from '../../devices/application/ports/DeviceCommandDispatcherPort';
import type { IntentInterpreterPort } from '../application/ports/IntentInterpreterPort';
import type { AssistantSmallTalkPort } from '../application/ports/AssistantSmallTalkPort';
import type { RoomRepository } from '../../topology/domain/repositories/RoomRepository';
import { FollowUpResolverPort } from '../application/ports/FollowUpResolverPort';
import { ExecutionRecordRepository } from '../../devices/domain/repositories/ExecutionRecordRepository';

/**
 * Shared test helpers for Assistant tests to avoid 'as any' and duplicate definitions.
 */

export const createTestDevice = (overrides?: Partial<Device>): Device => ({
  id: 'dev-1',
  homeId: 'h1',
  roomId: null,
  externalId: 'ext-1',
  name: 'Device',
  type: 'light',
  vendor: 'v',
  status: 'ASSIGNED',
  integrationSource: 'ha',
  invertState: false,
  lastKnownState: null,
  capabilities: [],
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
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

/**
 * Mock Factories using Ports/Interfaces to avoid casting private members.
 */

export const createMockDeviceRepository = (
  overrides?: Partial<jest.Mocked<DeviceRepository>>
): jest.Mocked<DeviceRepository> => {
  const mock: jest.Mocked<DeviceRepository> = {
    saveDevice: jest.fn(),
    findDeviceById: jest.fn(),
    findInboxByHomeId: jest.fn(),
    findByExternalIdAndHomeId: jest.fn(),
    findByExternalId: jest.fn(),
    findAll: jest.fn(),
    findAllOrderedByStatus: jest.fn(),
    findAllByHomeId: jest.fn(),
    findAllExternalIdsByPrefix: jest.fn(),
    ...overrides
  };
  return mock;
};

export const createMockSceneRepository = (
  overrides?: Partial<jest.Mocked<SceneRepository>>
): jest.Mocked<SceneRepository> => {
  const mock: jest.Mocked<SceneRepository> = {
    findSceneById: jest.fn(),
    findScenesByHomeId: jest.fn(),
    findAll: jest.fn(),
    saveScene: jest.fn(),
    deleteScene: jest.fn(),
    ...overrides
  };
  return mock;
};

export const createMockOllamaClient = (
  overrides?: Partial<jest.Mocked<OllamaClientPort>>
): jest.Mocked<OllamaClientPort> => {
  const mock: jest.Mocked<OllamaClientPort> = {
    generateJson: jest.fn(),
    ...overrides
  };
  return mock;
};

export const createMockAssistantContextBuilder = (
  overrides?: Partial<jest.Mocked<AssistantContextBuilderPort>>
): jest.Mocked<AssistantContextBuilderPort> => {
  const mock: jest.Mocked<AssistantContextBuilderPort> = {
    build: jest.fn(),
    ...overrides
  };
  return mock;
};

export const createMockLlmIntentInterpreter = (
  overrides?: Partial<jest.Mocked<LlmIntentInterpreterPort>>
): jest.Mocked<LlmIntentInterpreterPort> => {
  const mock: jest.Mocked<LlmIntentInterpreterPort> = {
    interpret: jest.fn(),
    ...overrides
  };
  return mock;
};

export const createMockAssistantMemory = (
  overrides?: Partial<jest.Mocked<AssistantMemoryPort>>
): jest.Mocked<AssistantMemoryPort> => {
  const mock: jest.Mocked<AssistantMemoryPort> = {
    getRecentActions: jest.fn(),
    getLastDeviceUsed: jest.fn(),
    getLastSceneUsed: jest.fn(),
    saveShortTermMemory: jest.fn().mockResolvedValue(undefined),
    getShortTermMemory: jest.fn().mockResolvedValue(null),
    getUserPreference: jest.fn().mockResolvedValue(null),
    setUserPreference: jest.fn().mockResolvedValue(undefined),
    getAlias: jest.fn().mockResolvedValue(null),
    getAliases: jest.fn().mockResolvedValue({}),
    setAlias: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
  return mock;
};

export const createMockFollowUpResolver = (
  overrides?: Partial<jest.Mocked<FollowUpResolverPort>>
): jest.Mocked<FollowUpResolverPort> => {
  const mock: jest.Mocked<FollowUpResolverPort> = {
    resolve: jest.fn().mockImplementation((prompt) => ({
      resolvedPrompt: prompt,
      handled: false,
      referencesMemory: false
    })),
    ...overrides
  };
  return mock;
};

export const createMockAssistantConfirmationPolicy = (
  overrides?: Partial<jest.Mocked<AssistantConfirmationPolicyPort>>
): jest.Mocked<AssistantConfirmationPolicyPort> => {
  const mock: jest.Mocked<AssistantConfirmationPolicyPort> = {
    evaluate: jest.fn(),
    ...overrides
  };
  return mock;
};

export const createMockDeviceCommandDispatcher = (
  overrides?: Partial<jest.Mocked<DeviceCommandDispatcherPort>>
): jest.Mocked<DeviceCommandDispatcherPort> => {
  const mock: jest.Mocked<DeviceCommandDispatcherPort> = {
    dispatch: jest.fn(),
    ...overrides
  };
  return mock;
};

export const createMockIntentInterpreterService = (
  overrides?: Partial<jest.Mocked<IntentInterpreterPort>>
): jest.Mocked<IntentInterpreterPort> => {
  const mock: jest.Mocked<IntentInterpreterPort> = {
    interpret: jest.fn(),
    ...overrides
  };
  return mock;
};

export const createMockRoomRepository = (
  overrides?: Partial<jest.Mocked<RoomRepository>>
): jest.Mocked<RoomRepository> => {
  const mock: jest.Mocked<RoomRepository> = {
    saveRoom: jest.fn(),
    findRoomsByHomeId: jest.fn(),
    findRoomById: jest.fn(),
    findAll: jest.fn(),
    ...overrides
  };
  return mock;
};

export const createMockExecutionRecordRepository = (
  overrides?: Partial<jest.Mocked<ExecutionRecordRepository>>
): jest.Mocked<ExecutionRecordRepository> => {
  const mock: jest.Mocked<ExecutionRecordRepository> = {
    save: jest.fn(),
    findRecent: jest.fn(),
    findBySource: jest.fn(),
    findById: jest.fn(),
    ...overrides
  };
  return mock;
};

export const createMockAssistantSmallTalk = (
  overrides?: Partial<jest.Mocked<AssistantSmallTalkPort>>
): jest.Mocked<AssistantSmallTalkPort> => {
  const mock: jest.Mocked<AssistantSmallTalkPort> = {
    handle: jest.fn(),
    ...overrides
  };
  return mock;
};
