import { NativeCameraDeviceDriver } from '../infrastructure/NativeCameraDeviceDriver';
import type { NativeCameraSource, NativeCameraSourceRepository } from '../../../devices/domain/repositories/NativeCameraSourceRepository';
import type { NativeCameraDriverRegistry } from '../application/ports/NativeCameraDriverRegistry';
import type { NativeCameraDriver } from '../application/ports/NativeCameraDriver';
import type { Device } from '../../../devices/domain/types';
import type { DeviceDriverContext } from '../../../devices/domain/drivers/DeviceDriver';

function createTestSource(overrides?: Partial<NativeCameraSource>): NativeCameraSource {
  return {
    deviceId: 'cam-1', homeId: 'home-1', sourceType: 'onvif-ptz', name: 'PTZ Cam',
    host: '192.168.1.50', onvifPort: 8000, rtspPort: 554, username: 'admin', password: 'secret',
    rtspPath: '/live/ch0', enabled: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    profileToken: 'Profile_1', ptzConfigurationToken: 'Ptz_1', ptzSupported: true,
    ...overrides
  };
}

function createTestDevice(overrides?: Partial<Device>): Device {
  return {
    id: 'cam-1', homeId: 'home-1', roomId: 'room-1', externalId: 'native:cam-1', name: 'PTZ Cam',
    type: 'camera', vendor: 'onvif-ptz', status: 'ASSIGNED', integrationSource: 'native-camera',
    invertState: false, lastKnownState: { ptz: true }, entityVersion: 1,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

const CONTEXT: DeviceDriverContext = { userId: 'u1', correlationId: 'corr-1' };

describe('NativeCameraDeviceDriver', () => {
  let sourceRepository: jest.Mocked<NativeCameraSourceRepository>;
  let driver: jest.Mocked<NativeCameraDriver>;
  let driverRegistry: jest.Mocked<NativeCameraDriverRegistry>;
  let deviceDriver: NativeCameraDeviceDriver;

  beforeEach(() => {
    driver = {
      sourceType: 'onvif-ptz',
      supportsDiscovery: jest.fn().mockReturnValue(true),
      discover: jest.fn().mockResolvedValue([]),
      negotiate: jest.fn(),
      supportsPtz: jest.fn().mockReturnValue(true),
      movePtz: jest.fn().mockResolvedValue(undefined),
      stopPtz: jest.fn().mockResolvedValue(undefined),
    };
    sourceRepository = {
      findByDeviceId: jest.fn().mockReturnValue(createTestSource()),
      findByHomeId: jest.fn(),
      findDuplicate: jest.fn(),
      save: jest.fn(),
    };
    driverRegistry = {
      resolve: jest.fn().mockReturnValue(driver),
      discoverableDrivers: jest.fn().mockReturnValue([driver]),
    };
    deviceDriver = new NativeCameraDeviceDriver(sourceRepository, driverRegistry);
  });

  it('supports only native-camera devices', () => {
    expect(deviceDriver.supports(createTestDevice())).toBe(true);
    expect(deviceDriver.supports(createTestDevice({ integrationSource: 'ha' }))).toBe(false);
  });

  it('rejects any command other than ptz_move/ptz_stop', async () => {
    const result = await deviceDriver.executeCommand(createTestDevice(), { name: 'turn_on' }, CONTEXT);
    expect(result.success).toBe(false);
  });

  it('fails cleanly when the native camera source is not found', async () => {
    sourceRepository.findByDeviceId.mockReturnValue(null);
    const result = await deviceDriver.executeCommand(createTestDevice(), { name: 'ptz_move', params: { pan: 0.5 } }, CONTEXT);
    expect(result.success).toBe(false);
    expect(result.error).toContain('no encontrada');
  });

  it('fails cleanly when the camera does not support PTZ', async () => {
    sourceRepository.findByDeviceId.mockReturnValue(createTestSource({ ptzSupported: false }));
    const result = await deviceDriver.executeCommand(createTestDevice(), { name: 'ptz_move', params: { pan: 0.5 } }, CONTEXT);
    expect(result.success).toBe(false);
    expect(result.error).toContain('PTZ');
  });

  it('rejects ptz_move with no axis specified', async () => {
    const result = await deviceDriver.executeCommand(createTestDevice(), { name: 'ptz_move', params: {} }, CONTEXT);
    expect(result.success).toBe(false);
    expect(driver.movePtz).not.toHaveBeenCalled();
  });

  it('dispatches ptz_move with the normalized vector to the resolved driver', async () => {
    const result = await deviceDriver.executeCommand(createTestDevice(), { name: 'ptz_move', params: { pan: 0.5, tilt: -0.2 } }, CONTEXT);

    expect(result.success).toBe(true);
    expect(driverRegistry.resolve).toHaveBeenCalledWith('onvif-ptz');
    expect(driver.movePtz).toHaveBeenCalledWith(
      expect.objectContaining({ host: '192.168.1.50', rtspPort: 554 }),
      expect.objectContaining({ profileToken: 'Profile_1', ptzConfigurationToken: 'Ptz_1' }),
      { pan: 0.5, tilt: -0.2, zoom: 0 }
    );
  });

  it('dispatches ptz_stop to the resolved driver', async () => {
    const result = await deviceDriver.executeCommand(createTestDevice(), { name: 'ptz_stop' }, CONTEXT);

    expect(result.success).toBe(true);
    expect(driver.stopPtz).toHaveBeenCalledWith(
      expect.objectContaining({ host: '192.168.1.50' }),
      expect.objectContaining({ profileToken: 'Profile_1' })
    );
  });

  it('returns a failure result when the driver does not implement movePtz', async () => {
    driver.movePtz = undefined;
    const result = await deviceDriver.executeCommand(createTestDevice(), { name: 'ptz_move', params: { pan: 0.5 } }, CONTEXT);
    expect(result.success).toBe(false);
  });

  it('surfaces the driver error message when movePtz throws', async () => {
    driver.movePtz = jest.fn().mockRejectedValue(new Error('cámara no respondió'));
    const result = await deviceDriver.executeCommand(createTestDevice(), { name: 'ptz_move', params: { pan: 0.5 } }, CONTEXT);
    expect(result.success).toBe(false);
    expect(result.error).toBe('cámara no respondió');
  });
  it('normalizes non-Error PTZ failures into a stable user-facing result', async () => {
    driver.stopPtz = jest.fn().mockRejectedValue('transport failure');

    const result = await deviceDriver.executeCommand(createTestDevice(), { name: 'ptz_stop' }, CONTEXT);

    expect(result).toEqual({ success: false, error: 'Error PTZ desconocido' });
  });
});
