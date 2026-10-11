import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { RoomRepository } from '../../topology/domain/repositories/RoomRepository';
import { HomeRepository } from '../../topology/domain/repositories/HomeRepository';
import { ConfirmationTicketRepository } from '../domain/repositories/ConfirmationTicketRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { AutomationRuleRepository } from '../../devices/domain/repositories/AutomationRuleRepository';
import { SceneExecutionService } from '../../devices/application/SceneExecutionService';
import { AssistantDraftService } from './AssistantDraftService';
import { AssistantLearningService } from './AssistantLearningService';
import { SmartEntityResolver } from './SmartEntityResolver';
import { AssistantSuggestionService } from './AssistantSuggestionService';
import { ExecutionRecordRepository } from '../../devices/domain/repositories/ExecutionRecordRepository';
import { DeviceCommandDispatcherPort } from '../../devices/application/ports/DeviceCommandDispatcherPort';
import { SystemVariableService } from '../../system-vars/application/SystemVariableService';
import { SceneExecutionResult } from '../../devices/domain/ExecutionRecord';
import { DeviceCommandV1 } from '../../devices/domain/commands';
import { Device } from '../../devices/domain/types';
import type { Intent, IntentInterpreterPort } from './ports/IntentInterpreterPort';
import type { AssistantConfirmationPolicyPort } from './ports/AssistantConfirmationPolicyPort';
import type { AssistantSmallTalkPort } from './ports/AssistantSmallTalkPort';
import type { AssistantRoomManagementPort } from './ports/AssistantRoomManagementPort';
import { AssistantMemoryPort, AssistantMemoryState } from './ports/AssistantMemoryPort';
import { FollowUpResolverPort } from './ports/FollowUpResolverPort';
import { AssistantPlannerV2ShadowService } from './AssistantPlannerV2ShadowService';
import { AssistantFastPathResolver } from './AssistantFastPathResolver';
import { AssistantMediaPlayerResolver } from './AssistantMediaPlayerResolver';
import { AssistantAliasManagementService } from './AssistantAliasManagementService';
import { DomesticSkillResolver } from './DomesticSkillResolver';
import { ScopeFilter } from './ScopeFilter';
import { PermissionGate } from './PermissionGate';
import { ConversationModules } from './conversation/ConversationModules';
import { createConversationLegacySurface } from './conversation/ConversationLegacySurface';
import type { AssistantConversationResponse, AssistantConverseRequest } from './conversation/conversationTypes';

// The conversation contracts stay importable from this module.
export type {
  AssistantConversationResponse,
  ExecutedCommandResult,
  AssistantConverseRequest,
  RoomAliasResolution
} from './conversation/conversationTypes';

/**
 * Entry point of the assistant conversation. The turn is resolved by the collaborators
 * under ./conversation, composed through ConversationModules.
 */
export class AssistantConversationService {
  constructor(
    private readonly intentInterpreter: IntentInterpreterPort,
    private readonly confirmationPolicy: AssistantConfirmationPolicyPort,
    private readonly sceneExecutionService: SceneExecutionService,
    private readonly deviceCommandDispatcher: DeviceCommandDispatcherPort,
    private readonly deviceRepository: DeviceRepository,
    private readonly roomRepository: RoomRepository,
    private readonly sceneRepository: SceneRepository,
    private readonly smallTalkService: AssistantSmallTalkPort,
    private readonly memoryService: AssistantMemoryPort,
    private readonly followUpResolver: FollowUpResolverPort,
    private readonly draftService: AssistantDraftService,
    private readonly automationRepository: AutomationRuleRepository,
    private readonly learningService: AssistantLearningService,
    private readonly entityResolver: SmartEntityResolver,
    private readonly suggestionService: AssistantSuggestionService,
    private readonly executionRecordRepository: ExecutionRecordRepository,
    private readonly systemVariableService: SystemVariableService,
    private readonly shadowService?: AssistantPlannerV2ShadowService,
    private readonly fastPathResolver: AssistantFastPathResolver = new AssistantFastPathResolver(),
    aliasManagementService?: AssistantAliasManagementService,
    private readonly homeRepository?: HomeRepository,
    private readonly confirmationTicketRepository?: ConfirmationTicketRepository,
    domesticSkillResolver?: DomesticSkillResolver,
    private readonly roomManagementService?: AssistantRoomManagementPort,
    private readonly mediaPlayerResolver: AssistantMediaPlayerResolver = new AssistantMediaPlayerResolver()
  ) {
    this.aliasManagementService = aliasManagementService ?? new AssistantAliasManagementService(memoryService, deviceRepository, roomRepository);
    this.permissionGate = new PermissionGate(deviceRepository, roomRepository, sceneRepository, automationRepository, homeRepository);
    this.domesticSkillResolver = domesticSkillResolver ?? new DomesticSkillResolver(this.permissionGate);

    this.modules = new ConversationModules({
      intentInterpreter,
      confirmationPolicy,
      sceneExecutionService,
      deviceCommandDispatcher,
      deviceRepository,
      roomRepository,
      sceneRepository,
      smallTalkService,
      memoryService,
      followUpResolver,
      draftService,
      automationRepository,
      learningService,
      entityResolver,
      suggestionService,
      executionRecordRepository,
      systemVariableService,
      shadowService,
      fastPathResolver,
      homeRepository,
      confirmationTicketRepository,
      roomManagementService,
      mediaPlayerResolver,
      aliasManagementService: this.aliasManagementService,
      permissionGate: this.permissionGate,
      domesticSkillResolver: this.domesticSkillResolver,
      scopeFilter: this.scopeFilter
    }, {
      // Rest arguments keep each call's arity identical to a direct method call.
      executeIntent: (...args) => this.executeIntent(...args),
      executeSingleCommand: (...args) => this.executeSingleCommand(...args),
      attemptV2HybridExecution: (...args) => this.attemptV2HybridExecution(...args),
      attemptFastPathExecution: (...args) => this.attemptFastPathExecution(...args),
      attemptDeviceAliasFastPathExecution: (...args) => this.attemptDeviceAliasFastPathExecution(...args),
      attemptContextRoomFastPathExecution: (...args) => this.attemptContextRoomFastPathExecution(...args),
      applySafetyGateV2: (...args) => this.applySafetyGateV2(...args)
    });
    Object.assign(this, createConversationLegacySurface(this.modules));
  }

