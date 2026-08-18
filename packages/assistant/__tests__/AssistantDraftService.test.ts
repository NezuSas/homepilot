import { AssistantDraftService } from '../application/AssistantDraftService';
import { AssistantDraft } from '../domain/AssistantDraft';

function createService(overrides?: { draft?: AssistantDraft | null; device?: unknown; room?: { homeId: string } | null }) {
  const draftRepository = {
    findByFingerprint: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(overrides?.draft ?? null),
    updateStatus: jest.fn().mockResolvedValue(undefined),
  };
  const automationRepository = { save: jest.fn().mockResolvedValue(undefined) };
  const sceneRepository = { saveScene: jest.fn().mockResolvedValue(undefined) };
  const idGenerator = { generate: jest.fn().mockReturnValueOnce('draft-1').mockReturnValueOnce('resource-1') };
  const deviceRepository = { findDeviceById: jest.fn().mockResolvedValue(overrides?.device === undefined ? { id: 'device-1' } : overrides.device) };
  const roomRepository = { findRoomById: jest.fn().mockResolvedValue(overrides?.room === undefined ? { homeId: 'home-1' } : overrides.room) };
  return {
    service: new AssistantDraftService(draftRepository as never, automationRepository as never, sceneRepository as never, idGenerator, deviceRepository as never, roomRepository as never),
    draftRepository, automationRepository, sceneRepository, deviceRepository, roomRepository,
  };
}

