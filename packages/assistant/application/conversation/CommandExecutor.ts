import { SceneExecutionResult } from '../../../devices/domain/ExecutionRecord';
import { DeviceCommandV1 } from '../../../devices/domain/commands';
import { Scene } from '../../../devices/domain/Scene';
import { Device } from '../../../devices/domain/types';
import { AssistantMemoryEntity } from '../ports/AssistantMemoryPort';
import type { AssistantConversationResponse, ExecutedCommandResult } from './conversationTypes';
import { formatMultiCommandSummary } from './responseMessages';
import { ConversationCollaborator } from './ConversationCollaborator';

/** Authorized device command dispatch and bulk execution. */
export class CommandExecutor extends ConversationCollaborator {
  public async executeAuthorizedCommand(
    userId: string,
    deviceId: string,
    command: DeviceCommandV1,
    prompt: string,
    correlationId: string,
    params?: Record<string, unknown>,
    knownDevice?: Device
  ): Promise<SceneExecutionResult> {
    const hasParams = params !== undefined && Object.keys(params).length > 0;
    if (!this.deps.homeRepository && process.env.NODE_ENV === 'test') {
      if (!hasParams && !knownDevice) return this.modules.hooks.executeSingleCommand(deviceId, command, prompt, correlationId);
      return this.modules.hooks.executeSingleCommand(deviceId, command, prompt, correlationId, hasParams ? params : undefined, knownDevice);
    }

    const device = knownDevice ?? await this.deps.deviceRepository.findDeviceById(deviceId);
    const homeId = device?.homeId;

    if (!homeId) throw new Error('DEVICE_HOME_ID_NOT_FOUND');
    await this.deps.permissionGate.assertHomeAuthorized(userId, homeId);
    await this.deps.permissionGate.assertDeviceAuthorized(userId, device);
    if (!hasParams && !knownDevice) return this.modules.hooks.executeSingleCommand(deviceId, command, prompt, correlationId);
    return this.modules.hooks.executeSingleCommand(deviceId, command, prompt, correlationId, hasParams ? params : undefined, knownDevice);
  }

  public async executeSingleCommand(deviceId: string, command: DeviceCommandV1, prompt: string, correlationId: string, params?: Record<string, unknown>, knownDevice?: Device): Promise<SceneExecutionResult> {
    const device = knownDevice ?? await this.deps.deviceRepository.findDeviceById(deviceId);
    const homeId = device?.homeId;
    const roomId = device?.roomId ?? null;

    if (!homeId) throw new Error('DEVICE_HOME_ID_NOT_FOUND');

    const transientScene: Scene = {
      id: `assistant-chat-transient-${Date.now()}`,
      homeId,
      roomId,
      name: `Assistant Chat: ${prompt}`,
      actions: [{
        deviceId: deviceId,
        command: { name: command, params: params ?? {} }
      }],
      executionMode: 'parallel',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return await this.deps.sceneExecutionService.execute(transientScene, {
      sourceType: 'manual',
      sourceId: 'assistant',
      correlationId
    });
  }

  public async executeBulkDevices(
    userId: string,
    language: string,
    devices: readonly Device[],
    command: DeviceCommandV1,
    originalPrompt: string,
    bulkType: 'all' | 'lights',
    skippedCount: number = 0
  ): Promise<AssistantConversationResponse> {
    const correlationId = `bulk-${Date.now()}`;
    const results: ExecutedCommandResult[] = [];
    const entities: AssistantMemoryEntity[] = [];

    for (const device of devices) {
      const result = await this.executeAuthorizedCommand(userId, device.id, command, originalPrompt, correlationId, undefined, device);
      results.push({ action: { deviceId: device.id, command }, deviceName: device.name, result });
      entities.push({ id: device.id, name: device.name, type: device.type, roomId: device.roomId });
    }

    await this.modules.session.clearPendingAction(userId);
    await this.deps.memoryService.saveShortTermMemory(userId, {
      lastQueryType: 'command',
      entities,
      timestamp: new Date().toISOString()
    });

    let summary = formatMultiCommandSummary(results, language, bulkType);
    if (skippedCount > 0) {
      summary += language === 'en'
        ? ` (${skippedCount} device(s) were already in the requested state and were skipped.)`
        : ` (${skippedCount} dispositivo(s) ya estaban en el estado solicitado y se omitieron.)`;
    }

    const successCount = results.filter(result => result.result.status === 'success').length;
    return this.modules.session.attachSuggestionIfNeeded({
      type: 'execution',
      message: summary,
      execution: {
        sceneId: 'bulk_action',
        status: successCount === results.length ? 'success' : successCount === 0 ? 'failed' : 'partial',
        actions: results.flatMap(result => result.result.actions)
      }
    }, userId, language, await this.deps.memoryService.getShortTermMemory(userId), 'multi_command');
  }
}
