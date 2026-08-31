import { EdgeGatewayRelayExecutor } from './EdgeGatewayRelayExecutor';

const request = { protocolVersion: 1, type: 'cloud.request' as const, homeId: 'home-a', edgeId: 'edge-a', requestId: 'request-a', operation: 'device.command' as const, principal: { accountId: 'directory-a', role: 'owner' as const }, input: { deviceId: 'light-a', command: 'turn_on' }, expiresAt: '2030-01-01T00:01:00.000Z' };

describe('EdgeGatewayRelayExecutor', () => {
  const ports = () => ({
    directoryLinks: { findByDirectoryAccountId: jest.fn().mockResolvedValue({ localUserId: 'local-a' }) },
    users: { findById: jest.fn().mockResolvedValue({ id: 'local-a', isActive: true }) },
    dashboards: { getDashboardsForUser: jest.fn().mockResolvedValue([]) },
    devices: { findAll: jest.fn().mockResolvedValue([]) },
    dispatcher: { dispatch: jest.fn().mockResolvedValue(undefined) },
  });

  it('dispatches a permitted command as the linked local user with correlation', async () => {
    const dependencies = ports();
    await expect(new EdgeGatewayRelayExecutor(dependencies).execute(request)).resolves.toEqual({ status: 204 });
    expect(dependencies.dispatcher.dispatch).toHaveBeenCalledWith('light-a', expect.objectContaining({ name: 'turn_on', metadata: { userId: 'local-a', correlationId: 'cloud-gateway:request-a' } }));
  });

  it('does not dispatch for an unlinked account', async () => {
    const dependencies = ports(); dependencies.directoryLinks.findByDirectoryAccountId.mockResolvedValue(null);
    await expect(new EdgeGatewayRelayExecutor(dependencies).execute(request)).resolves.toEqual({ status: 403 });
    expect(dependencies.dispatcher.dispatch).not.toHaveBeenCalled();
  });
});
