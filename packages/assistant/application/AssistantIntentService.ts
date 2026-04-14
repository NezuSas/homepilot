import { AssistantIntent, AssistantDraftProposal, IntentType } from '../domain/AssistantIntent';
import { ContextAnalysisService } from './ContextAnalysisService';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { RoomRepository } from '../../topology/domain/repositories/RoomRepository';
import { randomUUID } from 'crypto';

export class AssistantIntentService {
  constructor(
    private readonly contextService: ContextAnalysisService,
    private readonly deviceRepo: DeviceRepository,
    private readonly roomRepo: RoomRepository
  ) {}

  public async parse(input: string): Promise<AssistantIntent> {
    const raw = input.toLowerCase();
    let type: IntentType = 'summarize_assistant_state'; // Default
    let confidence = 0.5;
    const missingFields: string[] = [];
    
    // 1. Detect Intent Type
    if (raw.includes('renombrar') || raw.includes('rename') || raw.includes('llamar')) {
      type = 'rename_device';
      confidence = 0.9;
    } else if (raw.includes('escena') || raw.includes('scene')) {
      type = 'create_scene';
      confidence = 0.9;
    } else if (raw.includes('automatiz') || raw.includes('automation')) {
      type = 'create_automation';
      confidence = 0.9;
    } else if (raw.includes('asignar') || raw.includes('assign') || raw.includes('poner en')) {
      type = 'assign_room';
      confidence = 0.9;
    } else if (raw.includes('recomend') || raw.includes('sugerenc') || raw.includes('que hacer')) {
      type = 'request_recommendation';
      confidence = 0.9;
    }

    // 2. Resolve Entities (Room / Device)
    const context = await this.contextService.analyzeContext('system');
    
    let targetRoom: string | undefined;
    let targetRoomId: string | undefined;
    let targetDevice: string | undefined;
    let targetDeviceId: string | undefined;
    let newName: string | undefined;

    // Resolve Room/Device from context structure
    for (const roomEntry of context.rooms) {
      if (raw.includes(roomEntry.room.name.toLowerCase())) {
        targetRoom = roomEntry.room.name;
        targetRoomId = roomEntry.room.id;
      }
      for (const device of roomEntry.devices) {
        if (raw.includes(device.name.toLowerCase())) {
          targetDevice = device.name;
          targetDeviceId = device.id;
        }
      }
    }

    // Also check unassigned devices
    for (const device of context.unassignedDevices) {
      if (raw.includes(device.name.toLowerCase())) {
        targetDevice = device.name;
        targetDeviceId = device.id;
      }
    }

    // Extract New Name (Regex for "a {Name}" or "as {Name}")
    const renameMatch = input.match(/(?:a|as|to)\s+["']?([^"']+)["']?/i);
    if (renameMatch) {
      newName = renameMatch[1].trim();
    }

    // 3. Validation
    if (type === 'rename_device' && !targetDevice) missingFields.push('device');
    if (type === 'rename_device' && !newName) missingFields.push('new_name');
    if (type === 'assign_room' && !targetDevice) missingFields.push('device');
    if (type === 'assign_room' && !targetRoom) missingFields.push('room');

    return {
      type,
      targetRoom,
      targetRoomId,
      targetDevice,
      targetDeviceId,
      newName,
      confidence,
      rawInput: input,
      missingFields
    };
  }

  public async generateProposal(intent: AssistantIntent): Promise<AssistantDraftProposal> {
    const id = randomUUID();
    const isComplete = intent.missingFields.length === 0;

    switch (intent.type) {
      case 'rename_device':
        return {
          id,
          type: 'rename_device',
          title: 'Rename Device',
          summary: `Change name of "${intent.targetDevice}" to "${intent.newName}"`,
          details: { deviceId: intent.targetDeviceId, deviceName: intent.targetDevice, newName: intent.newName },
          entities: intent.targetDeviceId ? [{ id: intent.targetDeviceId, name: intent.targetDevice!, type: 'device' }] : [],
          isComplete,
          missingInfo: intent.missingFields
        };
      case 'assign_room':
        return {
          id,
          type: 'assign_room',
          title: 'Assign Room',
          summary: `Move "${intent.targetDevice}" to "${intent.targetRoom}"`,
          details: { deviceId: intent.targetDeviceId, roomId: intent.targetRoomId },
          entities: [
            ...(intent.targetDeviceId ? [{ id: intent.targetDeviceId, name: intent.targetDevice!, type: 'device' }] : []),
            ...(intent.targetRoomId ? [{ id: intent.targetRoomId, name: intent.targetRoom!, type: 'room' }] : [])
          ],
          isComplete,
          missingInfo: intent.missingFields
        };
      case 'create_scene':
        return {
          id,
          type: 'create_scene',
          title: 'Create Intelligent Scene',
          summary: `Configure a new scene for the ${intent.targetRoom || 'selected room'}.`,
          details: { roomId: intent.targetRoomId, roomName: intent.targetRoom },
          entities: intent.targetRoomId ? [{ id: intent.targetRoomId, name: intent.targetRoom!, type: 'room' }] : [],
          isComplete: !!intent.targetRoomId,
          missingInfo: intent.targetRoomId ? [] : ['room']
        };
      default:
        return {
          id,
          type: intent.type,
          title: 'Structured Intent',
          summary: `The assistant understood: ${intent.type}`,
          details: {},
          entities: [],
          isComplete: true
        };
    }
  }
}
