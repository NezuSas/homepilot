import { DateTime } from 'luxon';
import { getAssistantResponseText } from '../response/AssistantResponseCatalog';
import { normalizeAssistantPrompt } from '../AssistantPromptNormalizer';
import type { AssistantConversationResponse } from './conversationTypes';
import { extractRelativeTimerDelaySeconds } from './draftRequestParsing';
import { isRoomCreationIntent, extractRoomCreationName, isRoomRenameIntent, isRoomDeletionIntent, extractRoomRenameRequest, extractRoomDeletionName } from './roomIntents';
import { ConversationCollaborator } from './ConversationCollaborator';

/** Scene, automation and room management intents that require confirmation. */
export class ManagementIntentHandler extends ConversationCollaborator {
  public async handleManagementIntent(normalized: string, userId: string, language: string, originalPrompt: string = normalized): Promise<AssistantConversationResponse> {
    if (/(?:cancela|cancel)\s+(?:todos los|all)\s+(?:temporizadores|timers)/i.test(normalized)) {
      const timers = (await this.deps.permissionGate.getAuthorizedAutomations(userId)).filter((automation) => automation.enabled && automation.trigger.type === 'time' && Boolean(automation.trigger.dateLocal));
      if (timers.length === 0) return { type: 'answer', message: getAssistantResponseText('listing.timers_empty', language, {}) };
      await this.deps.memoryService.saveShortTermMemory(userId, { lastQueryType: 'management_confirm', entities: [], timestamp: new Date().toISOString(), pendingManagementAction: { type: 'cancel_timers', targetId: '', targetName: 'timers', payload: { ids: timers.map((timer) => timer.id) }, timestamp: new Date().toISOString() } });
      return { type: 'clarification', message: getAssistantResponseText('management.cancel_all_timers_confirmation', language, { count: timers.length }), clarification: { question: getAssistantResponseText('confirmation.confirm', language, {}), options: [{ id: 'confirm', label: getAssistantResponseText('confirmation.yes', language, {}), kind: 'device' }, { id: 'cancel', label: getAssistantResponseText('confirmation.no', language, {}), kind: 'device' }] } };
    }
    const rescheduleMatch = /(?:cambia|cambiar|change)\s+(?:el\s+|the\s+)?(?:temporizador|timer)\s+(.+?)\s+(?:a|to|en|in)\s+(.+)|reschedule\s+(?:the\s+)?(.+?)\s+timer\s+(?:to|in)\s+(.+)/i.exec(originalPrompt);
    if (rescheduleMatch) {
      const timerName = (rescheduleMatch[1] || rescheduleMatch[3]).trim();
      const delaySeconds = extractRelativeTimerDelaySeconds(rescheduleMatch[2] || rescheduleMatch[4]);
      if (!delaySeconds) {
        return { type: 'answer', message: language === 'en' ? 'Tell me the new timer delay, for example "in 30 minutes".' : 'Indícame el nuevo retraso, por ejemplo "en 30 minutos".' };
      }
      const timers = (await this.deps.permissionGate.getAuthorizedAutomations(userId)).filter((automation) => automation.enabled && automation.trigger.type === 'time' && Boolean(automation.trigger.dateLocal));
      const timer = timers.find((automation) => normalizeAssistantPrompt(automation.name) === normalizeAssistantPrompt(timerName));
      if (!timer || timer.trigger.type !== 'time') {
        return { type: 'answer', message: language === 'en' ? `I couldn't find an active timer named "${timerName}".` : `No encontré un temporizador activo llamado "${timerName}".` };
      }
      const scheduledAt = DateTime.now().setZone(timer.trigger.timezone).plus({ seconds: delaySeconds });
      const dateLocal = scheduledAt.toISODate();
      if (!scheduledAt.isValid || !dateLocal) {
        return { type: 'error', message: language === 'en' ? 'I could not calculate the new timer schedule.' : 'No pude calcular el nuevo horario del temporizador.' };
      }
      await this.deps.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'management_confirm', entities: [], timestamp: new Date().toISOString(),
        pendingManagementAction: {
          type: 'reschedule_timer', targetId: timer.id, targetName: timer.name,
          payload: { dateLocal, timeLocal: scheduledAt.toFormat('HH:mm'), timeUTC: scheduledAt.toUTC().toFormat('HH:mm'), timezone: timer.trigger.timezone },
          timestamp: new Date().toISOString()
        }
      });
      const schedule = scheduledAt.toFormat('HH:mm');
      return {
        type: 'clarification',
        message: language === 'en' ? `I will reschedule "${timer.name}" for ${schedule}. Please confirm.` : `Reprogramaré "${timer.name}" para las ${schedule}. ¿Confirmas?`,
        clarification: {
          question: getAssistantResponseText('confirmation.confirm', language, {}),
          options: [
            { id: 'confirm', label: getAssistantResponseText('confirmation.yes', language, {}), kind: 'device' },
            { id: 'cancel', label: getAssistantResponseText('confirmation.no', language, {}), kind: 'device' }
          ],
          pendingAction: { originalPrompt: normalized }
        }
      };
    }
    if (isRoomRenameIntent(normalized)) {
      const roomRename = extractRoomRenameRequest(originalPrompt);
      if (!roomRename) {
        return { type: 'answer', message: getAssistantResponseText('management.room_rename_details_required', language, {}) };
      }
      const rooms = await this.deps.permissionGate.getAuthorizedRooms(userId);
      const room = rooms.find((candidate) => normalizeAssistantPrompt(candidate.name) === normalizeAssistantPrompt(roomRename.currentName));
      if (!room) {
        return { type: 'answer', message: getAssistantResponseText('management.room_not_found', language, { name: roomRename.currentName }) };
      }
      if (rooms.some((candidate) => candidate.id !== room.id && normalizeAssistantPrompt(candidate.name) === normalizeAssistantPrompt(roomRename.newName))) {
        return { type: 'answer', message: getAssistantResponseText('management.room_already_exists', language, { name: roomRename.newName }) };
      }

      await this.deps.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'management_confirm',
        entities: [],
        timestamp: new Date().toISOString(),
        pendingManagementAction: {
          type: 'rename_room',
          targetId: room.id,
          targetName: room.name,
          payload: { name: roomRename.newName },
          timestamp: new Date().toISOString()
        }
      });

      return {
        type: 'clarification',
        message: getAssistantResponseText('management.rename_room_confirmation', language, roomRename),
        clarification: {
          question: getAssistantResponseText('confirmation.confirm', language, {}),
          options: [
            { id: 'confirm', label: getAssistantResponseText('confirmation.yes', language, {}), kind: 'room' },
            { id: 'cancel', label: getAssistantResponseText('confirmation.no', language, {}), kind: 'room' }
          ],
          pendingAction: { originalPrompt: normalized }
        }
      };
    }

    if (isRoomDeletionIntent(normalized)) {
      const roomDeletionName = extractRoomDeletionName(originalPrompt);
      if (!roomDeletionName) {
        return { type: 'answer', message: getAssistantResponseText('management.room_deletion_name_required', language, {}) };
      }
      const rooms = await this.deps.permissionGate.getAuthorizedRooms(userId);
      const room = rooms.find((candidate) => normalizeAssistantPrompt(candidate.name) === normalizeAssistantPrompt(roomDeletionName));
      if (!room) {
        return { type: 'answer', message: getAssistantResponseText('management.room_not_found', language, { name: roomDeletionName }) };
      }
      const devices = await this.deps.permissionGate.getAuthorizedDevices(userId);
      const unassignedDevices = devices.filter((device) => device.roomId === room.id).length;

      await this.deps.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'management_confirm',
        entities: [],
        timestamp: new Date().toISOString(),
        pendingManagementAction: {
          type: 'delete_room',
          targetId: room.id,
          targetName: room.name,
          payload: {},
          timestamp: new Date().toISOString()
        }
      });

      return {
        type: 'clarification',
        message: getAssistantResponseText('management.delete_room_confirmation', language, { name: room.name, unassignedDevices }),
        clarification: {
          question: getAssistantResponseText('confirmation.confirm', language, {}),
          options: [
            { id: 'confirm', label: getAssistantResponseText('confirmation.yes', language, {}), kind: 'room' },
            { id: 'cancel', label: getAssistantResponseText('confirmation.no', language, {}), kind: 'room' }
          ],
          pendingAction: { originalPrompt: normalized }
        }
      };
    }

    if (isRoomCreationIntent(normalized)) {
      const name = extractRoomCreationName(originalPrompt);
      if (!name) {
        return { type: 'answer', message: getAssistantResponseText('management.room_name_required', language, {}) };
      }

      const rooms = await this.deps.permissionGate.getAuthorizedRooms(userId);
      const alreadyExists = rooms.some((room) => normalizeAssistantPrompt(room.name) === normalizeAssistantPrompt(name));
      if (alreadyExists) {
        return { type: 'answer', message: getAssistantResponseText('management.room_already_exists', language, { name }) };
      }

      await this.deps.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'management_confirm',
        entities: [],
        timestamp: new Date().toISOString(),
        pendingManagementAction: {
          type: 'create_room',
          targetId: '',
          targetName: name,
          payload: { name },
          timestamp: new Date().toISOString()
        }
      });

      return {
        type: 'clarification',
        message: getAssistantResponseText('management.create_room_confirmation', language, { name }),
        clarification: {
          question: getAssistantResponseText('confirmation.confirm', language, {}),
          options: [
            { id: 'confirm', label: getAssistantResponseText('confirmation.yes', language, {}), kind: 'room' },
            { id: 'cancel', label: getAssistantResponseText('confirmation.no', language, {}), kind: 'room' }
          ],
          pendingAction: { originalPrompt: normalized }
        }
      };
    }
    // 1. Rename Scene
    const renameSceneMatch = normalized.match(/(?:renombra|rename|cambia el nombre de|cambia de nombre|change name of) (?:la escena|the scene)? (.+) (?:a|to) (.+)/i);
    if (renameSceneMatch) {
      const oldName = renameSceneMatch[1].trim();
      const newName = renameSceneMatch[2].trim();
      const scenes = await this.deps.permissionGate.getAuthorizedScenes(userId);
      const scene = scenes.find(s => normalizeAssistantPrompt(s.name) === normalizeAssistantPrompt(oldName));

      if (!scene) return { type: 'answer', message: getAssistantResponseText('management.scene_not_found', language, { name: oldName }) };

      await this.deps.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'management_confirm',
        entities: [],
        timestamp: new Date().toISOString(),
        pendingManagementAction: {
          type: 'rename_scene',
          targetId: scene.id,
          targetName: scene.name,
          payload: { newName },
          timestamp: new Date().toISOString()
        }
      });

      return {
        type: 'clarification',
        message: getAssistantResponseText('management.rename_scene_confirmation', language, { sceneName: scene.name, newName }),
        clarification: {
          question: getAssistantResponseText('confirmation.confirm', language, {}),
          options: [
            { id: 'confirm', label: getAssistantResponseText('confirmation.yes', language, {}), kind: 'scene' },
            { id: 'cancel', label: getAssistantResponseText('confirmation.no', language, {}), kind: 'scene' }
          ],
          pendingAction: { originalPrompt: normalized }
        }
      };
    }

    // 2. Toggle Automation
    const toggleAutoMatch = normalized.match(/(activa|desactiva|cancela|cancel|enable|disable|activate|deactivate|pausa|resume) (?:la automatizacion|the automation|la rutina|the routine|el temporizador|the timer)? (.+)/i);
    if (toggleAutoMatch) {
      const actionStr = toggleAutoMatch[1].trim();
      const autoName = toggleAutoMatch[2].trim();
      const enabled = ['activa', 'enable', 'activate', 'resume'].includes(actionStr);

      const automations = await this.deps.permissionGate.getAuthorizedAutomations(userId);
      const auto = automations.find(a => normalizeAssistantPrompt(a.name) === normalizeAssistantPrompt(autoName));

      if (!auto) return { type: 'answer', message: getAssistantResponseText('management.automation_not_found', language, { name: autoName }) };

      await this.deps.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'management_confirm',
        entities: [],
        timestamp: new Date().toISOString(),
        pendingManagementAction: {
          type: 'toggle_automation',
          targetId: auto.id,
          targetName: auto.name,
          payload: { enabled },
          timestamp: new Date().toISOString()
        }
      });

      return {
        type: 'clarification',
        message: getAssistantResponseText('management.toggle_automation_confirmation', language, { name: auto.name, enabled }),
        clarification: {
          question: getAssistantResponseText('confirmation.confirm', language, {}),
          options: [
            { id: 'confirm', label: getAssistantResponseText('confirmation.yes', language, {}), kind: 'scene' },
            { id: 'cancel', label: getAssistantResponseText('confirmation.no', language, {}), kind: 'scene' }
          ],
          pendingAction: { originalPrompt: normalized }
        }
      };
    }

    // 3. Edit Scene (Add/Remove)
    // Agrega [device] a la escena [X]
    const addActionMatch = normalized.match(/(?:agrega|add) (.+) (?:a la escena|to the scene) (.+)/i);
    if (addActionMatch) {
      const deviceName = addActionMatch[1].trim();
      const sceneName = addActionMatch[2].trim();

      const scenes = await this.deps.permissionGate.getAuthorizedScenes(userId);
      const scene = scenes.find(s => normalizeAssistantPrompt(s.name) === normalizeAssistantPrompt(sceneName));
      if (!scene) return { type: 'answer', message: getAssistantResponseText('management.scene_not_found', language, { name: sceneName }) };

      const devices = await this.deps.permissionGate.getAuthorizedDevices(userId);
      const device = devices.find(d => normalizeAssistantPrompt(d.name) === normalizeAssistantPrompt(deviceName));
      if (!device) return { type: 'answer', message: getAssistantResponseText('management.device_not_found', language, { name: deviceName }) };

      await this.deps.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'management_confirm',
        entities: [],
        timestamp: new Date().toISOString(),
        pendingManagementAction: {
          type: 'edit_scene',
          targetId: scene.id,
          targetName: scene.name,
          payload: { mode: 'add', deviceId: device.id, deviceName: device.name, command: 'turn_off' },
          timestamp: new Date().toISOString()
        }
      });

      return {
        type: 'clarification',
        message: getAssistantResponseText('management.add_device_confirmation', language, { deviceName: device.name, sceneName: scene.name }),
        clarification: {
          question: getAssistantResponseText('confirmation.confirm', language, {}),
          options: [
            { id: 'confirm', label: getAssistantResponseText('confirmation.yes', language, {}), kind: 'scene' },
            { id: 'cancel', label: getAssistantResponseText('confirmation.no', language, {}), kind: 'scene' }
          ],
          pendingAction: { originalPrompt: normalized }
        }
      };
    }

    // Quita [device] de la escena [X]
    const removeActionMatch = normalized.match(/(?:quita|remove) (.+) (?:de la escena|from the scene) (.+)/i);
    if (removeActionMatch) {
      const deviceName = removeActionMatch[1].trim();
      const sceneName = removeActionMatch[2].trim();

      const scenes = await this.deps.permissionGate.getAuthorizedScenes(userId);
      const scene = scenes.find(s => normalizeAssistantPrompt(s.name) === normalizeAssistantPrompt(sceneName));
      if (!scene) return { type: 'answer', message: getAssistantResponseText('management.scene_not_found', language, { name: sceneName }) };

      const devices = await this.deps.permissionGate.getAuthorizedDevices(userId);
      const device = devices.find(d => normalizeAssistantPrompt(d.name) === normalizeAssistantPrompt(deviceName));
      const action = scene.actions.find(a => a.deviceId === device?.id || a.deviceId === deviceName);

      if (!action) return { type: 'answer', message: getAssistantResponseText('management.device_not_in_scene', language, { name: deviceName }) };

      await this.deps.memoryService.saveShortTermMemory(userId, {
        lastQueryType: 'management_confirm',
        entities: [],
        timestamp: new Date().toISOString(),
        pendingManagementAction: {
          type: 'edit_scene',
          targetId: scene.id,
          targetName: scene.name,
          payload: { mode: 'remove', deviceId: action.deviceId, deviceName: device?.name || deviceName },
          timestamp: new Date().toISOString()
        }
      });

      return {
        type: 'clarification',
        message: getAssistantResponseText('management.remove_device_confirmation', language, { deviceName: device?.name || deviceName, sceneName: scene.name }),
        clarification: {
          question: getAssistantResponseText('confirmation.confirm', language, {}),
          options: [
            { id: 'confirm', label: getAssistantResponseText('confirmation.yes', language, {}), kind: 'scene' },
            { id: 'cancel', label: getAssistantResponseText('confirmation.no', language, {}), kind: 'scene' }
          ],
          pendingAction: { originalPrompt: normalized }
        }
      };
    }

    return { type: 'answer', message: getAssistantResponseText('management.unsupported_action', language, {}) };
  }
}
