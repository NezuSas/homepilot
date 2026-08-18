import { createDiscoveredDevice, assignDeviceToRoom } from '../domain';
import {
  InvalidDeviceExternalIdError,
  InvalidTopologyReferenceError,
  InvalidDeviceNameError,
  InvalidDeviceTypeError,
  InvalidDeviceVendorError,
  DeviceAlreadyAssignedError,
  InvalidDeviceCommandError,
  UnsupportedCommandError,
  AutomationLoopError,
  InvalidAutomationRuleError
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

  it('rejects blank device type and vendor instead of creating ambiguous discovered devices', () => {
    expect(() => createDiscoveredDevice(
      { homeId: 'home-1', externalId: 'ext-1', name: 'Sensor', type: '   ', vendor: 'Acme' },
      mockDeps,
    )).toThrow(InvalidDeviceTypeError);

    expect(() => createDiscoveredDevice(
      { homeId: 'home-1', externalId: 'ext-1', name: 'Sensor', type: 'TEMPERATURE', vendor: '   ' },
      mockDeps,
    )).toThrow(InvalidDeviceVendorError);
  });

  it('trims every persisted identity field while preserving an explicit integration source', () => {
    const device = createDiscoveredDevice(
      { homeId: ' home-1 ', externalId: ' ext-1 ', name: ' Sensor ', type: ' TEMPERATURE ', vendor: ' Acme ', integrationSource: ' sonoff ' },
      mockDeps,
    );

    expect(device).toMatchObject({
      homeId: 'home-1',
      externalId: 'ext-1',
      name: 'Sensor',
      type: 'TEMPERATURE',
      vendor: 'Acme',
      integrationSource: 'sonoff',
    });
  });
  it('preserves typed domain errors and their actionable messages for command and automation guards', () => {
    const cases = [
      [new InvalidDeviceCommandError('dim'), InvalidDeviceCommandError, "Command 'dim' is not supported"],
      [new UnsupportedCommandError('sensor', 'turn_on'), UnsupportedCommandError, "device type 'sensor'"],
      [new AutomationLoopError(), AutomationLoopError, 'local loop detected'],
      [new InvalidAutomationRuleError('trigger'), InvalidAutomationRuleError, 'trigger must be a valid non-empty value'],
    ] as const;

    for (const [error, type, message] of cases) {
      expect(error).toBeInstanceOf(type);
      expect(error.name).toBe(type.name);
      expect(error.message).toContain(message);
    }
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

    it('debe permitir la reasignación de un dispositivo a otro cuarto', () => {
      const pendingDevice = createDiscoveredDevice(
        { homeId: 'home-1', externalId: 'ext-1', name: 'S', type: 'T', vendor: 'V' },
        mockDeps
      );
      const assignedDevice = assignDeviceToRoom(pendingDevice, 'room-1', mockDeps.clock);

      const reassignedDevice = assignDeviceToRoom(assignedDevice, 'room-2', mockDeps.clock);
      expect(reassignedDevice.roomId).toBe('room-2');
      expect(reassignedDevice.entityVersion).toBe(3);
    });

    it('debe normalizar el identificador de estancia y rechazar referencias vacías', () => {
      const pendingDevice = createDiscoveredDevice(
        { homeId: 'home-1', externalId: 'ext-1', name: 'S', type: 'T', vendor: 'V' },
        mockDeps
      );

      const assignedDevice = assignDeviceToRoom(pendingDevice, '  room-1  ', mockDeps.clock);

      expect(assignedDevice.roomId).toBe('room-1');
      expect(Object.isFrozen(assignedDevice)).toBe(true);
      expect(() => assignDeviceToRoom(pendingDevice, '   ', mockDeps.clock)).toThrow(InvalidTopologyReferenceError);
    });

    it('debe desasignar el dispositivo sin mutar el objeto original', () => {
      const pendingDevice = createDiscoveredDevice(
        { homeId: 'home-1', externalId: 'ext-1', name: 'S', type: 'T', vendor: 'V' },
        mockDeps
      );
      const assignedDevice = assignDeviceToRoom(pendingDevice, 'room-1', mockDeps.clock);

      const unassignedDevice = assignDeviceToRoom(assignedDevice, null, mockDeps.clock);

      expect(unassignedDevice).toMatchObject({ roomId: null, status: 'PENDING', entityVersion: 3, updatedAt: '2026-01-01T00:00:00Z' });
      expect(assignedDevice.roomId).toBe('room-1');
      expect(Object.isFrozen(unassignedDevice)).toBe(true);
    });
  });
});