describe('AssistantDraftService', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-08-17T12:00:00.000Z')));
  afterEach(() => jest.useRealTimers());

  it('returns an existing automation or scene draft without creating a duplicate', async () => {
    const existing = { id: 'existing', fingerprint: 'same', type: 'automation', status: 'draft', payload: {}, createdAt: '2026-01-01T00:00:00.000Z' } as AssistantDraft;
    const automation = createService({ draft: null });
    automation.draftRepository.findByFingerprint.mockResolvedValue(existing);
    const scene = createService({ draft: null });
    scene.draftRepository.findByFingerprint.mockResolvedValue(existing);

    await expect(automation.service.createAutomationDraft('home-1', 'Morning', {}, {}, 'same')).resolves.toBe(existing);
    await expect(scene.service.createSceneDraft('home-1', null, 'Movie', [], 'same')).resolves.toBe(existing);
    expect(automation.draftRepository.save).not.toHaveBeenCalled();
    expect(scene.draftRepository.save).not.toHaveBeenCalled();
  });

  it('creates typed drafts with stable payloads when no fingerprint exists', async () => {
    const { service, draftRepository } = createService();

    const automation = await service.createAutomationDraft('home-1', 'Morning', { type: 'time' }, { type: 'device_command' }, 'automation-fp');
    const scene = await service.createSceneDraft('home-1', 'room-1', 'Movie', [{ deviceId: 'light-1' }], 'scene-fp');

    expect(automation).toEqual(expect.objectContaining({ id: 'draft-1', type: 'automation', status: 'draft', fingerprint: 'automation-fp' }));
    expect(scene).toEqual(expect.objectContaining({ id: 'resource-1', type: 'scene', payload: expect.objectContaining({ roomId: 'room-1' }) }));
    expect(draftRepository.save).toHaveBeenCalledTimes(2);
  });

  it('activates automation and scene drafts once, and rejects missing drafts', async () => {
    const automationDraft = { id: 'draft-1', type: 'automation', status: 'draft', payload: { homeId: 'home-1', name: 'Morning', trigger: { type: 'time' }, action: { type: 'device_command' } }, fingerprint: 'fp', createdAt: '2026-01-01T00:00:00.000Z' } as AssistantDraft;
    const automation = createService({ draft: automationDraft });
    await automation.service.activateDraft('draft-1', 'user-1');
    expect(automation.automationRepository.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'draft-1', homeId: 'home-1', userId: 'user-1', enabled: true }));
    expect(automation.draftRepository.updateStatus).toHaveBeenCalledWith('draft-1', 'active');

    const sceneDraft = { id: 'draft-2', type: 'scene', status: 'draft', payload: { homeId: 'home-1', roomId: '', name: 'Movie', actions: [{ deviceId: 'light-1', command: 'turn_off' }] }, fingerprint: 'scene-fp', createdAt: '2026-01-01T00:00:00.000Z' } as AssistantDraft;
    const scene = createService({ draft: sceneDraft });
    await scene.service.activateDraft('draft-2', 'user-1');
    expect(scene.sceneRepository.saveScene).toHaveBeenCalledWith(expect.objectContaining({ homeId: 'home-1', roomId: null, name: 'Movie' }));

    await expect(createService().service.activateDraft('missing', 'user-1')).rejects.toThrow('DRAFT_NOT_FOUND');
  });

  it('does not activate an already-active draft twice', async () => {
    const active = { id: 'draft-1', type: 'scene', status: 'active', payload: {}, fingerprint: 'fp', createdAt: '2026-01-01T00:00:00.000Z' } as AssistantDraft;
    const { service, draftRepository, sceneRepository } = createService({ draft: active });

    await service.activateDraft('draft-1', 'user-1');

    expect(sceneRepository.saveScene).not.toHaveBeenCalled();
    expect(draftRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('validates scene suggestion metadata, device existence, and room ownership', async () => {
    await expect(createService().service.createDraft('user-1', 'scene', { homeId: '', deviceIds: [] })).rejects.toThrow('MISSING_HOME_ID_FOR_SUGGESTION_DRAFT');
    await expect(createService().service.createDraft('user-1', 'scene', { homeId: 'home-1', deviceIds: ['ok', 1] as unknown as string[] })).rejects.toThrow('deviceIds must be string[]');
    await expect(createService({ device: null }).service.createDraft('user-1', 'scene', { homeId: 'home-1', deviceIds: ['missing'] })).rejects.toThrow('One or more devices do not exist');
    await expect(createService({ room: { homeId: 'other' } }).service.createDraft('user-1', 'scene', { homeId: 'home-1', roomId: 'room-1', deviceIds: ['device-1'] })).rejects.toThrow('Room does not exist or belongs to different home');
  });

  it('creates validated scene and automation suggestions with canonical fingerprints', async () => {
    const scene = createService();
    await scene.service.createDraft('user-1', 'scene', { homeId: 'home-1', roomId: 'room-1', deviceIds: ['device-2', 'device-1'] });
    expect(scene.draftRepository.findByFingerprint).toHaveBeenCalledWith('suggestion:scene:user-1:home-1:room-1:device-1,device-2:');
    expect(scene.draftRepository.save).toHaveBeenCalledWith(expect.objectContaining({ type: 'scene', payload: expect.objectContaining({ actions: [{ deviceId: 'device-2', command: 'turn_on', params: {} }, { deviceId: 'device-1', command: 'turn_on', params: {} }] }) }));

    const automation = createService();
    await automation.service.createDraft('user-1', 'automation', { homeId: 'home-1', deviceId: 'device-1', trigger: { type: 'time' }, hour: '08:00' });
    expect(automation.draftRepository.findByFingerprint).toHaveBeenCalledWith('suggestion:automation:user-1:home-1::device-1:08:00');
    expect(automation.draftRepository.save).toHaveBeenCalledWith(expect.objectContaining({ type: 'automation', payload: expect.objectContaining({ name: 'Suggested Automation' }) }));
  });

  it('rejects automation suggestions without a valid existing device', async () => {
    await expect(createService().service.createDraft('user-1', 'automation', { homeId: 'home-1', deviceId: '', trigger: {} })).rejects.toThrow('deviceId must be string');
    await expect(createService({ device: null }).service.createDraft('user-1', 'automation', { homeId: 'home-1', deviceId: 'missing', trigger: {} })).rejects.toThrow('Device does not exist');
  });
});