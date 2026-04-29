import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { RoomRepository } from '../../topology/domain/repositories/RoomRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { AssistantMemoryPort } from './ports/AssistantMemoryPort';
import { TargetReference, ContextHint } from './ports/AssistantPlannerV2';
import { Device } from '../../devices/domain/types';

export interface ResolvedTarget {
  deviceId?: string;
  sceneId?: string;
  roomIds?: string[];
  deviceIds?: string[];
  type: 'single' | 'multiple' | 'room' | 'category' | 'none';
  contextSource?: 'short_term_memory' | 'semantic_match' | 'none';
}

export class PlannerV2Resolver {
  constructor(
    private readonly deviceRepo: DeviceRepository,
    private readonly roomRepo: RoomRepository,
    private readonly sceneRepo: SceneRepository,
    private readonly memoryService: AssistantMemoryPort
  ) {}

  /**
   * Resolves a natural language TargetReference into internal candidates.
   * This method is purely for resolution and does not execute any command.
   */
  public async resolve(target: TargetReference, userId: string): Promise<ResolvedTarget> {
    const normalizedName = this.normalize(target.name);

    const isPronoun = /^(enci[eé]ndel[ao]s?|pr[eé]ndel[ao]s?|ap[aá]gal[ao]s?|es[ao]s?|la misma|el mismo|los mismos|las mismas|it|them)$/.test(normalizedName);

    if (isPronoun || target.type === 'context_reference') {
      return await this.resolveContext(target.context_hint, userId);
    }

    switch (target.type) {
      case 'device':
        return await this.resolveDevice(normalizedName);
      case 'room':
        return await this.resolveRoom(normalizedName);
      case 'category':
        return await this.resolveCategory(normalizedName);
      case 'scene':
        return await this.resolveScene(normalizedName);
      case 'alias':
        return await this.resolveAlias(target.name, userId);
      case 'zone':
        // Zone support is reserved for Phase 2. Currently returning none to avoid silent failure.
        return { type: 'none' };
      default:
        return { type: 'none' };
    }
  }

  private async resolveAlias(aliasName: string, userId: string): Promise<ResolvedTarget> {
    const targetId = await this.memoryService.getAlias(userId, aliasName);
    
    if (targetId) {
      return { type: 'single', deviceId: targetId };
    }

    // Fallback to searching by device name if no explicit alias record is found
    return await this.resolveDevice(this.normalize(aliasName));
  }

  private async resolveDevice(name: string): Promise<ResolvedTarget> {
    const all = await this.deviceRepo.findAll();
    const matches = this.findBestMatches(name, all);

    if (matches.length === 1) {
      return { type: 'single', deviceId: matches[0].id };
    } else if (matches.length > 1) {
      return { type: 'multiple', deviceIds: matches.map(d => d.id) };
    }
    return { type: 'none' };
  }

  private async resolveRoom(name: string): Promise<ResolvedTarget> {
    const allRooms = await this.roomRepo.findAll();
    const matches = this.findBestMatches(name, allRooms);

    if (matches.length > 0) {
      const room = matches[0]; // Take best match
      const allDevices = await this.deviceRepo.findAll();
      const devicesInRoom = allDevices.filter(d => d.roomId === room.id);
      return { 
        type: 'room', 
        roomIds: [room.id], 
        deviceIds: devicesInRoom.map(d => d.id) 
      };
    }
    return { type: 'none' };
  }

  private async resolveCategory(name: string): Promise<ResolvedTarget> {
    const all = await this.deviceRepo.findAll();
    const normalizedQuery = this.normalize(name);
    
    const isLightCat = /^(luz|luces|foco|focos|lampara|lamparas|light|lights)$/.test(normalizedQuery);
    const isCoverCat = /^(cortina|cortinas|persiana|persianas|cover|covers)$/.test(normalizedQuery);
    const isSwitchCat = /^(interruptor|interruptores|switch|switches)$/.test(normalizedQuery);

    const matches = all.filter(d => {
      const normName = this.normalize(d.name);
      
      if (isLightCat) {
        if (d.type === 'light') return true;
        if (d.type === 'switch' && /(luz|luces|foco|focos|lampara|lamparas)/.test(normName)) return true;
      }
      
      if (isCoverCat && d.type === 'cover') return true;
      if (isSwitchCat && d.type === 'switch') return true;

      // Fallback matching logic if it's an unrecognized category
      if (!isLightCat && !isCoverCat && !isSwitchCat) {
        return normName.includes(normalizedQuery);
      }

      return false;
    });

    if (matches.length > 0) {
      return { type: 'category', deviceIds: matches.map(d => d.id) };
    }
    return { type: 'none' };
  }

  private async resolveScene(name: string): Promise<ResolvedTarget> {
    const all = await this.sceneRepo.findAll();
    const matches = this.findBestMatches(name, all);

    if (matches.length === 1) {
      return { type: 'single', sceneId: matches[0].id };
    } else if (matches.length > 1) {
      // For scenes, we usually just want one, but we'll return multiple if ambiguous
      return { type: 'multiple', deviceIds: [] }; // No sceneIds array in ResolvedTarget yet, so this indicates failure to resolve single
    }
    return { type: 'none' };
  }

  private async resolveContext(hint: ContextHint | undefined, userId: string): Promise<ResolvedTarget> {
    const memory = await this.memoryService.getShortTermMemory(userId);
    if (!memory) return { type: 'none', contextSource: 'none' };

    if (memory.entities && memory.entities.length > 0) {
      if (memory.entities.length === 1) {
        return { type: 'single', deviceId: memory.entities[0].id, contextSource: 'short_term_memory' };
      } else {
        return { type: 'multiple', deviceIds: memory.entities.map(e => e.id), contextSource: 'short_term_memory' };
      }
    }

    if (hint === 'first_option') {
      const option = memory.clarificationOptions && memory.clarificationOptions[0];
      if (option) {
        return { type: 'single', deviceId: option.id, contextSource: 'short_term_memory' };
      }
    }

    return { type: 'none', contextSource: 'none' };
  }

  private normalize(text: string): string {
    return text.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 ]/g, '')
      .trim();
  }

  private tokenize(text: string): string[] {
    const stopwords = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'en', 'al', 'a']);
    return text.split(/\s+/).filter(t => t.length > 0 && !stopwords.has(t));
  }

  private findBestMatches<T extends { name: string }>(query: string, items: readonly T[]): T[] {
    const normalizedQuery = this.normalize(query);
    const queryTokens = this.tokenize(normalizedQuery);
    
    let bestScore = 0;
    let bestMatches: T[] = [];

    for (const item of items) {
      const normalizedCandidate = this.normalize(item.name);
      const candidateTokens = this.tokenize(normalizedCandidate);
      
      let score = 0;
      if (normalizedCandidate === normalizedQuery) {
        score = 100;
      } else if (normalizedCandidate.includes(normalizedQuery)) {
        score = 90;
      } else {
        const matchingTokens = queryTokens.filter(qt => candidateTokens.includes(qt));
        if (matchingTokens.length === queryTokens.length && queryTokens.length > 0) {
          score = 80;
        } else if (matchingTokens.length > 0) {
          score = (matchingTokens.length / queryTokens.length) * 50;
          // Small penalty for candidate having extra tokens
          score -= (candidateTokens.length - matchingTokens.length) * 0.1;
        }
      }

      if (score > 0) {
        if (score > bestScore) {
          bestScore = score;
          bestMatches = [item];
        } else if (score === bestScore) {
          bestMatches.push(item);
        }
      }
    }
    
    return bestMatches;
  }
}
