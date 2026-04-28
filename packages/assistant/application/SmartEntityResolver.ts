import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { RoomRepository } from '../../topology/domain/repositories/RoomRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { AutomationRuleRepository } from '../../devices/domain/repositories/AutomationRuleRepository';
import { AssistantMemoryPort } from './ports/AssistantMemoryPort';
import { AssistantLearningService } from './AssistantLearningService';
import { 
  EntityResolutionResult, 
  ResolutionMatch, 
  ResolutionReason 
} from './SmartEntityResolverTypes';
import { Device } from '../../devices/domain/types';
import { Room } from '../../topology/domain/types';
import { Scene } from '../../devices/domain/Scene';
import { AutomationRule } from '../../devices/domain/automation/types';

export class SmartEntityResolver {
  constructor(
    private readonly deviceRepo: DeviceRepository,
    private readonly roomRepo: RoomRepository,
    private readonly sceneRepo: SceneRepository,
    private readonly automationRepo: AutomationRuleRepository,
    private readonly memoryService: AssistantMemoryPort,
    private readonly learningService: AssistantLearningService
  ) {}

  public async resolveDevice(prompt: string, userId: string, roomId?: string | null): Promise<EntityResolutionResult<Device>> {
    const devices = await this.deviceRepo.findAll();
    const normalizedPrompt = this.normalize(prompt);

    // 1. Check Alias
    const aliasTarget = await this.memoryService.getAlias(userId, normalizedPrompt);
    if (aliasTarget) {
      const aliasMatch = devices.find(d => this.normalize(d.name) === this.normalize(aliasTarget) || d.id === aliasTarget);
      if (aliasMatch) return { type: 'single', match: { entity: aliasMatch, score: 1, reason: 'alias' } };
    }

    // 2. Exact Match
    const exactMatches = devices.filter(d => this.normalize(d.name) === normalizedPrompt);
    if (exactMatches.length === 1) return { type: 'single', match: { entity: exactMatches[0], score: 1, reason: 'exact' } };

    // 3. Room Match + Type
    if (roomId) {
      const roomDevices = devices.filter(d => d.roomId === roomId);
      // If prompt contains type words (luz, switch)
      const isLight = normalizedPrompt.includes('luz') || normalizedPrompt.includes('light');
      const isSwitch = normalizedPrompt.includes('switch') || normalizedPrompt.includes('interruptor');
      
      if (isLight) {
        const light = roomDevices.find(d => d.type === 'light');
        if (light) return { type: 'single', match: { entity: light, score: 0.9, reason: 'room_match' } };
      }
      if (isSwitch) {
        const sw = roomDevices.find(d => d.type === 'switch');
        if (sw) return { type: 'single', match: { entity: sw, score: 0.9, reason: 'room_match' } };
      }
    }

    // 4. Token Match
    const tokenMatches = devices.filter(d => {
      const nameTokens = this.normalize(d.name).split(' ');
      return nameTokens.some(t => t.length > 2 && normalizedPrompt.includes(t));
    });

    if (tokenMatches.length === 1) return { type: 'single', match: { entity: tokenMatches[0], score: 0.8, reason: 'token' } };
    if (tokenMatches.length > 1) {
      // 5. Learned Preference among token matches
      const mostUsed = await this.learningService.getMostUsedDevices(userId, 5);
      const preferred = tokenMatches.find(d => mostUsed.some(mu => mu.entityId === d.id));
      if (preferred) return { type: 'single', match: { entity: preferred, score: 0.85, reason: 'learned_preference' } };

      return { 
        type: 'multiple', 
        matches: tokenMatches.map(d => ({ entity: d, score: 0.8, reason: 'token' })) 
      };
    }

    return { type: 'none' };
  }

  public async resolveRoom(prompt: string): Promise<EntityResolutionResult<Room>> {
    const rooms = await this.roomRepo.findAll();
    const normalizedPrompt = this.normalize(prompt);

    const exactMatch = rooms.find(r => this.normalize(r.name) === normalizedPrompt);
    if (exactMatch) return { type: 'single', match: { entity: exactMatch, score: 1, reason: 'exact' } };

    const tokenMatch = rooms.filter(r => normalizedPrompt.includes(this.normalize(r.name)));
    if (tokenMatch.length === 1) return { type: 'single', match: { entity: tokenMatch[0], score: 0.9, reason: 'token' } };
    if (tokenMatch.length > 1) return { type: 'multiple', matches: tokenMatch.map(r => ({ entity: r, score: 0.9, reason: 'token' })) };

    return { type: 'none' };
  }

  public async resolveScene(prompt: string, userId: string): Promise<EntityResolutionResult<Scene>> {
    const scenes = await this.sceneRepo.findAll();
    const normalizedPrompt = this.normalize(prompt);

    const exactMatch = scenes.find(s => this.normalize(s.name) === normalizedPrompt);
    if (exactMatch) return { type: 'single', match: { entity: exactMatch, score: 1, reason: 'exact' } };

    const tokenMatches = scenes.filter(s => normalizedPrompt.includes(this.normalize(s.name)));
    if (tokenMatches.length === 1) return { type: 'single', match: { entity: tokenMatches[0], score: 0.9, reason: 'token' } };

    return { type: 'none' };
  }

  private normalize(text: string): string {
    return text.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 ]/g, '')
      .trim();
  }
}
