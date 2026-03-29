import { createDiscoveredDevice, assignDeviceToRoom } from '../domain';
import { 
  InvalidDeviceExternalIdError, 
  InvalidTopologyReferenceError, 
  InvalidDeviceNameError,
  DeviceAlreadyAssignedError 
} from '../domain/errors';

describe('Devices Domain', () => {
  const mockDeps = {
    idGenerator: { generate: () => 'fixed-id' },
    clock: { now: () => '2026-01-01T00:00:00Z' }
  };

  describe('createDiscoveredDevice', () => {
    it('should create a valid pending device', () => {
      const device = createDiscoveredDevice(
        { homeId: 'home-1', externalId: 'ext-1', name: 'Sensor', type: 'TEMPERATURE', vendor: 'Acme' },
        mockDeps
      );
      expect(device.id).toBe('fixed-id');
      expect(device.status).toBe('PENDING');
      expect(device.roomId).toBeNull();
      expect(device.name).toBe('Sensor');
    });

    it('should throw error if homeId is empty or invalid', () => {
      expect(() => createDiscoveredDevice(
        { homeId: '', externalId: 'ext-1', name: 'N', type: 'T', vendor: 'V' },
        mockDeps
      )).toThrow(InvalidTopologyReferenceError);
    });

    it('should throw error if strict names are missing rejecting fallbacks', () => {
      expect(() => createDiscoveredDevice(
        { homeId: 'h1', externalId: 'ext-1', name: '  ', type: 'T', vendor: 'V' },
        mockDeps
      )).toThrow(InvalidDeviceNameError);
      
      expect(() => createDiscoveredDevice(
        { homeId: 'h1', externalId: '  ', name: 'N', type: 'T', vendor: 'V' },
        mockDeps
      )).toThrow(InvalidDeviceExternalIdError);
    });
  });

  describe('assignDeviceToRoom', () => {
    it('should assign a pending device to a room and strictly increment version mutating updatedAt', () => {
      const pendingDevice = createDiscoveredDevice(
        { homeId: 'home-1', externalId: 'ext-1', name: 'Sensor', type: 'TEMPERATURE', vendor: 'Acme' },
        mockDeps
      );
      
      const assignedDevice = assignDeviceToRoom(pendingDevice, 'room-1', mockDeps.clock);
      
      expect(assignedDevice.status).toBe('ASSIGNED');
      expect(assignedDevice.roomId).toBe('room-1');
      expect(assignedDevice.entityVersion).toBe(2);
    });

    it('should rigidly throw DeviceAlreadyAssignedError protecting state if already assigned', () => {
      const pendingDevice = createDiscoveredDevice(
        { homeId: 'home-1', externalId: 'ext-1', name: 'S', type: 'T', vendor: 'V' },
        mockDeps
      );
      const assignedDevice = assignDeviceToRoom(pendingDevice, 'room-1', mockDeps.clock);
      
      expect(() => assignDeviceToRoom(assignedDevice, 'room-2', mockDeps.clock)).toThrow(DeviceAlreadyAssignedError);
    });
  });
});
