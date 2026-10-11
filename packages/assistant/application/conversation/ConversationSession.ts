import { Device } from '../../../devices/domain/types';
import { AssistantMemoryState } from '../ports/AssistantMemoryPort';
import { applyAssistantResponsePreference, type AssistantResponsePreference } from '../response/AssistantResponsePreference';
import type { AssistantConversationResponse, SuggestionContext } from './conversationTypes';
import { ConversationCollaborator } from './ConversationCollaborator';

/** Pending-state cleanup, suggestion attachment, room lookups and response finalization. */
export class ConversationSession extends ConversationCollaborator {
  public async clearPendingAction(userId: string): Promise<void> {
    const memory = await this.deps.memoryService.getShortTermMemory(userId);
    if (memory) {
      await this.deps.memoryService.saveShortTermMemory(userId, {
        ...memory,
        pendingIntent: undefined,
        clarificationOptions: undefined,
        pendingDraft: undefined,
        pendingManagementAction: undefined,
        pendingSuggestion: undefined,
        pendingAliasDelete: undefined,
        originalPrompt: undefined
      });
    }
  }

  /** Executions, clarifications and answers that carry an execution return as they are; plain answers may be personalized. */
  public finalizeResponse(
    language: string,
    response: AssistantConversationResponse,
    responsePreference: AssistantResponsePreference = 'standard',
    allowResponsePersonalization = false
  ): AssistantConversationResponse {
    if (response.type === 'execution' || response.type === 'clarification') {
      return response;
    }

    if (response.type === 'answer' && response.execution) {
      return response;
    }

    if (!allowResponsePersonalization || response.type !== 'answer') {
      return response;
    }

    return {
      ...response,
      message: applyAssistantResponsePreference(
        response.message,
        responsePreference,
        language === 'en' ? 'en' : 'es'
      )
    };
  }

  public async attachSuggestionIfNeeded(response: AssistantConversationResponse, userId: string, language: string, memory: AssistantMemoryState | null, context?: SuggestionContext): Promise<AssistantConversationResponse> {
    if (response.type !== 'answer' && response.type !== 'execution') return response;

    // Safety guards
    if (memory?.pendingSuggestion) return response; // No stacking
    if (memory?.pendingIntent || memory?.clarificationOptions || memory?.pendingDraft || memory?.pendingManagementAction) return response;

    const allowedContexts: SuggestionContext[] = ['command', 'multi_command', 'scene', 'state_query', 'room_query', 'list_query'];
    if (!context || !allowedContexts.includes(context)) return response;

    const suggestion = await this.deps.suggestionService.getSuggestion(userId, language);
    if (suggestion) {
      const memoryUpdate: AssistantMemoryState = {
        ...(memory || { lastQueryType: 'none', entities: [], timestamp: new Date().toISOString() }),
        pendingSuggestion: {
          ...suggestion,
          createdAt: new Date().toISOString()
        }
      };
      await this.deps.memoryService.saveShortTermMemory(userId, memoryUpdate);

      const hint = language === 'en'
        ? '\nYou can reply: "yes, create it", "no thanks", or "later".'
        : '\nPuedes responder: "sí, créala", "no, gracias" o "después".';

      response.message += `\n\n💡 ${suggestion.message}${hint}`;
    }

    return response;
  }

  /**
   * Builds a Map<roomId, roomName> by querying rooms for each unique homeId
   * found in the provided devices. This avoids the 'system' hardcode bug.
   */
  public async buildRoomNameMap(devices: readonly Device[]): Promise<Map<string, string>> {
    const homeIds = [...new Set(devices.map(d => d.homeId).filter((hid): hid is string => Boolean(hid)))];
    const roomMap = new Map<string, string>();

    for (const homeId of homeIds) {
      const rooms = await this.deps.roomRepository.findRoomsByHomeId(homeId);
      for (const room of rooms) {
        roomMap.set(room.id, room.name);
      }
    }

    return roomMap;
  }
}
