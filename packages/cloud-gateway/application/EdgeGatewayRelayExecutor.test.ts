import { EdgeGatewayRelayExecutor } from './EdgeGatewayRelayExecutor';

const request = { protocolVersion: 1, type: 'cloud.request' as const, homeId: 'home-a', edgeId: 'edge-a', requestId: 'request-a', operation: 'device.command' as const, principal: { accountId: 'directory-a', role: 'owner' as const }, input: { deviceId: 'light-a', command: 'turn_on' }, expiresAt: '2030-01-01T00:01:00.000Z' };

describe('EdgeGatewayRelayExecutor', () => {
  const ports = () => ({ homes: { findAll: jest.fn().mockResolvedValue([{ id: 'local-home' }]) }, devices: { findAllByHomeId: jest.fn().mockResolvedValue([]), findDeviceById: jest.fn().mockResolvedValue({ id: 'light-a', homeId: 'local-home' }) }, dispatcher: { dispatch: jest.fn().mockResolvedValue(undefined) } });

  it('dispatches an owner command with a technical Cloud principal, never a linked local user', async () => {
    const dependencies = ports();
    await expect(new EdgeGatewayRelayExecutor(dependencies).execute(request)).resolves.toEqual({ status: 204 });
    expect(dependencies.dispatcher.dispatch).toHaveBeenCalledWith('light-a', expect.objectContaining({ name: 'turn_on', metadata: { userId: 'cloud-gateway', correlationId: 'cloud-gateway:request-a' } }));
  });

  it('returns devices only from the single installed local home', async () => {
    const dependencies = ports();
    const read = { ...request, operation: 'devices.read' as const, input: undefined };
    await expect(new EdgeGatewayRelayExecutor(dependencies).execute(read)).resolves.toEqual({ status: 200, payload: { devices: [] } });
    expect(dependencies.devices.findAllByHomeId).toHaveBeenCalledWith('local-home');
  });

  it('rejects member commands and devices outside the installed home', async () => {
    const dependencies = ports();
    await expect(new EdgeGatewayRelayExecutor(dependencies).execute({ ...request, principal: { ...request.principal, role: 'member' } })).resolves.toEqual({ status: 403 });
    dependencies.devices.findDeviceById.mockResolvedValue({ id: 'light-a', homeId: 'other-home' });
    await expect(new EdgeGatewayRelayExecutor(dependencies).execute(request)).resolves.toEqual({ status: 404 });
    expect(dependencies.dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('fails closed when the installation does not have exactly one local home', async () => {
    const dependencies = ports(); dependencies.homes.findAll.mockResolvedValue([]);
    await expect(new EdgeGatewayRelayExecutor(dependencies).execute(request)).resolves.toEqual({ status: 503 });
  });
});