import { handleError } from '../api/core/errorHandler';
import { CommandController } from '../api/controllers/CommandController';
import { UnsupportedCommandError, Device } from '../domain';
import { DeviceNotFoundError } from '../application/errors';
import { InMemoryDeviceRepository } from '../infrastructure/repositories/InMemoryDeviceRepository';
import { InMemoryDeviceEventPublisher } from '../domain/events/InMemoryDeviceEventPublisher';
import { InMemoryActivityLogRepository } from '../infrastructure/repositories/InMemoryActivityLogRepository';
import { TopologyReferencePort } from '../application/ports/TopologyReferencePort';
import { DeviceCommandDispatcherPort } from '../application/ports/DeviceCommandDispatcherPort';
import { AuthenticatedHttpRequest } from '../../topology/api/core/http';

describe('Devices: Capabilities API', () => {
  describe('errorHandler: UnsupportedCommandError', () => {
    it('debe mapear UnsupportedCommandError a 400 Bad Request', () => {
      const error = new UnsupportedCommandError('sensor', 'turn_on');
      const res = handleError(error);
      
      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({ error: 'Bad Request' });
    });

    it('debe conservar mappings anteriores (ej. 404)', () => {
      const error = new DeviceNotFoundError('d-unknown');
      const res = handleError(error);
      
      expect(res.statusCode).toBe(404);
      expect(res.body).toMatchObject({ error: 'Not Found' });
    });
  });

  describe('CommandController', () => {
    it('debe retornar 400 si el caso de uso lanza UnsupportedCommandError', async () => {
      const repo = new InMemoryDeviceRepository();
      const pub = new InMemoryDeviceEventPublisher();
      const log = new InMemoryActivityLogRepository();
      
      const mockTopo: jest.Mocked<TopologyReferencePort> = { 
        validateHomeOwnership: jest.fn().mockResolvedValue(undefined),
        validateHomeExists: jest.fn().mockResolvedValue(undefined),
        validateRoomBelongsToHome: jest.fn().mockResolvedValue(undefined)
      };

      const mockDisp: jest.Mocked<DeviceCommandDispatcherPort> = { 
        dispatch: jest.fn().mockResolvedValue(undefined) 
      };

      const idGen = { generate: () => 'id' };
      const clock = { now: () => 'now' };

      const controller = new CommandController(repo, pub, mockTopo, mockDisp, log, idGen, clock);

      // Seteamos un sensor
      const sensorDevice: Device = { 
        id: 'd1', 
        type: 'sensor', 
        status: 'ASSIGNED', 
        homeId: 'h1', 
        externalId: 'ext-sensor', 
        name: 'n', 
        vendor: 'v',
        entityVersion: 1, 
        createdAt: 'x', 
        updatedAt: 'x', 
        roomId: 'r1', 
        lastKnownState: null
      };
      await repo.saveDevice(sensorDevice);

      const req: AuthenticatedHttpRequest = {
        params: { deviceId: 'd1' },
        body: { command: 'turn_on' },
        userId: 'u1',
        headers: {}
      } as AuthenticatedHttpRequest;

      const res = await controller.executeCommand(req);
      
      expect(res.statusCode).toBe(400);
      
      // Type narrowing seguro para el cuerpo de la respuesta
      if (res.body && typeof res.body === 'object' && 'message' in res.body) {
        expect((res.body as { message: string }).message).toContain('not supported');
      } else {
        fail('Response body should contain a message');
      }
    });
  });
});