  private readonly domesticSkillResolver: DomesticSkillResolver;
  private readonly aliasManagementService: AssistantAliasManagementService;
  private readonly permissionGate: PermissionGate;
  private readonly scopeFilter = new ScopeFilter();
  private readonly modules: ConversationModules;

  public async converse(request: AssistantConverseRequest, _langHint: string = 'es'): Promise<AssistantConversationResponse> {
    const start = await this.modules.preamble.prepare(request, _langHint);
    if ('response' in start) return start.response;
    const { context } = start;

    const pendingResponse = await this.modules.pendingFlow.resolveConfirmations(context);
    if (pendingResponse) return pendingResponse;

    const clarificationResponse = await this.modules.pendingFlow.resolveClarificationSelection(context);
    if (clarificationResponse) return clarificationResponse;

    const pronounResponse = await this.modules.pendingFlow.resolvePronoun(context);
    if (pronounResponse) return pronounResponse;

    const routedResponse = await this.modules.router.routeDeterministic(context);
    if (routedResponse) return routedResponse;

    return await this.modules.planner.plan(context);
  }

  // Entry points that collaborators reach through the hooks above, so overriding one on the
  // service instance affects every internal call site.
  private executeIntent(
    intent: Intent,
    request: AssistantConverseRequest,
    language: string,
    userId: string,
    userName: string | null,
    prompt: string,
    memory: AssistantMemoryState | null
  ): Promise<AssistantConversationResponse> {
    return this.modules.intents.executeIntent(intent, request, language, userId, userName, prompt, memory);
  }

  private executeSingleCommand(
    deviceId: string,
    command: DeviceCommandV1,
    prompt: string,
    correlationId: string,
    params?: Record<string, unknown>,
    knownDevice?: Device
  ): Promise<SceneExecutionResult> {
    return this.modules.commands.executeSingleCommand(deviceId, command, prompt, correlationId, params, knownDevice);
  }

  private attemptV2HybridExecution(
    activePrompt: string,
    userId: string,
    language: 'es' | 'en',
    userName: string | null,
    memory: AssistantMemoryState | null
  ): Promise<AssistantConversationResponse | null> {
    return this.modules.deviceFastPaths.attemptV2HybridExecution(activePrompt, userId, language, userName, memory);
  }

  private attemptFastPathExecution(
    activePrompt: string,
    userId: string,
    language: string,
    userName: string | null
  ): Promise<AssistantConversationResponse | null> {
    return this.modules.deviceFastPaths.attemptFastPathExecution(activePrompt, userId, language, userName);
  }

  private attemptDeviceAliasFastPathExecution(
    activePrompt: string,
    userId: string,
    language: string,
    aliases: Record<string, string>
  ): Promise<AssistantConversationResponse | null> {
    return this.modules.deviceFastPaths.attemptDeviceAliasFastPathExecution(activePrompt, userId, language, aliases);
  }

  private attemptContextRoomFastPathExecution(
    prompt: string,
    sourceRoomId: string | undefined,
    userId: string,
    userName: string | null,
    language: string,
    aliases: Record<string, string>
  ): Promise<AssistantConversationResponse | null> {
    return this.modules.deviceFastPaths.attemptContextRoomFastPathExecution(prompt, sourceRoomId, userId, userName, language, aliases);
  }

  private applySafetyGateV2(
    prompt: string,
    userId: string,
    language: 'es' | 'en',
    request: AssistantConverseRequest
  ): Promise<AssistantConversationResponse | null> {
    return this.modules.safetyGate.applySafetyGateV2(prompt, userId, language, request);
  }
}
