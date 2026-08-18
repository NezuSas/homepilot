import { InMemoryDeviceRepository } from '../infrastructure/repositories/InMemoryDeviceRepository';
import { Device } from '../domain/types';

function device(overrides: Partial<Device> = {}): Device {
  return {
    id: 'device-1',
    homeId: 'home-1',
    roomId: null,
    externalId: 'light.kitchen',
    name: 'Kitchen light',
    type: 'light',
    vendor: 'home_assistant',
    status: 'PENDING',
    integrationSource: 'home_assistant',
    invertState: false,
    lastKnownState: null,
    entityVersion: 1,
    createdAt: '2026-08-17T10:00:00.000Z',
    updatedAt: '2026-08-17T10:00:00.000Z',
    ...overrides
  };
}

describe('InMemoryDeviceRepository', () => {
  it('isolates stored values and selects records by home, status, and external identity', async () => {
    const repository = new InMemoryDeviceRepository();
    await repository.saveDevice(device());
    await repository.saveDevice(device({ id: 'device-2', homeId: 'home-2', externalId: 'light.kitchen', status: 'ASSIGNED', roomId: 'room-2', createdAt: '2026-08-17T11:00:00.000Z' }));

    const saved = await repository.findDeviceById('device-1');
    expect(saved).toEqual(expect.objectContaining({ id: 'device-1' }));
    expect(Object.isFrozen(saved)).toBe(true);
    expect(await repository.findInboxByHomeId('home-1')).toEqual([expect.objectContaining({ id: 'device-1' })]);
    expect(await repository.findAllByHomeId('home-2')).toEqual([expect.objectContaining({ id: 'device-2' })]);
    await expect(repository.findByExternalIdAndHomeId('light.kitchen', 'home-2')).resolves.toEqual(expect.objectContaining({ id: 'device-2' }));
    await expect(repository.findByExternalId('missing')).resolves.toBeNull();
  });

  it('orders, prefixes, updates semantic type, and deletes stored devices', async () => {
    const repository = new InMemoryDeviceRepository();
    await repository.saveDevice(device({ id: 'pending-old', externalId: 'light.old', createdAt: '2026-08-17T09:00:00.000Z' }));
    await repository.saveDevice(device({ id: 'assigned', externalId: 'switch.office', status: 'ASSIGNED', roomId: 'room-1', createdAt: '2026-08-17T10:00:00.000Z' }));
    await repository.saveDevice(device({ id: 'pending-new', externalId: 'light.new', createdAt: '2026-08-17T11:00:00.000Z' }));

    await expect(repository.findAllOrderedByStatus()).resolves.toEqual([
      expect.objectContaining({ id: 'pending-new' }),
      expect.objectContaining({ id: 'pending-old' }),
      expect.objectContaining({ id: 'assigned' })
    ]);
    await expect(repository.findAllExternalIdsByPrefix('light.')).resolves.toEqual(['light.old', 'light.new']);

    await repository.updateSemanticType('assigned', 'switch');
    await expect(repository.findDeviceById('assigned')).resolves.toEqual(expect.objectContaining({ semanticType: 'switch' }));
    await repository.deleteDevice('assigned');
    await expect(repository.findDeviceById('assigned')).resolves.toBeNull();
  });
});
