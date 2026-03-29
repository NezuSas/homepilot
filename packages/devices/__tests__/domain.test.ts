import { createDiscoveredDevice, assignDeviceToRoom } from '../domain';
import { 
  InvalidDeviceExternalIdError, 
  InvalidTopologyReferenceError, 
  InvalidDeviceNameError,
  DeviceAlreadyAssignedError 
} from '../domain/errors';

describe('Módulo Devices - Capa de Dominio', () => {
  const mockDeps = {
    idGenerator: { generate: () => 'fixed-id' },
    clock: { now: () => '2026-01-01T00:00:00Z' }
  };

  describe('createDiscoveredDevice', () => {
    it('debe crear un dispositivo pendiente (PENDING) válido', () => {
      const device = createDiscoveredDevice(
        { homeId: 'home-1', externalId: 'ext-1', name: 'Sensor', type: 'TEMPERATURE', vendor: 'Acme' },
        mockDeps
      );
      expect(device.id).toBe('fixed-id');
      expect(device.status).toBe('PENDING');
      expect(device.roomId).toBeNull();
      expect(device.name).toBe('Sensor');
    });

    it('debe lanzar error si el homeId está vacío o es estructuralmente inválido', () => {
      expect(() => createDiscoveredDevice(
        { homeId: '', externalId: 'ext-1', name: 'N', type: 'T', vendor: 'V' },
        mockDeps
      )).toThrow(InvalidTopologyReferenceError);
    });

    it('debe lanzar error si faltan nombres estrictos o el externalId es inválido rechazando fallbacks', () => {
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
    it('debe asignar un dispositivo pendiente a un Room e incrementar estrictamente su versión mutando el updatedAt', () => {
      const pendingDevice = createDiscoveredDevice(
        { homeId: 'home-1', externalId: 'ext-1', name: 'Sensor', type: 'TEMPERATURE', vendor: 'Acme' },
        mockDeps
      );
      
      const assignedDevice = assignDeviceToRoom(pendingDevice, 'room-1', mockDeps.clock);
      
      expect(assignedDevice.status).toBe('ASSIGNED');
      expect(assignedDevice.roomId).toBe('room-1');
      expect(assignedDevice.entityVersion).toBe(2);
    });

    it('debe lanzar rígidamente DeviceAlreadyAssignedError protegiendo el estado si ya fue asignado previamente', () => {
      const pendingDevice = createDiscoveredDevice(
        { homeId: 'home-1', externalId: 'ext-1', name: 'S', type: 'T', vendor: 'V' },
        mockDeps
      );
      const assignedDevice = assignDeviceToRoom(pendingDevice, 'room-1', mockDeps.clock);
      
      expect(() => assignDeviceToRoom(assignedDevice, 'room-2', mockDeps.clock)).toThrow(DeviceAlreadyAssignedError);
    });
  });
});
