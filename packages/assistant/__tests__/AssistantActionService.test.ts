import { assignDeviceUseCase } from '../../devices/application/assignDeviceUseCase';
import { Device } from '../../devices/domain/types';
import { AssistantActionService } from '../application/AssistantActionService';
import { AssistantFinding } from '../domain/AssistantFinding';

jest.mock('../../devices/application/assignDeviceUseCase', () => ({ assignDeviceUseCase: jest.fn() }));

const mockedAssignDeviceUseCase = assignDeviceUseCase as jest.MockedFunction<typeof assignDeviceUseCase>;

const finding: AssistantFinding = {
  id: 'finding-1', fingerprint: 'fp', source: 'test', type: 'device_missing_room', severity: 'medium', title: 'Assign device', description: 'Assign the device', relatedEntityType: 'device', relatedEntityId: 'device-1', status: 'open', actions: [], metadata: { homeId: 'home-1', roomId: 'room-1', domain: 'light' }, score: 50, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};

const device: Device = {
  id: 'device-1', homeId: 'home-1', roomId: null, externalId: 'ha:light.entry', name: 'Entry light', type: 'light', vendor: 'Home Assistant', status: 'PENDING', integrationSource: 'ha', invertState: false, lastKnownState: null, entityVersion: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};

function createService(currentFinding: AssistantFinding | null = finding) {
  const deps = {
    assistantFindingRepository: { findById: jest.fn().mockResolvedValue(currentFinding), updateStatus: jest.fn().mockResolvedValue(undefined) },
    assistantFeedbackRepository: { save: jest.fn().mockResolvedValue(undefined) },
    deviceRepository: { findDeviceById: jest.fn().mockResolvedValue(device), saveDevice: jest.fn().mockResolvedValue(undefined) },
    assignDeviceDeps: {} as never,
    haImportService: { importDevice: jest.fn().mockResolvedValue(undefined) },
    assistantDraftService: { activateDraft: jest.fn().mockResolvedValue(undefined) },
  };
  return { service: new AssistantActionService(deps as never), deps };
}

describe('AssistantActionService', () => {
  beforeEach(() => mockedAssignDeviceUseCase.mockReset().mockResolvedValue(device));

  it('rejects missing, unscoped, and cross-home findings before side effects', async () => {
    const missing = createService(null);
    await expect(missing.service.handleAction('finding-1', 'rename_device', { newName: 'New' }, 'user-1', 'corr-1', ['home-1'])).rejects.toThrow('ASSISTANT_FINDING_FORBIDDEN');
    expect(missing.deps.assistantFeedbackRepository.save).not.toHaveBeenCalled();

    const foreign = createService({ ...finding, metadata: { homeId: 'foreign-home' } });
    await expect(foreign.service.handleAction('finding-1', 'rename_device', { newName: 'New' }, 'user-1', 'corr-1', ['home-1'])).rejects.toThrow('ASSISTANT_FINDING_FORBIDDEN');
    expect(foreign.deps.assistantFindingRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('assigns a room, records acceptance, and resolves only after success', async () => {
    const { service, deps } = createService();

    await service.handleAction('finding-1', 'assign_room', { roomId: 'room-2' }, 'user-1', 'corr-1', ['home-1']);

    expect(mockedAssignDeviceUseCase).toHaveBeenCalledWith('device-1', 'room-2', 'user-1', 'corr-1', deps.assignDeviceDeps);
    expect(deps.assistantFeedbackRepository.save).toHaveBeenCalledWith(expect.objectContaining({ feedbackType: 'accepted', actionType: 'assign_room', roomId: 'room-1', domain: 'light' }));
    expect(deps.assistantFindingRepository.updateStatus).toHaveBeenCalledWith('finding-1', 'resolved');
  });

  it('validates and persists a device rename before resolving the finding', async () => {
    const { service, deps } = createService();
    await expect(service.handleAction('finding-1', 'rename_device', {}, 'user-1', 'corr-1', ['home-1'])).rejects.toThrow('NEW_NAME_REQUIRED');
    expect(deps.assistantFindingRepository.updateStatus).not.toHaveBeenCalled();

    await service.handleAction('finding-1', 'rename_device', { newName: 'Hall light' }, 'user-1', 'corr-1', ['home-1']);
    expect(deps.deviceRepository.saveDevice).toHaveBeenCalledWith(expect.objectContaining({ id: 'device-1', name: 'Hall light' }));
  });

  it('supports import and draft activation actions and rejects unsupported actions', async () => {
    const { service, deps } = createService();
    await service.handleAction('finding-1', 'import_device', { newName: 'Imported light' }, 'user-1', 'corr-1', ['home-1']);
    await service.handleAction('finding-1', 'activate_draft', { draftId: 'draft-1' }, 'user-1', 'corr-1', ['home-1']);
    await expect(service.handleAction('finding-1', 'erase_everything', {}, 'user-1', 'corr-1', ['home-1'])).rejects.toThrow('UNSUPPORTED_ACTION: erase_everything');

    expect(deps.haImportService.importDevice).toHaveBeenCalledWith('device-1', 'user-1', 'Imported light');
    expect(deps.assistantDraftService.activateDraft).toHaveBeenCalledWith('draft-1', 'user-1');
    expect(deps.assistantFindingRepository.updateStatus).toHaveBeenCalledTimes(2);
  });
});