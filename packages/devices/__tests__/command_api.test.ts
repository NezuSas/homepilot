import { CommandController, handleError } from '../api';
import { InMemoryDeviceRepository } from '../infrastructure/repositories';
import { InMemoryDeviceEventPublisher } from '../domain/events';
import { InMemoryDeviceCommandDispatcher } from '../infrastructure/adapters/InMemoryDeviceCommandDispatcher';
import { TopologyReferencePort } from '../application/ports/TopologyReferencePort';
import { AuthenticatedHttpRequest } from '../../topology/api/core/http';

describe('Módulo Devices - Pruebas de Comando (API)', () => {
  let repo: InMemoryDeviceRepository;
  let publisher: InMemoryDeviceEventPublisher;
  let dispatcher: InMemoryDeviceCommandDispatcher;
  let topologyPort: TopologyReferencePort;
  let ctrl: CommandController;

  const mockDeps = {
    idGenerator: { generate: () => 'fixed-id' },
    clock: { now: () => '2026-01-01T00:00:00Z' }
  };

  beforeEach(() => {
    repo = new InMemoryDeviceRepository();
    publisher = new InMemoryDeviceEventPublisher();
    dispatcher = new InMemoryDeviceCommandDispatcher();
    topologyPort = {
      validateHomeExists: jest.fn().mockResolvedValue(undefined),
      validateHomeOwnership: jest.fn().mockResolvedValue(undefined),
      validateRoomBelongsToHome: jest.fn().mockResolvedValue(undefined)
    };
    ctrl = new CommandController(repo, publisher, topologyPort, dispatcher, mockDeps.idGenerator, mockDeps.clock);
  });

  const deviceBase = {
    id: 'd1', homeId: 'h1', externalId: 'ex', name: 'n', type: 't', vendor: 'v',
    entityVersion: 1, createdAt: 'x', updatedAt: 'x'
  };

  it('debe retornar 400 si falta el deviceId o es inválido', async () => {
    const req: AuthenticatedHttpRequest = { params: { deviceId: ' ' }, body: { command: 'turn_on' }, userId: 'u1' };
    const res = await ctrl.executeCommand(req);
    expect(res.statusCode).toBe(400);
  });

  it('debe retornar 400 si falta el comando o es inválido', async () => {
    const req: AuthenticatedHttpRequest = { params: { deviceId: 'd1' }, body: { command: ' ' }, userId: 'u1' };
    const res = await ctrl.executeCommand(req);
    expect(res.statusCode).toBe(400);
  });

  it('debe retornar 202 Accepted si el comando es válido y se despacha correctamente', async () => {
    await repo.saveDevice({ ...deviceBase, status: 'ASSIGNED', roomId: 'r1' });
    const req: AuthenticatedHttpRequest = { params: { deviceId: 'd1' }, body: { command: 'turn_on' }, userId: 'u1' };
    
    const res = await ctrl.executeCommand(req);
    expect(res.statusCode).toBe(202);
    expect(res.body).toEqual({ message: 'Command accepted and dispatched to gateway.' });
  });

  it('debe retornar 502 Bad Gateway si el dispatcher físico falla', async () => {
    await repo.saveDevice({ ...deviceBase, status: 'ASSIGNED', roomId: 'r1' });
    dispatcher.forceFailureSimulation(true);
    
    const req: AuthenticatedHttpRequest = { params: { deviceId: 'd1' }, body: { command: 'turn_on' }, userId: 'u1' };
    const res = await ctrl.executeCommand(req);
    expect(res.statusCode).toBe(502);
  });

  it('debe retornar 409 Conflict si el dispositivo está en PENDING', async () => {
    await repo.saveDevice({ ...deviceBase, status: 'PENDING', roomId: null });
    
    const req: AuthenticatedHttpRequest = { params: { deviceId: 'd1' }, body: { command: 'turn_on' }, userId: 'u1' };
    const res = await ctrl.executeCommand(req);
    expect(res.statusCode).toBe(409);
  });
});
