/**
 * buildAssistantRuntime.ts
 *
 * Assembler: runtime conversacional del asistente (LLM, intérprete de intents,
 * planner V2 en sombra, voz y servicio de conversación).
 * Complementa a buildAssistantModule, que cubre detección y borradores.
 */
import { randomUUID } from 'crypto';
import { IntentInterpreterService } from '../../packages/assistant/application/IntentInterpreterService';
import { AssistantMultiCommandParser } from '../../packages/assistant/application/AssistantMultiCommandParser';
import { OllamaClient } from '../../packages/assistant/infrastructure/OllamaClient';
import { CloudflareWorkersAiClient } from '../../packages/assistant/infrastructure/CloudflareWorkersAiClient';
import { AssistantContextBuilder } from '../../packages/assistant/application/AssistantContextBuilder';
import { LlmIntentInterpreter } from '../../packages/assistant/application/LlmIntentInterpreter';
import { AssistantConfirmationPolicy } from '../../packages/assistant/application/AssistantConfirmationPolicy';
import { AssistantMemoryService } from '../../packages/assistant/application/AssistantMemoryService';
import { AssistantConversationService } from '../../packages/assistant/application/AssistantConversationService';
import { DomesticSkillResolver } from '../../packages/assistant/application/DomesticSkillResolver';
import { PermissionGate } from '../../packages/assistant/application/PermissionGate';
import { AssistantFastPathResolver } from '../../packages/assistant/application/AssistantFastPathResolver';
import { AssistantAliasManagementService } from '../../packages/assistant/application/AssistantAliasManagementService';
import { AssistantSmallTalkService } from '../../packages/assistant/application/AssistantSmallTalkService';
import { TopologyRoomManagementAdapter } from '../../packages/assistant/infrastructure/TopologyRoomManagementAdapter';
import { FollowUpResolver } from '../../packages/assistant/application/FollowUpResolver';
import { PlannerV2Validator } from '../../packages/assistant/application/PlannerV2Validator';
import { PlannerV2Resolver } from '../../packages/assistant/application/PlannerV2Resolver';
import { AssistantPlannerV2ShadowService } from '../../packages/assistant/application/AssistantPlannerV2ShadowService';
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
  shadowService: AssistantPlannerV2ShadowService;
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
}

export function buildAssistantRuntime(deps: AssistantRuntimeDeps): AssistantRuntimeAssembly {
  const { repos, assistantDraftService, commandDispatcher, sceneExecutionService, systemVariableService, topologyEventPublisher } = deps;

  const ollamaClient = new OllamaClient(
    process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    process.env.OLLAMA_MODEL || 'phi3',
    parseInt(process.env.OLLAMA_TIMEOUT_MS || '15000')
  );

  if (process.env.OLLAMA_ENABLED === 'true') {
    console.log(`[Assistant] Ollama enabled: model=${process.env.OLLAMA_MODEL || 'phi3'}, baseUrl=${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}`);
    if (process.env.OLLAMA_PREWARM !== 'false') {
      void ollamaClient.warmUp().then(
        () => console.log('[Assistant] Ollama model is ready for local conversations.'),
        () => console.warn('[Assistant] Ollama prewarm unavailable; deterministic assistant flows remain ready.')
      );
    }
  }
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
  const contextBuilder = new AssistantContextBuilder(repos.deviceRepository, repos.sceneRepository, assistantMemoryService, repos.roomRepository, repos.homeRepository);
  const llmInterpreter = new LlmIntentInterpreter(ollamaClient, contextBuilder, repos.deviceRepository, repos.sceneRepository);

  const assistantMultiCommandParser = new AssistantMultiCommandParser(repos.deviceRepository, repos.roomRepository, repos.homeRepository);
  const intentInterpreterService = new IntentInterpreterService(
    repos.deviceRepository,
    repos.sceneRepository,
    repos.roomRepository,
    assistantMultiCommandParser,
    llmInterpreter,
    assistantMemoryService,
    repos.homeRepository
  );

  const assistantConfirmationPolicy = new AssistantConfirmationPolicy(
    repos.sceneRepository,
    repos.deviceRepository
  );

  const conversationalProvider = process.env.ASSISTANT_CONVERSATIONAL_LLM_PROVIDER || 'ollama';
  const cloudflareAccountId = process.env.CLOUDFLARE_AI_ACCOUNT_ID;
  const cloudflareApiToken = process.env.CLOUDFLARE_AI_API_TOKEN;
  const conversationalLlmClient = conversationalProvider === 'cloudflare' && cloudflareAccountId && cloudflareApiToken
    ? new CloudflareWorkersAiClient(
      cloudflareAccountId,
      cloudflareApiToken,
      process.env.CLOUDFLARE_AI_MODEL || '@cf/meta/llama-3.1-8b-instruct-fast',
      parseInt(process.env.CLOUDFLARE_AI_TIMEOUT_MS || '2200')
    )
    : conversationalProvider === 'ollama'
      ? ollamaClient
      : undefined;

  if (conversationalProvider === 'cloudflare' && !conversationalLlmClient) {
    console.warn('[Assistant] Cloudflare Workers AI is selected but missing account ID or API token; using deterministic conversational fallback.');
  }

  const assistantSmallTalkService = new AssistantSmallTalkService(conversationalLlmClient, contextBuilder);

  const plannerV2Validator = new PlannerV2Validator();
  const plannerV2Resolver = new PlannerV2Resolver(repos.deviceRepository, repos.roomRepository, repos.sceneRepository, assistantMemoryService, repos.homeRepository);
  const shadowService = new AssistantPlannerV2ShadowService(llmInterpreter, plannerV2Validator, plannerV2Resolver);
  const assistantTextToSpeechService = new AssistantTextToSpeechService();
  const assistantSpeechToTextService = new AssistantSpeechToTextService();

  const assistantPermissionGate = new PermissionGate(
    repos.deviceRepository,
    repos.roomRepository,
    repos.sceneRepository,
    repos.automationRuleRepository,
    repos.homeRepository
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
    shadowService,
    assistantFastPathResolver,
    assistantAliasManagementService,
    repos.homeRepository,
    repos.confirmationTicketRepository,
    domesticSkillResolver,
    roomManagementService
  );

  return {
    intentInterpreterService,
    assistantConfirmationPolicy,
    assistantConversationService,
    shadowService,
    assistantTextToSpeechService,
    assistantSpeechToTextService,
  };
}
