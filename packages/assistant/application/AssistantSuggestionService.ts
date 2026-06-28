import { AssistantLearningService } from './AssistantLearningService';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';

export type SuggestionType = 
  | 'scene_suggestion'
  | 'automation_suggestion'
  | 'alias_suggestion';

export interface AssistantSuggestion {
  id: string;
  type: SuggestionType;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export class AssistantSuggestionService {
  constructor(
    private readonly learningService: AssistantLearningService,
    private readonly deviceRepository: DeviceRepository
  ) {}

  public async getSuggestion(userId: string, language: string): Promise<AssistantSuggestion | null> {
    const isEn = language === 'en';

    // 1. Alias Suggestion (Highest priority)
    const aliasSuggestion = await this.checkAliasSuggestion(userId, isEn);
    if (aliasSuggestion && !(await this.isSuppressed(userId, aliasSuggestion.type, aliasSuggestion.id))) {
      return aliasSuggestion;
    }

    // 2. Scene Suggestion
    const sceneSuggestion = await this.checkSceneSuggestion(userId, isEn);
    if (sceneSuggestion && !(await this.isSuppressed(userId, sceneSuggestion.type, sceneSuggestion.id))) {
      return sceneSuggestion;
    }

    // 3. Automation Suggestion
    const automationSuggestion = await this.checkAutomationSuggestion(userId, isEn);
    if (automationSuggestion && !(await this.isSuppressed(userId, automationSuggestion.type, automationSuggestion.id))) {
      return automationSuggestion;
    }

    return null;
  }

  private async isSuppressed(userId: string, type: SuggestionType, suggestionId: string): Promise<boolean> {
    const now = new Date();
    const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(); // Last 24h
    const events = await this.learningService.getEventsInTimeRange(userId, startTime, now.toISOString());

    for (const event of events) {
      if (event.metadata?.type === type && event.metadata?.suggestionId === suggestionId) {
        if (event.eventType === 'suggestion_rejected') return true; // 24h suppression
        if (event.eventType === 'suggestion_postponed') {
          const postponedAt = new Date(event.createdAt).getTime();
          if (now.getTime() - postponedAt < 2 * 60 * 60 * 1000) return true; // 2h suppression
        }
      }
    }

    return false;
  }

  private async checkAliasSuggestion(userId: string, isEn: boolean): Promise<AssistantSuggestion | null> {
    const corrections = await this.learningService.getRecentCorrections(userId, 10);
    const correctionGroups: Record<string, string[]> = {};

    for (const event of corrections) {
      if (event.prompt && event.correction) {
        const key = `${event.prompt.toLowerCase()}->${event.correction.toLowerCase()}`;
        if (!correctionGroups[key]) correctionGroups[key] = [];
        correctionGroups[key].push(event.id);
      }
    }

    for (const key in correctionGroups) {
      if (correctionGroups[key].length >= 2) {
        const [prompt, correction] = key.split('->');
        return {
          id: `alias_${prompt}_${correction}`,
          type: 'alias_suggestion',
          message: isEn 
            ? `I've noticed you frequently correct "${prompt}" to "${correction}". Would you like to create an alias?`
            : `He notado que sueles corregir "${prompt}" por "${correction}". ¿Quieres crear un alias?`,
          metadata: { alias: prompt, target: correction, confidence: 'high' },
          createdAt: new Date().toISOString()
        };
      }
    }

    return null;
  }

  private async checkSceneSuggestion(userId: string, isEn: boolean): Promise<AssistantSuggestion | null> {
    const now = new Date();
    const startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(); // Last 7 days
    const events = await this.learningService.getEventsInTimeRange(userId, startTime, now.toISOString());

    const deviceUsedEvents = events.filter(e => e.eventType === 'device_used' && e.roomId);
    const sortedEvents = [...deviceUsedEvents].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    // Group events by room and time clusters (5m)
    const clusterCounts: Record<string, number> = {}; // serialized cluster -> count

    let currentCluster: { room: string, devices: Set<string>, time: number } | null = null;

    for (const event of sortedEvents) {
      const eventTime = new Date(event.createdAt).getTime();
      const roomId = event.roomId as string;
      const deviceId = event.entityId as string;

      if (!currentCluster || currentCluster.room !== roomId || eventTime - currentCluster.time > 5 * 60 * 1000) {
        if (currentCluster && currentCluster.devices.size >= 2) {
          const key = `${currentCluster.room}:${Array.from(currentCluster.devices).sort().join(',')}`;
          clusterCounts[key] = (clusterCounts[key] || 0) + 1;
        }
        currentCluster = { room: roomId, devices: new Set([deviceId]), time: eventTime };
      } else {
        currentCluster.devices.add(deviceId);
      }
    }
    
    if (currentCluster && currentCluster.devices.size >= 2) {
      const key = `${currentCluster.room}:${Array.from(currentCluster.devices).sort().join(',')}`;
      clusterCounts[key] = (clusterCounts[key] || 0) + 1;
    }

    for (const key in clusterCounts) {
      if (clusterCounts[key] >= 3) {
        const [roomId, devicesStr] = key.split(':');
        const deviceIds = devicesStr.split(',');
        const devices = await Promise.all(deviceIds.map(id => this.deviceRepository.findDeviceById(id)));
        const homeId = devices[0]?.homeId;
        if (!homeId) continue;
        
        return {
          id: `scene_${key}`,
          type: 'scene_suggestion',
          message: isEn
            ? "You often use these devices together. Would you like to create a scene for them?"
            : "Sueles usar estos dispositivos juntos. ¿Te gustaría crear una escena para ellos?",
          metadata: { roomId, deviceIds, homeId },
          createdAt: new Date().toISOString()
        };
      }
    }

    return null;
  }

  private async checkAutomationSuggestion(userId: string, isEn: boolean): Promise<AssistantSuggestion | null> {
    const now = new Date();
    const startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const events = await this.learningService.getEventsInTimeRange(userId, startTime, now.toISOString());

    const deviceUsedEvents = events.filter(e => e.eventType === 'device_used');
    const patterns: Record<string, number[]> = {}; // deviceId -> hours of day

    for (const event of deviceUsedEvents) {
      const deviceId = event.entityId as string;
      const date = new Date(event.createdAt);
      const hour = date.getHours() + date.getMinutes() / 60;
      if (!patterns[deviceId]) patterns[deviceId] = [];
      patterns[deviceId].push(hour);
    }

    for (const deviceId in patterns) {
      const hours = patterns[deviceId];
      if (hours.length < 3) continue;

      // Simple clustering: check if at least 3 usages are within +/- 1h of each other
      for (const h1 of hours) {
        const similar = hours.filter(h2 => Math.abs(h1 - h2) <= 1 || Math.abs(h1 - h2) >= 23); // wrap around midnight
        if (similar.length >= 3) {
          const device = await this.deviceRepository.findDeviceById(deviceId);
          if (!device || !device.homeId) continue;
          const name = device.name;
          return {
            id: `automation_${deviceId}_${Math.round(h1)}`,
            type: 'automation_suggestion',
            message: isEn
              ? `You usually use "${name}" around this time. Should I suggest an automation for it?`
              : `Sueles usar "${name}" a esta hora. ¿Quieres que te sugiera una automatización?`,
            metadata: { deviceId, hour: Math.round(h1), homeId: device.homeId },
            createdAt: new Date().toISOString()
          };
        }
      }
    }

    return null;
  }

}
