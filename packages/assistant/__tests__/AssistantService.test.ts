import { AssistantService } from '../application/AssistantService';
import { AssistantFinding } from '../domain/AssistantFinding';

function finding(overrides: Partial<AssistantFinding> = {}): AssistantFinding {
  return {
    id: 'finding-1',
    fingerprint: 'fingerprint-1',
    source: 'system_scan',
    type: 'optimization_suggestion',
    severity: 'medium',
    title: 'assistant.types.optimization_suggestion',
    description: 'assistant.types.optimization_suggestion_description',
    relatedEntityType: 'device',
    relatedEntityId: 'device-1',
    status: 'open',
    actions: [],
    metadata: { homeId: 'home-1', roomId: 'room-1', domain: 'light' },
    score: 50,
    createdAt: '2026-08-17T10:00:00.000Z',
    updatedAt: '2026-08-17T10:00:00.000Z',
    ...overrides
  };
}

function createService(options?: { detected?: Partial<AssistantFinding>[]; existing?: AssistantFinding | null; open?: AssistantFinding[] }) {
  const repository = {
    save: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(options?.existing ?? null),
    findByFingerprint: jest.fn().mockResolvedValue(options?.existing ?? null),
    findAllOpen: jest.fn().mockResolvedValue(options?.open ?? []),
    findAllByStatus: jest.fn(),
    updateStatus: jest.fn().mockResolvedValue(undefined),
    resolveMissing: jest.fn().mockResolvedValue(0),
    getSummary: jest.fn()
  };
  const detectionService = { scan: jest.fn().mockResolvedValue(options?.detected ?? []) };
  const learningService = { computeModifiers: jest.fn().mockResolvedValue({}) };
  const feedbackRepository = { save: jest.fn().mockResolvedValue(undefined), findAll: jest.fn(), findByType: jest.fn(), findByRoom: jest.fn(), getAggregateStats: jest.fn() };
  return {
    service: new AssistantService(repository, detectionService as never, learningService as never, feedbackRepository),
    repository, detectionService, learningService, feedbackRepository
  };
}

describe('AssistantService', () => {
  it('creates newly detected findings and resolves stale fingerprints for the scanned home', async () => {
    const { service, repository, detectionService, learningService } = createService({
      detected: [{ fingerprint: 'new-fingerprint', type: 'optimization_suggestion', severity: 'low', relatedEntityType: 'device', relatedEntityId: 'device-2', actions: [{ type: 'ignore', label: 'Ignore' }], metadata: { domain: 'light' }, score: 12 }]
    });

    await service.scan('home-1', 'manual');

    expect(learningService.computeModifiers).toHaveBeenCalled();
    expect(detectionService.scan).toHaveBeenCalledWith('home-1', {});
    expect(repository.resolveMissing).toHaveBeenCalledWith(['new-fingerprint'], 'home-1');
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
      source: 'manual', fingerprint: 'new-fingerprint', status: 'open', metadata: { domain: 'light', homeId: 'home-1' }, score: 12
    }));
  });

  it('updates only open findings and keeps persistent dismissals intact during scans', async () => {
    const open = finding();
    const service = createService({ existing: open, detected: [{ fingerprint: open.fingerprint, actions: [{ type: 'resolve', label: 'Resolve' }], metadata: { refreshed: true }, score: 70, explanation: 'Updated' }] });
    await service.service.scan('home-1');

    expect(service.repository.save).toHaveBeenCalledWith(expect.objectContaining({
      id: open.id, actions: [{ type: 'resolve', label: 'Resolve' }], metadata: { homeId: 'home-1', roomId: 'room-1', domain: 'light', refreshed: true }, score: 70, explanation: 'Updated'
    }));

    const dismissed = createService({ existing: finding({ status: 'dismissed' }), detected: [{ fingerprint: 'fingerprint-1' }] });
    await dismissed.service.scan('home-1');
    expect(dismissed.repository.save).not.toHaveBeenCalled();
  });

  it('filters findings by authorized home and summarizes their severities and types', async () => {
    const { service } = createService({ open: [
      finding({ id: 'allowed', metadata: { homeId: 'home-1' }, severity: 'high' }),
      finding({ id: 'forbidden', metadata: { homeId: 'home-2' }, type: 'device_name_duplicate', severity: 'low' }),
      finding({ id: 'missing-home', metadata: {} })
    ] });

    await expect(service.listOpen(['home-1'])).resolves.toEqual([expect.objectContaining({ id: 'allowed' })]);
    await expect(service.getSummary(['home-1'])).resolves.toEqual({
      totalOpen: 1,
      bySeverity: { high: 1 },
      byType: { optimization_suggestion: 1 }
    });
  });

  it('records authorized feedback and rejects unauthorized finding mutations', async () => {
    const allowed = createService({ existing: finding() });
    await allowed.service.dismiss('finding-1', ['home-1']);
    await allowed.service.resolve('finding-1', ['home-1']);

    expect(allowed.feedbackRepository.save).toHaveBeenNthCalledWith(1, expect.objectContaining({ findingType: 'optimization_suggestion', feedbackType: 'dismissed', roomId: 'room-1', domain: 'light' }));
    expect(allowed.feedbackRepository.save).toHaveBeenNthCalledWith(2, expect.objectContaining({ feedbackType: 'completed' }));
    expect(allowed.repository.updateStatus).toHaveBeenNthCalledWith(1, 'finding-1', 'dismissed', expect.any(String));
    expect(allowed.repository.updateStatus).toHaveBeenNthCalledWith(2, 'finding-1', 'resolved');

    const forbidden = createService({ existing: finding({ metadata: { homeId: 'home-2' } }) });
    await expect(forbidden.service.dismiss('finding-1', ['home-1'])).rejects.toThrow('ASSISTANT_FINDING_FORBIDDEN');
    await expect(createService().service.resolve('missing', ['home-1'])).rejects.toThrow('ASSISTANT_FINDING_FORBIDDEN');
  });

  it('releases the scan guard after a failure so a later scan can run', async () => {
    const service = createService();
    service.detectionService.scan.mockRejectedValueOnce(new Error('scanner unavailable'));
    await expect(service.service.scan('home-1')).rejects.toThrow('scanner unavailable');

    await service.service.scan('home-1');
    expect(service.detectionService.scan).toHaveBeenCalledTimes(2);
  });
});
