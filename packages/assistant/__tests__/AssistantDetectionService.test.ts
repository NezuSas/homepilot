import { AssistantDetectionService } from '../application/AssistantDetectionService';
import { Device } from '../../devices/domain/types';

function device(overrides: Partial<Device>): Device {
  return { id: 'device-1', homeId: 'home-1', roomId: 'room-1', externalId: 'ha:light.device', name: 'Light', type: 'light', vendor: 'HA', status: 'ASSIGNED', integrationSource: 'ha', invertState: false, lastKnownState: null, entityVersion: 1, createdAt: '', updatedAt: '', ...overrides };
}

function createService(options?: { states?: unknown; stateError?: Error }) {
  const pending = device({ id: 'pending', name: 'Hall 01', roomId: null, status: 'PENDING' });
  const duplicateA = device({ id: 'dup-a', name: 'Comedor' });
  const duplicateB = device({ id: 'dup-b', name: ' comedor ' });
  const technical = device({ id: 'technical', name: 'light_work_01' });
  const repositories = {
    findByExternalIdAndHomeId: jest.fn().mockResolvedValue(null),
    findInboxByHomeId: jest.fn().mockResolvedValue([pending]),
    findAllByHomeId: jest.fn().mockResolvedValue([duplicateA, duplicateB, technical]),
  };
  const haStateReader = { getAllStates: jest.fn().mockImplementation(async () => { if (options?.stateError) throw options.stateError; return options?.states ?? [{ entity_id: 'light.new', attributes: { friendly_name: 'New light' } }, { entity_id: 'sensor.unsupported', attributes: {} }]; }) };
  const context = { analyzeContext: jest.fn().mockResolvedValue({ insights: { potentialOptimizations: [{ deviceId: 'technical', deviceName: 'light_work_01', type: 'always_on', reason: 'device_permanently_on' }] } }) };
  const behavior = { analyzeProactively: jest.fn().mockResolvedValue([
    { type: 'habit', deviceId: 'dup-a', deviceName: 'Comedor', roomId: 'room-1', reasonKey: 'repeated_control_time', confidence: 0.85, metadata: {} },
    { type: 'waste', deviceId: 'dup-b', deviceName: 'Comedor', roomId: 'room-1', reasonKey: 'long_duration_on', confidence: 0.75, metadata: {} },
    { type: 'low_usage', deviceId: 'technical', deviceName: 'light_work_01', roomId: 'room-1', reasonKey: 'no_activity_long_term', confidence: 0.65, metadata: {} },
  ]) };
  const energy = { analyzeProactively: jest.fn().mockResolvedValue([
    { type: 'long_running_device', deviceId: 'pending', deviceName: 'Hall 01', roomId: null, reasonKey: 'long_duration_on', confidence: 0.85, metadata: {} },
    { type: 'high_consumption_pattern', deviceId: 'technical', deviceName: 'light_work_01', roomId: 'room-1', reasonKey: 'power_spike', confidence: 0.95, metadata: {} },
  ]) };
  return { service: new AssistantDetectionService(repositories as never, haStateReader as never, context as never, behavior as never, {} as never, energy as never), repositories, haStateReader };
}

describe('AssistantDetectionService', () => {
  it('builds and scores inventory, naming, contextual, behavioral, and energy findings', async () => {
    const { service, repositories } = createService();
    const findings = await service.scan('home-1');

    expect(repositories.findByExternalIdAndHomeId).toHaveBeenCalledWith('ha:light.new', 'home-1');
    expect(findings.map((finding) => finding.type as string)).toEqual(expect.arrayContaining([
      'new_device_available', 'device_missing_room', 'device_name_technical', 'device_name_duplicate', 'optimization_suggestion', 'habit_pattern_detected', 'optimization_opportunity', 'long_running_device', 'high_consumption_pattern',
    ]));
    expect(findings.find((finding) => finding.type === 'device_name_duplicate')).toEqual(expect.objectContaining({ metadata: expect.objectContaining({ deviceIds: ['dup-a', 'dup-b'], count: 2 }) }));
    expect(findings.find((finding) => finding.type === 'habit_pattern_detected')).toEqual(expect.objectContaining({ actions: expect.arrayContaining([expect.objectContaining({ type: 'configure_automation' })]) }));
    expect(findings.find((finding) => (finding.type as string) === 'long_running_device')).toEqual(expect.objectContaining({ actions: expect.arrayContaining([expect.objectContaining({ type: 'turn_off_device' })]) }));
    expect(findings.find((finding) => finding.metadata?.reasonKey === 'power_spike')).toEqual(expect.objectContaining({ severity: 'high', actions: expect.arrayContaining([expect.objectContaining({ type: 'review_device' })]) }));
    expect(findings.every((finding) => typeof finding.score === 'number')).toBe(true);
  });

  it('contains Home Assistant discovery errors and ignores invalid state payloads', async () => {
    const failed = createService({ stateError: new Error('offline') });
    const invalid = createService({ states: { invalid: true } });
    const error = jest.spyOn(console, 'error').mockImplementation();

    const failedFindings = await failed.service.scan('home-1');
    const invalidFindings = await invalid.service.scan('home-1');

    expect(error).toHaveBeenCalledWith('[Assistant] Failed to detect new devices:', expect.any(Error));
    expect(failedFindings.some((finding) => finding.type === 'new_device_available')).toBe(false);
    expect(invalidFindings.some((finding) => finding.type === 'new_device_available')).toBe(false);
  });
  it('does not suggest an already-imported supported device while retaining other inventory findings', async () => {
    const { service, repositories } = createService({ states: [
      { entity_id: 'light.imported', attributes: { friendly_name: 'Imported light' } },
      { entity_id: 'cover.new', attributes: { friendly_name: 'New cover' } },
    ] });
    repositories.findByExternalIdAndHomeId.mockImplementation(async (externalId: string) => externalId === 'ha:light.imported' ? device({ externalId }) : null);

    const findings = await service.scan('home-1');

    expect(findings.filter((finding) => finding.type === 'new_device_available').map((finding) => finding.relatedEntityId)).toEqual(['ha:cover.new']);
  });
  it.each([
    ['energy_waste_detected', 'turn_off_device'],
    ['long_running_device', 'turn_off_device'],
    ['high_consumption_pattern', 'review_device'],
    ['habit_pattern_detected', 'configure_automation'],
    ['optimization_opportunity', 'review_device'],
    ['unclassified', 'ignore'],
  ])('maps proactive finding type %s to the expected primary action %s', (_type, expectedAction) => {
    const { service } = createService();
    const internals = service as unknown as { getProactiveActions(type: string, data: { deviceId: string; metadata?: Record<string, unknown> }): Array<{ type: string; payload?: Record<string, unknown> }> };

    const actions = internals.getProactiveActions(_type, { deviceId: 'device-1', metadata: { roomId: 'room-1' } });

    expect(actions[0]).toEqual(expect.objectContaining({ type: expectedAction }));
    if (expectedAction === 'configure_automation') {
      expect(actions[0].payload).toEqual(expect.objectContaining({ deviceId: 'device-1', roomId: 'room-1' }));
    }
  });
});