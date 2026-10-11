import { DeviceCommandV1 } from '../../../devices/domain/commands';
import { Device } from '../../../devices/domain/types';
import { SceneExecutionResult } from '../../../devices/domain/ExecutionRecord';
import type { Intent } from '../ports/IntentInterpreterPort';
import type { AssistantMemoryState } from '../ports/AssistantMemoryPort';
import type { AssistantConversationResponse, AssistantConverseRequest } from './conversationTypes';
import type { ConversationDeps } from './ConversationDeps';
import { ConversationSession } from './ConversationSession';
import { CommandExecutor } from './CommandExecutor';
import { ExecutionHistoryHandler } from './ExecutionHistoryHandler';
import { IntentExecutor } from './IntentExecutor';
import { IntentCommandRunner } from './IntentCommandRunner';
import { DeviceResolver } from './DeviceResolver';
import { StateQueryHandler } from './StateQueryHandler';
import { StateReadingHandler } from './StateReadingHandler';
import { HomeInfoHandler } from './HomeInfoHandler';
import { DraftRequestHandler } from './DraftRequestHandler';
import { SuggestionHandler } from './SuggestionHandler';
import { BulkConfirmationHandler } from './BulkConfirmationHandler';
import { SelectionHandler } from './SelectionHandler';
import { RoomFastPathHandler } from './RoomFastPathHandler';
import { DeviceFastPathHandler } from './DeviceFastPathHandler';
import { MediaPlayerHandler } from './MediaPlayerHandler';
import { SafetyGate } from './SafetyGate';
import { ManagementIntentHandler } from './ManagementIntentHandler';
import { ManagementActionExecutor } from './ManagementActionExecutor';
import { ConversationPreamble } from './ConversationPreamble';
import { ConversationPendingFlow } from './ConversationPendingFlow';
import { ConversationRouter } from './ConversationRouter';
import { ConversationPlanner } from './ConversationPlanner';

/**
 * Entry points that collaborators must reach through the conversation service itself,
 * so that overriding them on the service instance affects every internal call site.
 */
export interface ConversationHooks {
  executeIntent(
    intent: Intent,
    request: AssistantConverseRequest,
    language: string,
    userId: string,
    userName: string | null,
    prompt: string,
    memory: AssistantMemoryState | null
  ): Promise<AssistantConversationResponse>;
  executeSingleCommand(
    deviceId: string,
    command: DeviceCommandV1,
    prompt: string,
    correlationId: string,
    params?: Record<string, unknown>,
    knownDevice?: Device
  ): Promise<SceneExecutionResult>;
  attemptV2HybridExecution(
    activePrompt: string,
    userId: string,
    language: 'es' | 'en',
    userName: string | null,
    memory: AssistantMemoryState | null
  ): Promise<AssistantConversationResponse | null>;
  attemptFastPathExecution(
    activePrompt: string,
    userId: string,
    language: string,
    userName: string | null
  ): Promise<AssistantConversationResponse | null>;
  attemptDeviceAliasFastPathExecution(
    activePrompt: string,
    userId: string,
    language: string,
    aliases: Record<string, string>
  ): Promise<AssistantConversationResponse | null>;
  attemptContextRoomFastPathExecution(
    prompt: string,
    sourceRoomId: string | undefined,
    userId: string,
    userName: string | null,
    language: string,
    aliases: Record<string, string>
  ): Promise<AssistantConversationResponse | null>;
  applySafetyGateV2(
    prompt: string,
    userId: string,
    language: 'es' | 'en',
    request: AssistantConverseRequest
  ): Promise<AssistantConversationResponse | null>;
}

/** Composition of every conversation collaborator; collaborators resolve their siblings lazily through it. */
export class ConversationModules {
  readonly session: ConversationSession;
  readonly commands: CommandExecutor;
  readonly history: ExecutionHistoryHandler;
  readonly intents: IntentExecutor;
  readonly intentRunner: IntentCommandRunner;
  readonly devices: DeviceResolver;
  readonly stateQueries: StateQueryHandler;
  readonly readings: StateReadingHandler;
  readonly homeInfo: HomeInfoHandler;
  readonly drafts: DraftRequestHandler;
  readonly suggestions: SuggestionHandler;
  readonly bulkConfirmations: BulkConfirmationHandler;
  readonly selection: SelectionHandler;
  readonly roomFastPaths: RoomFastPathHandler;
  readonly deviceFastPaths: DeviceFastPathHandler;
  readonly mediaPlayer: MediaPlayerHandler;
  readonly safetyGate: SafetyGate;
  readonly management: ManagementIntentHandler;
  readonly managementActions: ManagementActionExecutor;
  readonly preamble: ConversationPreamble;
  readonly pendingFlow: ConversationPendingFlow;
  readonly router: ConversationRouter;
  readonly planner: ConversationPlanner;

  constructor(deps: ConversationDeps, readonly hooks: ConversationHooks) {
    this.session = new ConversationSession(deps, this);
    this.commands = new CommandExecutor(deps, this);
    this.history = new ExecutionHistoryHandler(deps, this);
    this.intents = new IntentExecutor(deps, this);
    this.intentRunner = new IntentCommandRunner(deps, this);
    this.devices = new DeviceResolver(deps, this);
    this.stateQueries = new StateQueryHandler(deps, this);
    this.readings = new StateReadingHandler(deps, this);
    this.homeInfo = new HomeInfoHandler(deps, this);
    this.drafts = new DraftRequestHandler(deps, this);
    this.suggestions = new SuggestionHandler(deps, this);
    this.bulkConfirmations = new BulkConfirmationHandler(deps, this);
    this.selection = new SelectionHandler(deps, this);
    this.roomFastPaths = new RoomFastPathHandler(deps, this);
    this.deviceFastPaths = new DeviceFastPathHandler(deps, this);
    this.mediaPlayer = new MediaPlayerHandler(deps, this);
    this.safetyGate = new SafetyGate(deps, this);
    this.management = new ManagementIntentHandler(deps, this);
    this.managementActions = new ManagementActionExecutor(deps, this);
    this.preamble = new ConversationPreamble(deps, this);
    this.pendingFlow = new ConversationPendingFlow(deps, this);
    this.router = new ConversationRouter(deps, this);
    this.planner = new ConversationPlanner(deps, this);
  }
}
