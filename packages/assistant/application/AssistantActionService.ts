import { AssistantFindingRepository } from '../domain/repositories/AssistantFindingRepository';
import { AssistantFeedbackRepository } from '../domain/repositories/AssistantFeedbackRepository';
import { randomUUID } from 'crypto';
import { FeedbackType } from '../domain/AssistantFeedbackEvent';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { assignDeviceUseCase, AssignDeviceUseCaseDependencies } from '../../devices/application/assignDeviceUseCase';
import { HomeAssistantImportService } from '../../devices/application/HomeAssistantImportService';

export interface AssistantActionServiceDependencies {
  assistantFindingRepository: AssistantFindingRepository;
  assistantFeedbackRepository: AssistantFeedbackRepository;
  deviceRepository: DeviceRepository;
  assignDeviceDeps: AssignDeviceUseCaseDependencies;
  haImportService: HomeAssistantImportService;
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

    let success = false;
    await this.recordFeedback(finding, 'accepted', actionType);

    switch (actionType) {
      case 'assign_room':
        await this.handleAssignRoom(finding.relatedEntityId!, payload.roomId, userId, correlationId);
        success = true;
        break;
      case 'rename_device':
        await this.handleRenameDevice(finding.relatedEntityId!, payload.newName);
        success = true;
        break;
      case 'import_device':
        await this.deps.haImportService.importDevice(finding.relatedEntityId!, userId, payload.newName);
        success = true;
        break;
      default:
        throw new Error(`UNSUPPORTED_ACTION: ${actionType}`);
    }

    // Auto-resolve finding only after successful action
    if (success) {
      await this.deps.assistantFindingRepository.updateStatus(findingId, 'resolved');
    }
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

  private async recordFeedback(finding: any, feedbackType: FeedbackType, actionType: string): Promise<void> {
    await this.deps.assistantFeedbackRepository.save({
      id: randomUUID(),
      findingType: finding.type,
      relatedEntityType: finding.relatedEntityType,
      relatedEntityId: finding.relatedEntityId,
      roomId: finding.metadata?.roomId || null,
      domain: finding.metadata?.domain || null,
      actionType,
      feedbackType,
      createdAt: new Date().toISOString(),
      metadata: {}
    });
  }
}
