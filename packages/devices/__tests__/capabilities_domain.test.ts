import { canDeviceExecuteCommand } from '../domain/capabilities';
import { UnsupportedCommandError } from '../domain';

describe('Devices: Capabilities Domain', () => {
  describe('canDeviceExecuteCommand', () => {
    it('AC1: debe permitir toggle para dispositivos de tipo light', () => {
      expect(canDeviceExecuteCommand('light', 'toggle')).toBe(true);
    });

    it('debe permitir turn_on para dispositivos de tipo switch', () => {
      expect(canDeviceExecuteCommand('switch', 'turn_on')).toBe(true);
    });

    it('AC2: debe rechazar comandos operativos para dispositivos tipo sensor', () => {
      expect(canDeviceExecuteCommand('sensor', 'turn_on')).toBe(false);
      expect(canDeviceExecuteCommand('sensor', 'turn_off')).toBe(false);
      expect(canDeviceExecuteCommand('sensor', 'toggle')).toBe(false);
    });

    it('debe rechazar comandos para tipos desconocidos (asumiendo cero capacidades)', () => {
      expect(canDeviceExecuteCommand('unknown_type', 'turn_on')).toBe(false);
    });
  });

  describe('UnsupportedCommandError', () => {
    it('debe generar un mensaje claro con el comando y el tipo', () => {
      const error = new UnsupportedCommandError('sensor', 'turn_on');
      expect(error.message).toContain('turn_on');
      expect(error.message).toContain('sensor');
    });
  });
});
