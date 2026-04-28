import { AssistantLearningRepository } from '../domain/repositories/AssistantLearningRepository';
import { AssistantLearningEvent, LearningEventType, LearningModifiers } from '../domain/AssistantLearningEvent';
export { LearningModifiers } from '../domain/AssistantLearningEvent';
import { Device } from '../../devices/domain/types';
import { Scene } from '../../devices/domain/Scene';

export class AssistantLearningService {
  constructor(private readonly repository: AssistantLearningRepository) {}

  public async recordDeviceUsed(userId: string, device: Device, prompt: string): Promise<void> {
    await this.recordEvent({
      userId,
      eventType: 'device_used',
      entityType: 'device',
      entityId: device.id,
      entityName: device.name,
      roomId: device.roomId,
      prompt
    });
  }

  public async recordSceneUsed(userId: string, scene: Scene, prompt: string): Promise<void> {
    await this.recordEvent({
      userId,
      eventType: 'scene_used',
      entityType: 'scene',
      entityId: scene.id,
      entityName: scene.name,
      roomId: scene.roomId,
      prompt
    });
  }

  public async recordClarificationSelected(userId: string, entityId: string, entityName: string, entityType: string, originalPrompt: string): Promise<void> {
    await this.recordEvent({
      userId,
      eventType: 'clarification_selected',
      entityType,
      entityId,
      entityName,
      prompt: originalPrompt
    });
  }

  public async recordAliasCreated(userId: string, alias: string, targetName: string): Promise<void> {
    await this.recordEvent({
      userId,
      eventType: 'alias_created',
      entityName: targetName,
      prompt: alias,
      metadata: { alias, targetName }
    });
  }

  public async recordCorrection(userId: string, correction: string, originalPrompt: string | null = null): Promise<void> {
    await this.recordEvent({
      userId,
      eventType: 'correction_received',
      correction,
      prompt: originalPrompt
    });
  }

  public async recordCommandResult(userId: string, deviceId: string, success: boolean, error: string | null = null): Promise<void> {
    await this.recordEvent({
      userId,
      eventType: success ? 'command_succeeded' : 'command_failed',
      entityType: 'device',
      entityId: deviceId,
      metadata: error ? { error } : {}
    });
  }

  public async getMostUsedDevices(userId: string, limit: number = 5): Promise<Array<{ entityId: string; count: number }>> {
    return this.repository.getMostUsedEntities(userId, 'device', limit);
  }

  public async getMostUsedRooms(userId: string, limit: number = 5): Promise<Array<{ roomId: string; count: number }>> {
    return this.repository.getMostUsedRooms(userId, limit);
  }

  public async getRecentCorrections(userId: string, limit: number = 5): Promise<AssistantLearningEvent[]> {
    return this.repository.getRecentCorrections(userId, limit);
  }

  public async computeModifiers(userId: string = 'system'): Promise<LearningModifiers> {
    const [devices, rooms, corrections] = await Promise.all([
      this.getMostUsedDevices(userId),
      this.getMostUsedRooms(userId),
      this.getRecentCorrections(userId)
    ]);

    const typeModifiers: Record<string, number> = {};
    const explanations: Record<string, string> = {};

    // 1. Frequent devices -> boost automation_suggestion, scene_suggestion
    if (devices.length > 0) {
      typeModifiers['automation_suggestion'] = (typeModifiers['automation_suggestion'] || 0) + 15;
      typeModifiers['scene_suggestion'] = (typeModifiers['scene_suggestion'] || 0) + 10;
      explanations['automation_suggestion'] = 'Priorizado por uso frecuente de dispositivos.';
      explanations['scene_suggestion'] = 'Priorizado por uso frecuente de dispositivos.';
    }

    // 2. Frequent rooms -> boost energy_waste_detected, habit_pattern_detected
    if (rooms.length > 0) {
      typeModifiers['energy_waste_detected'] = (typeModifiers['energy_waste_detected'] || 0) + 20;
      typeModifiers['habit_pattern_detected'] = (typeModifiers['habit_pattern_detected'] || 0) + 15;
      explanations['energy_waste_detected'] = 'Priorizado por actividad frecuente en estancias.';
      explanations['habit_pattern_detected'] = 'Priorizado por actividad frecuente en estancias.';
    }

    // 3. Recent corrections -> negative boost
    for (const correction of corrections) {
      const findingType = correction.metadata?.findingType as string | undefined;
      if (findingType) {
        typeModifiers[findingType] = (typeModifiers[findingType] || 0) - 30;
        explanations[findingType] = 'Reducido por correcciones recientes del usuario.';
      }
    }

    return {
      typeModifiers,
      explanations
    };
  }

  private async recordEvent(params: Partial<AssistantLearningEvent> & { userId: string, eventType: LearningEventType }): Promise<void> {
    const event: AssistantLearningEvent = {
      id: `learn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: params.userId,
      eventType: params.eventType,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      entityName: params.entityName ?? null,
      roomId: params.roomId ?? null,
      prompt: params.prompt ?? null,
      correction: params.correction ?? null,
      metadata: params.metadata ?? {},
      createdAt: new Date().toISOString()
    };

    await this.repository.save(event);
  }
}
