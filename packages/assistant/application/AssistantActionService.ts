import { AssistantFindingRepository } from '../domain/repositories/AssistantFindingRepository';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { assignDeviceUseCase, AssignDeviceUseCaseDependencies } from '../../devices/application/assignDeviceUseCase';

export interface AssistantActionServiceDependencies {
  assistantFindingRepository: AssistantFindingRepository;
  deviceRepository: DeviceRepository;
  assignDeviceDeps: AssignDeviceUseCaseDependencies;
  // Add other deps like discovery/sync when needed
}

export class AssistantActionService {
  constructor(private readonly deps: AssistantActionServiceDependencies) {}

  public async handleAction(
    findingId: string,
    actionType: string,
    payload: any,
    userId: string,
    correlationId: string
  ): Promise<void> {
    const finding = await this.deps.assistantFindingRepository.findById(findingId);
    if (!finding) throw new Error('FINDING_NOT_FOUND');

    switch (actionType) {
      case 'assign_room':
        await this.handleAssignRoom(finding.relatedEntityId!, payload.roomId, userId, correlationId);
        break;
      case 'rename_device':
        await this.handleRenameDevice(finding.relatedEntityId!, payload.newName);
        break;
      case 'import_device':
        // This would call the discovery/sync service. 
        // For V2, we might just mark as resolved if handled externally or trigger a sync.
        break;
      default:
        throw new Error(`UNSUPPORTED_ACTION: ${actionType}`);
    }

    // Auto-resolve finding after successful action
    await this.deps.assistantFindingRepository.updateStatus(findingId, 'resolved');
  }

  private async handleAssignRoom(deviceId: string, roomId: string, userId: string, correlationId: string): Promise<void> {
    if (!roomId) throw new Error('ROOM_ID_REQUIRED');
    await assignDeviceUseCase(deviceId, roomId, userId, correlationId, this.deps.assignDeviceDeps);
  }

  private async handleRenameDevice(deviceId: string, newName: string): Promise<void> {
    if (!newName) throw new Error('NEW_NAME_REQUIRED');
    const device = await this.deps.deviceRepository.findDeviceById(deviceId);
    if (!device) throw new Error('DEVICE_NOT_FOUND');

    await this.deps.deviceRepository.saveDevice({
      ...device,
      name: newName
    });
  }
}
