import { TuyaCloudClient } from '../packages/integrations/tuya/infrastructure/TuyaCloudClient';

describe('TuyaCloudClient', () => {
  beforeEach(() => { global.fetch = jest.fn() as jest.Mock; });
  afterEach(() => { jest.restoreAllMocks(); });

  it('authenticates once and lists the authorised account devices', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, result: { access_token: 'token-1', expire_time: 3600 } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, result: [{ id: 'curtain-1', name: 'Living curtain', category: 'cl' }] }) });

    const client = new TuyaCloudClient({ endpoint: 'https://openapi.tuyaus.com', clientId: 'client-id', clientSecret: 'client-secret', userUid: 'user-uid' });
    await expect(client.listDevices()).resolves.toEqual([{ id: 'curtain-1', name: 'Living curtain', category: 'cl' }]);

    expect(global.fetch).toHaveBeenNthCalledWith(1, 'https://openapi.tuyaus.com/v1.0/token?grant_type=1', expect.objectContaining({ method: 'GET', headers: expect.objectContaining({ client_id: 'client-id', sign_method: 'HMAC-SHA256' }) }));
    expect(global.fetch).toHaveBeenNthCalledWith(2, 'https://openapi.tuyaus.com/v1.0/users/user-uid/devices', expect.objectContaining({ method: 'GET', headers: expect.objectContaining({ access_token: 'token-1' }) }));
  });

  it('sends a direct cover command through Tuya Cloud', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, result: { access_token: 'token-1', expire_time: 3600 } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, result: true }) });

    const client = new TuyaCloudClient({ endpoint: 'https://openapi.tuyaus.com', clientId: 'client-id', clientSecret: 'client-secret', userUid: 'user-uid' });
    await client.sendCommands('curtain-1', [{ code: 'control', value: 'open' }]);

    expect(global.fetch).toHaveBeenLastCalledWith('https://openapi.tuyaus.com/v1.0/devices/curtain-1/commands', expect.objectContaining({ method: 'POST', body: JSON.stringify({ commands: [{ code: 'control', value: 'open' }] }) }));
  });
});