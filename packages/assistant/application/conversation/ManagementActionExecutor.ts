import { isValidCommand } from '../../../devices/domain/commands';
import { AssistantMemoryState } from '../ports/AssistantMemoryPort';
import { getAssistantResponseText } from '../response/AssistantResponseCatalog';
import { normalizeAssistantPrompt } from '../AssistantPromptNormalizer';
import type { AssistantConversationResponse } from './conversationTypes';
import { ConversationCollaborator } from './ConversationCollaborator';

/** Execution of a confirmed management action. */
export class ManagementActionExecutor extends ConversationCollaborator {
  public async executeManagementAction(
    action: NonNullable<AssistantMemoryState['pendingManagementAction']>,
    userId: string,
    language: string
  ): Promise<AssistantConversationResponse> {
    const { type, targetId, payload } = action;

    try {
      if (type === 'create_room') {
        const name = typeof payload['name'] === 'string' ? payload['name'] : undefined;
        if (!name) throw new Error('INVALID_PAYLOAD: name is required');
        if (!this.deps.roomManagementService) {
          return { type: 'error', message: getAssistantResponseText('management.execution_failed', language, {}) };
        }

        const rooms = await this.deps.permissionGate.getAuthorizedRooms(userId);
        if (rooms.some((room) => normalizeAssistantPrompt(room.name) === normalizeAssistantPrompt(name))) {
          await this.modules.session.clearPendingAction(userId);
          return { type: 'answer', message: getAssistantResponseText('management.room_already_exists', language, { name }) };
        }

        const room = await this.deps.roomManagementService.createRoom({
          userId,
          name,
          correlationId: `assistant:room-create:${Date.now()}`
        });
        await this.modules.session.clearPendingAction(userId);
        return { type: 'answer', message: getAssistantResponseText('management.room_created', language, { name: room.name }) };
      }
      if (type === 'rename_room') {
        const name = typeof payload['name'] === 'string' ? payload['name'] : undefined;
        if (!name) throw new Error('INVALID_PAYLOAD: name is required');
        if (!this.deps.roomManagementService) {
          return { type: 'error', message: getAssistantResponseText('management.execution_failed', language, {}) };
        }

        const rooms = await this.deps.permissionGate.getAuthorizedRooms(userId);
        const room = rooms.find((candidate) => candidate.id === targetId);
        if (!room) {
          await this.modules.session.clearPendingAction(userId);
          return { type: 'answer', message: getAssistantResponseText('management.room_not_found', language, { name: action.targetName }) };
        }
        if (rooms.some((candidate) => candidate.id !== room.id && normalizeAssistantPrompt(candidate.name) === normalizeAssistantPrompt(name))) {
          await this.modules.session.clearPendingAction(userId);
          return { type: 'answer', message: getAssistantResponseText('management.room_already_exists', language, { name }) };
        }

        const renamedRoom = await this.deps.roomManagementService.renameRoom({
          userId,
          roomId: room.id,
          name,
          correlationId: `assistant:room-rename:${Date.now()}`
        });
        await this.modules.session.clearPendingAction(userId);
        return { type: 'answer', message: getAssistantResponseText('management.room_renamed', language, { name: renamedRoom.name }) };
      }

      if (type === 'delete_room') {
        if (!this.deps.roomManagementService) {
          return { type: 'error', message: getAssistantResponseText('management.execution_failed', language, {}) };
        }

        const rooms = await this.deps.permissionGate.getAuthorizedRooms(userId);
        const room = rooms.find((candidate) => candidate.id === targetId);
        if (!room) {
          await this.modules.session.clearPendingAction(userId);
          return { type: 'answer', message: getAssistantResponseText('management.room_not_found', language, { name: action.targetName }) };
        }

        const deleted = await this.deps.roomManagementService.deleteRoom({ userId, roomId: room.id });
        await this.modules.session.clearPendingAction(userId);
        return {
          type: 'answer',
          message: getAssistantResponseText('management.room_deleted', language, {
            name: deleted.room.name,
            unassignedDevices: deleted.unassignedDevices
          })
        };
      }

      if (type === 'rename_scene') {
        const newName = typeof payload['newName'] === 'string' ? payload['newName'] : undefined;
        if (!newName) throw new Error('INVALID_PAYLOAD: newName is required');

        const scene = await this.deps.sceneRepository.findSceneById(targetId);
        if (scene?.userId === userId) {
          scene.name = newName;
          scene.updatedAt = new Date().toISOString();
          await this.deps.sceneRepository.saveScene(scene);
          await this.modules.session.clearPendingAction(userId);
          return { type: 'answer', message: getAssistantResponseText('management.scene_renamed', language, { name: scene.name }) };
        }
      }

      if (type === 'cancel_timers') {
        const ids = Array.isArray(payload['ids']) ? payload['ids'].filter((id): id is string => typeof id === 'string') : [];
        const timers = (await this.deps.permissionGate.getAuthorizedAutomations(userId)).filter((automation) => ids.includes(automation.id) && automation.enabled && automation.trigger.type === 'time' && Boolean(automation.trigger.dateLocal));
        await Promise.all(timers.map((timer) => this.deps.automationRepository.save({ ...timer, enabled: false })));
        await this.modules.session.clearPendingAction(userId);
        return { type: 'answer', message: language === 'en' ? `${timers.length} timer${timers.length === 1 ? '' : 's'} cancelled.` : `${timers.length} temporizador${timers.length === 1 ? '' : 'es'} cancelado${timers.length === 1 ? '' : 's'}.` };
      }

      if (type === 'reschedule_timer') {
        const dateLocal = typeof payload['dateLocal'] === 'string' ? payload['dateLocal'] : undefined;
        const timeLocal = typeof payload['timeLocal'] === 'string' ? payload['timeLocal'] : undefined;
        const timeUTC = typeof payload['timeUTC'] === 'string' ? payload['timeUTC'] : undefined;
        const timezone = typeof payload['timezone'] === 'string' ? payload['timezone'] : undefined;
        if (!dateLocal || !timeLocal || !timeUTC || !timezone) throw new Error('INVALID_PAYLOAD: timer schedule is required');
        const timer = (await this.deps.permissionGate.getAuthorizedAutomations(userId)).find((automation) => automation.id === targetId && automation.enabled && automation.trigger.type === 'time' && Boolean(automation.trigger.dateLocal));
        if (!timer || timer.trigger.type !== 'time') {
          await this.modules.session.clearPendingAction(userId);
          return { type: 'answer', message: language === 'en' ? `I couldn't find an active timer named "${action.targetName}".` : `No encontré un temporizador activo llamado "${action.targetName}".` };
        }
        await this.deps.automationRepository.save({ ...timer, trigger: { ...timer.trigger, dateLocal, timeLocal, timeUTC, timezone } });
        await this.modules.session.clearPendingAction(userId);
        return { type: 'answer', message: language === 'en' ? `Timer "${timer.name}" rescheduled for ${timeLocal}.` : `Temporizador "${timer.name}" reprogramado para las ${timeLocal}.` };
      }
      if (type === 'toggle_automation') {
        const enabled = typeof payload['enabled'] === 'boolean' ? payload['enabled'] : undefined;
        if (enabled === undefined) throw new Error('INVALID_PAYLOAD: enabled is required');

        const auto = await this.deps.automationRepository.findById(targetId);
        if (auto?.userId === userId) {
          const updatedAuto = { ...auto, enabled, updatedAt: new Date().toISOString() };
          await this.deps.automationRepository.save(updatedAuto);
          await this.modules.session.clearPendingAction(userId);
          return { type: 'answer', message: getAssistantResponseText('management.automation_toggled', language, { name: auto.name, enabled }) };
        }
      }

      if (type === 'edit_scene') {
        const mode = payload['mode'];
        const deviceId = typeof payload['deviceId'] === 'string' ? payload['deviceId'] : undefined;

        if (mode === 'add') {
          const command = payload['command'];
          if (!deviceId || typeof command !== 'string' || !isValidCommand(command)) {
            throw new Error('INVALID_PAYLOAD: deviceId and valid command are required for add mode');
          }
          const scene = await this.deps.sceneRepository.findSceneById(targetId);
          if (scene?.userId === userId) {
            scene.actions.push({
              deviceId,
              command: { name: command, params: {} }
            });
            scene.updatedAt = new Date().toISOString();
            await this.deps.sceneRepository.saveScene(scene);
            await this.modules.session.clearPendingAction(userId);
            return { type: 'answer', message: getAssistantResponseText('management.scene_updated', language, { name: scene.name }) };
          }
        } else if (mode === 'remove') {
          if (!deviceId) throw new Error('INVALID_PAYLOAD: deviceId is required for remove mode');
          const scene = await this.deps.sceneRepository.findSceneById(targetId);
          if (scene?.userId === userId) {
            scene.actions = scene.actions.filter(a => a.deviceId !== deviceId);
            scene.updatedAt = new Date().toISOString();
            await this.deps.sceneRepository.saveScene(scene);
            await this.modules.session.clearPendingAction(userId);
            return { type: 'answer', message: getAssistantResponseText('management.scene_updated', language, { name: scene.name }) };
          }
        }
      }

      return { type: 'error', message: getAssistantResponseText('management.execution_failed', language, {}) };
    } catch (err: unknown) {
      return { type: 'error', message: err instanceof Error ? err.message : String(err) };
    }
  }
}
