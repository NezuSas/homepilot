import { Device } from '../../devices/domain/types';
import { Scene } from '../../devices/domain/Scene';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { OllamaClientPort } from '../application/ports/OllamaClientPort';
import { AssistantContextBuilderPort } from '../application/ports/AssistantContextBuilderPort';
import { LlmIntentInterpreterPort } from '../application/ports/LlmIntentInterpreterPort';

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

import { AssistantMemoryPort } from '../application/ports/AssistantMemoryPort';

export const createMockAssistantMemoryService = (
  overrides?: Partial<jest.Mocked<AssistantMemoryPort>>
): jest.Mocked<AssistantMemoryPort> => {
  const mock: jest.Mocked<AssistantMemoryPort> = {
    getRecentActions: jest.fn(),
    getLastDeviceUsed: jest.fn(),
    getLastSceneUsed: jest.fn(),
    ...overrides
  };
  return mock;
};

import { AssistantConfirmationPolicyPort } from '../application/ports/AssistantConfirmationPolicyPort';
import { DeviceCommandDispatcherPort } from '../../devices/application/ports/DeviceCommandDispatcherPort';

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

import { IntentInterpreterPort } from '../application/ports/IntentInterpreterPort';

export const createMockIntentInterpreterService = (
  overrides?: Partial<jest.Mocked<IntentInterpreterPort>>
): jest.Mocked<IntentInterpreterPort> => {
  const mock: jest.Mocked<IntentInterpreterPort> = {
    interpret: jest.fn(),
    ...overrides
  };
  return mock;
};
import { AssistantSmallTalkPort } from '../application/ports/AssistantSmallTalkPort';

export const createMockAssistantSmallTalk = (
  overrides?: Partial<jest.Mocked<AssistantSmallTalkPort>>
): jest.Mocked<AssistantSmallTalkPort> => {
  const mock: jest.Mocked<AssistantSmallTalkPort> = {
    handle: jest.fn(),
    ...overrides
  };
  return mock;
};
