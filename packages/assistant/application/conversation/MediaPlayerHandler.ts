import { AssistantMemoryState } from '../ports/AssistantMemoryPort';
import { getAssistantResponseText } from '../response/AssistantResponseCatalog';
import type { AssistantConversationResponse } from './conversationTypes';
import { formatMediaPlayerStatus, isMediaPlayerUnavailable, isMediaPlayerOff } from './mediaPlayerFormatting';
import { ConversationCollaborator } from './ConversationCollaborator';

/** Media player control and status requests. */
export class MediaPlayerHandler extends ConversationCollaborator {
  public async handleMediaPlayerRequest(
    normalizedPrompt: string,
    userId: string,
    language: string,
    originalPrompt: string,
    memory: AssistantMemoryState | null
  ): Promise<AssistantConversationResponse | null> {
    const [authorizedDevices, rooms] = await Promise.all([
      this.deps.permissionGate.getAuthorizedDevices(userId),
      this.deps.permissionGate.getAuthorizedRooms(userId)
    ]);
    const devices = Array.from(authorizedDevices);
    const contextualPlayer = memory?.lastQueryType === 'media_player_status' && memory.entities.length === 1
      ? devices.find((device) => device.id === memory.entities[0].id && device.type?.toLowerCase() === 'media_player')
      : undefined;
    const resolution = this.deps.mediaPlayerResolver.resolve(normalizedPrompt, devices, contextualPlayer, rooms);

    if (resolution.type === 'not_applicable') return null;
    if (resolution.type === 'no_players') {
      return { type: 'answer', message: getAssistantResponseText('media.no_players', language, {}) };
    }
    if (resolution.type === 'no_players_in_room') {
      return {
        type: 'answer',
        message: getAssistantResponseText('media.no_players_in_room', language, { roomName: resolution.room.name })
      };
    }
    if (resolution.type === 'clarification') {
      return {
        type: 'clarification',
        message: getAssistantResponseText('media.target_required', language, {}),
        clarification: {
          question: getAssistantResponseText('media.target_required_question', language, {}),
          options: resolution.players.map((player) => ({ id: player.id, label: player.name, kind: 'device' }))
        }
      };
    }
    if (resolution.type === 'missing_volume_amount') {
      return {
        type: 'answer',
        message: getAssistantResponseText('media.volume_amount_required', language, { deviceName: resolution.player.name })
      };
    }
    if (resolution.type === 'invalid_volume') {
      return {
        type: 'answer',
        message: getAssistantResponseText('media.volume_invalid', language, { deviceName: resolution.player.name })
      };
    }
    if (resolution.type === 'status') {
      await this.deps.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'media_player_status',
        entities: resolution.players.map((player) => ({
          id: player.id,
          name: player.name,
          type: player.type,
          roomId: player.roomId
        })),
        timestamp: new Date().toISOString()
      });
      return {
        type: 'answer',
        message: formatMediaPlayerStatus(resolution.players, language, rooms, resolution.room)
      };
    }

    const { player, command, params } = resolution;
    if (isMediaPlayerUnavailable(player)) {
      return {
        type: 'answer',
        message: getAssistantResponseText('media.unavailable', language, { deviceName: player.name })
      };
    }
    if (!this.deps.scopeFilter.isControllableDevice(player, command, params)) {
      return {
        type: 'answer',
        message: getAssistantResponseText('media.operation_not_supported', language, { deviceName: player.name, action: command })
      };
    }

    const wasOff = isMediaPlayerOff(player);
    if (wasOff && command !== 'turn_on') {
      if (!this.deps.scopeFilter.isControllableDevice(player, 'turn_on')) {
        return {
          type: 'answer',
          message: getAssistantResponseText('media.turn_on_not_supported', language, { deviceName: player.name })
        };
      }

      const powerResult = await this.modules.commands.executeAuthorizedCommand(
        userId,
        player.id,
        'turn_on',
        originalPrompt,
        `media-power-${Date.now()}`,
        undefined,
        player
      );
      if (powerResult.status !== 'success') {
        return {
          type: 'error',
          message: getAssistantResponseText('media.operation_failed', language, { deviceName: player.name })
        };
      }
    }

    const execution = await this.modules.commands.executeAuthorizedCommand(
      userId,
      player.id,
      command,
      originalPrompt,
      `media-command-${Date.now()}`,
      params,
      player
    );
    if (execution.status !== 'success') {
      return {
        type: 'error',
        message: getAssistantResponseText('media.operation_failed', language, { deviceName: player.name })
      };
    }

    await this.modules.session.clearPendingAction(userId);
    await this.deps.memoryService.saveShortTermMemory(userId, {
      lastQueryType: 'command',
      entities: [{ id: player.id, name: player.name, type: player.type, roomId: player.roomId }],
      timestamp: new Date().toISOString()
    });

    return {
      type: 'execution',
      message: getAssistantResponseText('media.operation_completed', language, {
        deviceName: player.name,
        action: command,
        volume: command === 'volume_set' && typeof params?.volume === 'number' ? params.volume : null,
        poweredOn: wasOff
      }),
      execution
    };
  }
}
