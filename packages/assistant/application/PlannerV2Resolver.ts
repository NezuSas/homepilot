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
      case 'context_reference':
        return await this.resolveContext(target.context_hint, userId);
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
    const matches = all.filter(d => this.normalize(d.name).includes(name));

    if (matches.length === 1) {
      return { type: 'single', deviceId: matches[0].id };
    } else if (matches.length > 1) {
      return { type: 'multiple', deviceIds: matches.map(d => d.id) };
    }
    return { type: 'none' };
  }

  private async resolveRoom(name: string): Promise<ResolvedTarget> {
    const allRooms = await this.roomRepo.findAll();
    const room = allRooms.find(r => this.normalize(r.name).includes(name));

    if (room) {
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
    let typeFilter = '';
    
    if (name.includes('luz') || name.includes('light') || name.includes('luces')) typeFilter = 'light';
    else if (name.includes('interruptor') || name.includes('switch')) typeFilter = 'switch';
    else if (name.includes('persiana') || name.includes('cover') || name.includes('cortina')) typeFilter = 'cover';

    const matches = all.filter(d => {
      if (typeFilter && d.type === typeFilter) return true;
      return this.normalize(d.name).includes(name);
    });

    if (matches.length > 0) {
      return { type: 'category', deviceIds: matches.map(d => d.id) };
    }
    return { type: 'none' };
  }

  private async resolveScene(name: string): Promise<ResolvedTarget> {
    const all = await this.sceneRepo.findAll();
    const scene = all.find(s => this.normalize(s.name).includes(name));

    if (scene) {
      return { type: 'single', sceneId: scene.id };
    }
    return { type: 'none' };
  }

  private async resolveContext(hint: ContextHint | undefined, userId: string): Promise<ResolvedTarget> {
    const memory = await this.memoryService.getShortTermMemory(userId);
    if (!memory) return { type: 'none' };

    if (hint === 'it' || hint === 'them' || hint === 'turn_it_off' || hint === 'turn_it_on') {
      if (memory.entities.length === 1) {
        return { type: 'single', deviceId: memory.entities[0].id };
      } else if (memory.entities.length > 1) {
        return { type: 'multiple', deviceIds: memory.entities.map(e => e.id) };
      }
    }

    if (hint === 'first_option') {
      const option = memory.entities[0] || (memory.clarificationOptions && memory.clarificationOptions[0]);
      if (option) {
        return { type: 'single', deviceId: option.id };
      }
    }

    return { type: 'none' };
  }

  private normalize(text: string): string {
    return text.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 ]/g, '')
      .trim();
  }
}
