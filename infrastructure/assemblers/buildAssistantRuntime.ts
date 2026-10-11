/**
 * buildAssistantRuntime.ts
 *
 * Assembler: runtime conversacional determinista del asistente (intérprete de
 * intents, voz y servicio de conversación).
 * Complementa a buildAssistantModule, que cubre detección y borradores.
 */
import { randomUUID } from 'crypto';
import { IntentInterpreterService } from '../../packages/assistant/application/IntentInterpreterService';
import { AssistantMultiCommandParser } from '../../packages/assistant/application/AssistantMultiCommandParser';
import { AssistantConfirmationPolicy } from '../../packages/assistant/application/AssistantConfirmationPolicy';
import { AssistantMemoryService } from '../../packages/assistant/application/AssistantMemoryService';
import { AssistantConversationService } from '../../packages/assistant/application/AssistantConversationService';
import { DomesticSkillResolver } from '../../packages/assistant/application/DomesticSkillResolver';
import { PermissionGate, type RoomScopeProvider } from '../../packages/assistant/application/PermissionGate';
import { AssistantFastPathResolver } from '../../packages/assistant/application/AssistantFastPathResolver';
import { AssistantAliasManagementService } from '../../packages/assistant/application/AssistantAliasManagementService';
import { AssistantSmallTalkService } from '../../packages/assistant/application/AssistantSmallTalkService';
import { TopologyRoomManagementAdapter } from '../../packages/assistant/infrastructure/TopologyRoomManagementAdapter';
import { FollowUpResolver } from '../../packages/assistant/application/FollowUpResolver';
import { AssistantTextToSpeechService } from '../../packages/assistant/application/AssistantTextToSpeechService';
import { AssistantSpeechToTextService } from '../../packages/assistant/application/AssistantSpeechToTextService';
import { AssistantLearningService } from '../../packages/assistant/application/AssistantLearningService';
import { SmartEntityResolver } from '../../packages/assistant/application/SmartEntityResolver';
import { AssistantSuggestionService } from '../../packages/assistant/application/AssistantSuggestionService';
import type { RepositoriesAssembly } from './buildRepositories';
import type { AssistantDraftService } from '../../packages/assistant/application/AssistantDraftService';
import type { DeviceCommandService } from '../../packages/devices/application/DeviceCommandService';
import type { SceneExecutionService } from '../../packages/devices/application/SceneExecutionService';
import type { SystemVariableService } from '../../packages/system-vars/application/SystemVariableService';
import type { EventBusTopologyEventPublisher } from '../../packages/topology/infrastructure/adapters/EventBusTopologyEventPublisher';

export interface AssistantRuntimeAssembly {
  intentInterpreterService: IntentInterpreterService;
  assistantConfirmationPolicy: AssistantConfirmationPolicy;
  assistantConversationService: AssistantConversationService;
  assistantTextToSpeechService: AssistantTextToSpeechService;
  assistantSpeechToTextService: AssistantSpeechToTextService;
}

export interface AssistantRuntimeDeps {
  repos: RepositoriesAssembly;
  assistantDraftService: AssistantDraftService;
  commandDispatcher: DeviceCommandService;
  sceneExecutionService: SceneExecutionService;
  systemVariableService: SystemVariableService;
  topologyEventPublisher: EventBusTopologyEventPublisher;
  /** Rooms each user is limited to; absent means everyone sees the whole home. */
  roomScopeProvider?: RoomScopeProvider;
}

export function buildAssistantRuntime(deps: AssistantRuntimeDeps): AssistantRuntimeAssembly {
  const { repos, assistantDraftService, commandDispatcher, sceneExecutionService, systemVariableService, topologyEventPublisher, roomScopeProvider } = deps;

  const assistantMemoryService = new AssistantMemoryService(repos.executionRecordRepository, repos.assistantMemoryRepository);
  const assistantLearningService = new AssistantLearningService(repos.assistantLearningRepository);
  const smartEntityResolver = new SmartEntityResolver(
    repos.deviceRepository,
    repos.roomRepository,
    repos.sceneRepository,
    repos.automationRuleRepository,
    assistantMemoryService,
    assistantLearningService
  );
  const assistantSuggestionService = new AssistantSuggestionService(assistantLearningService, repos.deviceRepository);

  const followUpResolver = new FollowUpResolver();
  const assistantMultiCommandParser = new AssistantMultiCommandParser(repos.deviceRepository, repos.roomRepository, repos.homeRepository);
  const intentInterpreterService = new IntentInterpreterService(
    repos.deviceRepository,
    repos.sceneRepository,
    repos.roomRepository,
    assistantMultiCommandParser,
    assistantMemoryService,
    repos.homeRepository
  );

  const assistantConfirmationPolicy = new AssistantConfirmationPolicy(
    repos.sceneRepository,
    repos.deviceRepository
  );

  const assistantSmallTalkService = new AssistantSmallTalkService();

  const assistantTextToSpeechService = new AssistantTextToSpeechService();
  const assistantSpeechToTextService = new AssistantSpeechToTextService();

  const assistantPermissionGate = new PermissionGate(
    repos.deviceRepository,
    repos.roomRepository,
    repos.sceneRepository,
    repos.automationRuleRepository,
    repos.homeRepository,
    roomScopeProvider
  );
  const domesticSkillResolver = new DomesticSkillResolver(assistantPermissionGate);
  const assistantFastPathResolver = new AssistantFastPathResolver();
  const assistantAliasManagementService = new AssistantAliasManagementService(
    assistantMemoryService,
    repos.deviceRepository,
    repos.roomRepository
  );
  const roomManagementService = new TopologyRoomManagementAdapter({
    homeRepository: repos.homeRepository,
    roomRepository: repos.roomRepository,
    eventPublisher: topologyEventPublisher,
    idGenerator: { generate: () => randomUUID() },
    clock: { now: () => new Date().toISOString() }
  });
  const assistantConversationService = new AssistantConversationService(
    intentInterpreterService,
    assistantConfirmationPolicy,
    sceneExecutionService,
    commandDispatcher,
    repos.deviceRepository,
    repos.roomRepository,
    repos.sceneRepository,
    assistantSmallTalkService,
    assistantMemoryService,
    followUpResolver,
    assistantDraftService,
    repos.automationRuleRepository,
    assistantLearningService,
    smartEntityResolver,
    assistantSuggestionService,
    repos.executionRecordRepository,
    systemVariableService,
    assistantFastPathResolver,
    assistantAliasManagementService,
    repos.homeRepository,
    repos.confirmationTicketRepository,
    domesticSkillResolver,
    roomManagementService,
    undefined,
    roomScopeProvider
  );

  return {
    intentInterpreterService,
    assistantConfirmationPolicy,
    assistantConversationService,
    assistantTextToSpeechService,
    assistantSpeechToTextService,
  };
}
