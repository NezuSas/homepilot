import { IntegrationsController, InboxController, DeviceController } from '../api';
import { InMemoryDeviceRepository } from '../infrastructure/repositories';
import { InMemoryDeviceEventPublisher } from '../domain/events';
import { TopologyReferencePort } from '../application/ports/TopologyReferencePort';
import { TopologyResourceNotFoundError, ForbiddenOwnershipError } from '../application/errors';
import { Device } from '../domain';
import { HttpRequest, AuthenticatedHttpRequest } from '../../topology/api/core/http';

describe('Devices Module E2E Spec (AC1-AC5)', () => {
  let repo: InMemoryDeviceRepository;
  let publisher: InMemoryDeviceEventPublisher;
  let topologyPort: TopologyReferencePort;
  let integrationsController: IntegrationsController;
  let inboxController: InboxController;
  let deviceController: DeviceController;
  
  const mockDeps = {
    idGenerator: { generate: () => 'UUID-MOCK' },
    clock: { now: () => '2026-01-01T00:00:00Z' }
  };

  beforeEach(() => {
    repo = new InMemoryDeviceRepository();
    publisher = new InMemoryDeviceEventPublisher();
    topologyPort = {
      validateHomeExists: jest.fn().mockResolvedValue(undefined),
      validateHomeOwnership: jest.fn().mockResolvedValue(undefined),
      validateRoomBelongsToHome: jest.fn().mockResolvedValue(undefined)
    };

    integrationsController = new IntegrationsController(repo, publisher, topologyPort, mockDeps.idGenerator, mockDeps.clock);
    inboxController = new InboxController(repo, topologyPort);
    deviceController = new DeviceController(repo, publisher, topologyPort, mockDeps.idGenerator, mockDeps.clock);
  });

  it('AC1: discovery válido -> 201, device PENDING, roomId null', async () => {
    const req: HttpRequest = {
      body: { homeId: 'home1', externalId: 'ext1', name: 'Sensor', type: 'TEMP', vendor: 'V' },
      headers: { 'x-correlation-id': 'corr-1' }
    };
    
    const response = await integrationsController.discoverDevice(req);
    expect(response.statusCode).toBe(201);
    
    const device = response.body as Device;
    expect(device.status).toBe('PENDING');
    expect(device.roomId).toBeNull();
  });

  it('AC2: inbox del owner -> 200 con devices PENDING', async () => {
    await integrationsController.discoverDevice({
      body: { homeId: 'home1', externalId: 'ext1', name: 'Sensor', type: 'TEMP', vendor: 'V' }
    });

    const req: AuthenticatedHttpRequest = { 
      params: { homeId: 'home1' }, 
      userId: 'owner1' 
    };
    
    const response = await inboxController.getInbox(req);
    expect(response.statusCode).toBe(200);
    
    const body = response.body as ReadonlyArray<Device>;
    expect(body.length).toBe(1);
    expect(body[0].status).toBe('PENDING');
  });

  it('AC3: inbox de usuario no dueño -> 403', async () => {
    topologyPort.validateHomeOwnership = jest.fn().mockRejectedValue(new ForbiddenOwnershipError('Block'));
    
    const req: AuthenticatedHttpRequest = { 
      params: { homeId: 'home1' }, 
      userId: 'hacker' 
    };
    
    const response = await inboxController.getInbox(req);
    expect(response.statusCode).toBe(403);
  });

  it('AC4: assign válido -> 200 y luego desaparece del inbox / queda ASSIGNED', async () => {
    const resDiscover = await integrationsController.discoverDevice({
      body: { homeId: 'home1', externalId: 'ext1', name: 'Sensor', type: 'TEMP', vendor: 'V' }
    });
    const createdDevice = resDiscover.body as Device;

    const reqAssign: AuthenticatedHttpRequest = {
      params: { deviceId: createdDevice.id },
      body: { roomId: 'room1' },
      userId: 'owner1'
    };
    
    const resAssign = await deviceController.assignDevice(reqAssign);
    expect(resAssign.statusCode).toBe(200);
    expect((resAssign.body as Device).status).toBe('ASSIGNED');

    const reqInbox: AuthenticatedHttpRequest = { 
      params: { homeId: 'home1' }, 
      userId: 'owner1' 
    };
    
    const resInbox = await inboxController.getInbox(reqInbox);
    expect((resInbox.body as ReadonlyArray<Device>).length).toBe(0);
  });

  it('AC5: intento de asignación cruzada inválida -> 403', async () => {
    const resDiscover = await integrationsController.discoverDevice({
      body: { homeId: 'home1', externalId: 'ext1', name: 'Sensor', type: 'TEMP', vendor: 'V' }
    });
    const createdDevice = resDiscover.body as Device;

    topologyPort.validateRoomBelongsToHome = jest.fn().mockRejectedValue(new ForbiddenOwnershipError('Cross-Home violation'));

    const reqAssign: AuthenticatedHttpRequest = {
      params: { deviceId: createdDevice.id },
      body: { roomId: 'room2-externa' },
      userId: 'owner1'
    };
    
    const resAssign = await deviceController.assignDevice(reqAssign);
    expect(resAssign.statusCode).toBe(403);
  });

  describe('Edge Cases Extra', () => {
    it('discovery duplicado -> 409', async () => {
      const req: HttpRequest = {
        body: { homeId: 'home1', externalId: 'ext1', name: 'Sensor', type: 'TEMP', vendor: 'V' }
      };
      await integrationsController.discoverDevice(req);
      const resDup = await integrationsController.discoverDevice(req);
      expect(resDup.statusCode).toBe(409);
    });

    it('home inexistente en discovery -> 404', async () => {
      topologyPort.validateHomeExists = jest.fn().mockRejectedValue(new TopologyResourceNotFoundError('Home', '404'));
      
      const req: HttpRequest = {
        body: { homeId: 'missing-home', externalId: 'ext1', name: 'N', type: 'T', vendor: 'V' }
      };
      const res = await integrationsController.discoverDevice(req);
      expect(res.statusCode).toBe(404);
    });

    it('body inválido -> 400', async () => {
      const req: HttpRequest = {
        body: { homeId: '', externalId: 'ext' } // missing fields
      };
      const res = await integrationsController.discoverDevice(req);
      expect(res.statusCode).toBe(400);
    });

    it('asimetría de parámetros inyectados rebotando transparentemente 400', async () => {
      const req: AuthenticatedHttpRequest = {
        params: { deviceId: 'd1' },
        body: {}, // Missing roomId
        userId: 'owner1'
      };
      const res = await deviceController.assignDevice(req);
      expect(res.statusCode).toBe(400);
    });
  });
});
