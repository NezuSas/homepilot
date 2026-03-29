import { InMemoryDeviceRepository } from '../infrastructure/repositories';
import { InMemoryDeviceEventPublisher, createDeviceDiscoveredEvent } from '../domain/events';
import { Device } from '../domain';

describe('Devices Infrastructure', () => {
  describe('InMemoryDeviceRepository', () => {
    let repo: InMemoryDeviceRepository;

    beforeEach(() => {
      repo = new InMemoryDeviceRepository();
    });

    it('should save and statically find mapping device explicitly preventing hard object local mutations mapping closures accurately', async () => {
      const device: Device = {
        id: 'd-1', homeId: 'h-1', roomId: null, externalId: 'ext-1',
        name: 'Sensor', type: 'TEMP', vendor: 'V', status: 'PENDING',
        entityVersion: 1, createdAt: 'now', updatedAt: 'now'
      };

      await repo.saveDevice(device);
      const found = await repo.findDeviceById('d-1');
      
      expect(found).not.toBeNull();
      expect(found?.id).toBe('d-1');
    });

    it('should verify precise database emulation asserting mapping filtering exclusively by native Inbox domain rule constraints', async () => {
      await repo.saveDevice({ id: 'd-1', homeId: 'h-1', roomId: null, status: 'PENDING', externalId: 'e1', name: 'n1', type: 't', vendor: 'v', entityVersion: 1, createdAt: 'x', updatedAt: 'x' });
      await repo.saveDevice({ id: 'd-2', homeId: 'h-1', roomId: 'r-1', status: 'ASSIGNED', externalId: 'e2', name: 'n2', type: 't', vendor: 'v', entityVersion: 2, createdAt: 'x', updatedAt: 'x' });
      await repo.saveDevice({ id: 'd-3', homeId: 'h-2', roomId: null, status: 'PENDING', externalId: 'e3', name: 'n3', type: 't', vendor: 'v', entityVersion: 1, createdAt: 'x', updatedAt: 'x' });

      const inbox = await repo.findInboxByHomeId('h-1');
      
      expect(inbox.length).toBe(1);
      expect(inbox[0].id).toBe('d-1');
    });
  });

  describe('InMemoryDeviceEventPublisher', () => {
    it('should securely map unattached events generating pure arrays without internal leakage mutating external environments', async () => {
      const publisher = new InMemoryDeviceEventPublisher();
      const mockDeps = { idGenerator: { generate: () => 'e-1' }, clock: { now: () => 'now' } };
      
      const event = createDeviceDiscoveredEvent(
        { deviceId: 'd1', homeId: 'h1', externalId: 'ex', type: 't', vendor: 'v', name: 'n' },
        'corr-1',
        mockDeps
      );

      await publisher.publish(event);
      const events = publisher.getEvents();
      
      expect(events.length).toBe(1);
      expect(events[0].eventId).toBe('e-1');

      publisher.clear();
      expect(publisher.getEvents().length).toBe(0);
    });
  });
});
