import { Device } from '../../devices/domain/types';
import { Scene } from '../../devices/domain/Scene';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { RoomRepository } from '../../topology/domain/repositories/RoomRepository';
import { AssistantContextBuilderPort } from './ports/AssistantContextBuilderPort';

import { AssistantMemoryPort } from './ports/AssistantMemoryPort';

/**
 * AssistantContextBuilder
 * 
 * Builds a privacy-aware context of the home setup for the LLM.
 * Limits the number of entities to avoid context window issues.
 */
export class AssistantContextBuilder implements AssistantContextBuilderPort {
  private readonly MAX_DEVICES = 50;
  private readonly MAX_SCENES = 50;
  private readonly MAX_RECENT_ACTIONS = 5;

  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly sceneRepository: SceneRepository,
    private readonly memoryService?: AssistantMemoryPort,
    private readonly roomRepository?: RoomRepository
  ) {}

  /**
   * Generates a JSON string containing the minimal home setup context.
   * Excludes sensitive data like IPs, tokens, or internal states.
   */
  public async build(userId: string | null = 'system'): Promise<string> {
    const [allDevices, allScenes] = await Promise.all([
      this.deviceRepository.findAll(),
      this.sceneRepository.findAll(),
    ]);

    const devices = allDevices.slice(0, this.MAX_DEVICES).map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      roomId: d.roomId,
      state: d.lastKnownState,
      capabilities: d.capabilities,
    }));

    const scenes = allScenes.slice(0, this.MAX_SCENES).map((s) => ({
      id: s.id,
      name: s.name,
    }));

    let recentActions: { deviceId: string; commandName: string; status: string }[] = [];
    let lastConversationEntities: { id: string; name: string; type: string; roomId: string | null }[] = [];
    
    if (this.memoryService) {
      const records = await this.memoryService.getRecentActions(this.MAX_RECENT_ACTIONS);
      recentActions = records.flatMap(record => 
        record.actions.map(action => ({
          deviceId: action.deviceId,
          commandName: action.commandName,
          status: action.status
        }))
      ).slice(0, this.MAX_RECENT_ACTIONS);

      if (userId) {
        const memory = await this.memoryService.getShortTermMemory(userId);
        if (memory) {
          lastConversationEntities = memory.entities;
        }
      }
    }

    return JSON.stringify({
      devices,
      scenes,
      recentActions,
      lastConversationEntities
    });
  }

  /**
   * Generates a strictly hardware-agnostic JSON map of the home.
   * Excludes all database IDs, UUIDs, and integration-specific identifiers.
   * This is intended for the Assistant Planner V2.
   */
  public async buildLlmHomeMap(userId: string | null = 'system'): Promise<string> {
    const [allDevices, allScenes, allRooms] = await Promise.all([
      this.deviceRepository.findAll(),
      this.sceneRepository.findAll(),
      this.roomRepository ? this.roomRepository.findAll() : Promise.resolve([])
    ]);

    const roomMap = new Map<string, string>(allRooms.map(r => [r.id, r.name]));

    const devices = allDevices.slice(0, this.MAX_DEVICES).map((d: Device) => ({
      name: d.name,
      type: d.type,
      roomName: d.roomId ? roomMap.get(d.roomId) || 'Unknown' : 'No Room',
      state: d.lastKnownState,
      capabilities: d.capabilities
    }));

    const scenes = allScenes.slice(0, this.MAX_SCENES).map((s: Scene) => ({
      name: s.name,
      estimatedActions: s.actions.length
    }));

    let recentActions: { deviceName: string; commandName: string; status: string }[] = [];
    let lastConversationEntities: { name: string; type: string; roomName: string | null }[] = [];
    
    if (this.memoryService) {
      const records = await this.memoryService.getRecentActions(this.MAX_RECENT_ACTIONS);
      recentActions = records.flatMap(record => 
        record.actions.map(action => {
          const device = allDevices.find((d: Device) => d.id === action.deviceId);
          return {
            deviceName: device?.name || 'Unknown Device',
            commandName: action.commandName,
            status: action.status
          };
        })
      ).slice(0, this.MAX_RECENT_ACTIONS);

      if (userId) {
        const memory = await this.memoryService.getShortTermMemory(userId);
        if (memory) {
          lastConversationEntities = memory.entities.map(e => ({
            name: e.name,
            type: e.type,
            roomName: e.roomId ? (roomMap.get(e.roomId) || null) as string | null : null
          }));
        }
      }
    }

    return JSON.stringify({
      devices,
      scenes,
      recentActions,
      lastConversationEntities
    });
  }

  /**
   * Generates an extremely lightweight JSON map of the home.
   * Optimized for low-power hardware and rapid inference.
   */
  public async buildLightLlmHomeMap(userId: string | null = 'system'): Promise<string> {
    const [allDevices, allScenes, allRooms, allAliases] = await Promise.all([
      this.deviceRepository.findAll(),
      this.sceneRepository.findAll(),
      this.roomRepository ? this.roomRepository.findAll() : Promise.resolve([]),
      this.memoryService && userId ? this.memoryService.getAliases(userId) : Promise.resolve([])
    ]);

    const roomMap = new Map<string, string>(allRooms.map(r => [r.id, r.name]));
    const aliases = (allAliases || {}) as Record<string, string>;
    const aliasEntries = Object.entries(aliases);

    const devices = allDevices.slice(0, 30).map((d: Device) => {
      const aliasMatch = aliasEntries.find(([_, targetId]) => targetId === d.id);
      return {
        name: d.name,
        alias: aliasMatch ? aliasMatch[0] : undefined,
        type: d.type,
        room: d.roomId ? roomMap.get(d.roomId) || 'Unknown' : undefined,
        on: d.lastKnownState?.power === 'on' || d.lastKnownState?.on === true
      };
    });

    const scenes = allScenes.slice(0, 10).map((s: Scene) => ({
      name: s.name
    }));

    return JSON.stringify({ devices, scenes });
  }

  /**
   * Generates an ultra-lightweight string map of the home.
   * Format: name|room|type|state
   */
  public async buildUltraLightLlmHomeMap(prompt: string, userId: string | null = 'system'): Promise<{ text: string, devicesCount: number }> {
    const [allDevices, allScenes, allRooms, allAliases] = await Promise.all([
      this.deviceRepository.findAll(),
      this.sceneRepository.findAll(),
      this.roomRepository ? this.roomRepository.findAll() : Promise.resolve([]),
      this.memoryService && userId ? this.memoryService.getAliases(userId) : Promise.resolve([])
    ]);

    const roomMap = new Map<string, string>(allRooms.map(r => [r.id, r.name]));
    const aliases = (allAliases || {}) as Record<string, string>;
    const aliasEntries = Object.entries(aliases);

    // Context detection
    const lowerPrompt = prompt.toLowerCase();
    const needsScenes = lowerPrompt.includes('escena') || lowerPrompt.includes('scene') || lowerPrompt.includes('modo') || lowerPrompt.includes('mode');
    const needsMemory = lowerPrompt.match(/\b(it|them|esa|ese|eso|la primera|lo primero|enciéndela|apágala|enciendelo|apagalo)\b/i) !== null;

    let text = "Rooms: " + allRooms.map(r => r.name).join(', ') + "\nDevices:\n";
    
    let devicesCount = 0;
    for (const d of allDevices.slice(0, 30)) {
      devicesCount++;
      const aliasMatch = aliasEntries.find(([_, targetId]) => targetId === d.id);
      const room = d.roomId ? roomMap.get(d.roomId) || 'Unknown' : 'No Room';
      const on = d.lastKnownState?.power === 'on' || d.lastKnownState?.on === true ? 'on' : 'off';
      let line = `${d.name}|${room}|${d.type}|${on}`;
      if (aliasMatch && aliasMatch[0].length < 15) {
        line += `|alias:${aliasMatch[0]}`;
      }
      text += line + "\n";
    }

    if (needsScenes && allScenes.length > 0) {
      text += "Scenes: " + allScenes.slice(0, 10).map(s => s.name).join(', ') + "\n";
    }

    if (needsMemory && this.memoryService && userId) {
      const memory = await this.memoryService.getShortTermMemory(userId);
      if (memory && memory.entities.length > 0) {
        const lastEntities = memory.entities.map(e => e.name).join(', ');
        text += `Memory: ${lastEntities}\n`;
      }
    }

    return { text, devicesCount };
  }
}
