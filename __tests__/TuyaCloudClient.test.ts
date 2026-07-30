import { TuyaCloudClient } from '../packages/integrations/tuya/infrastructure/TuyaCloudClient';

describe('TuyaCloudClient', () => {
  beforeEach(() => {
    global.fetch = jest.fn() as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts Tuya Smart authorization with the user code and registered schema', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result: { qrcode: 'qr-token', expire_time: 120 } }),
    });

    const client = new TuyaCloudClient('homepilot-client', null, 'https://apigw.iotbing.com', 'homepilotauthorize');
    await expect(client.createAuthorization('ABC123')).resolves.toEqual({
      qrToken: 'qr-token',
      qrCode: 'tuyaSmart--qrLogin?token=qr-token',
      expiresAt: expect.any(Number),
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://apigw.iotbing.com/v1.0/m/life/home-assistant/qrcode/tokens?clientid=homepilot-client&usercode=ABC123&schema=homepilotauthorize',
      { method: 'POST' },
    );
  });

  it('returns the authorized session only after the QR code is accepted', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        t: 1_700_000_000_000,
        result: {
          uid: 'uid-1', terminal_id: 'terminal-1', endpoint: 'https://tuya.example',
          access_token: 'access', refresh_token: 'refresh', expire_time: 3600,
        },
      }),
    });

    const client = new TuyaCloudClient('homepilot-client', null);
    await expect(client.completeAuthorization('ABC123', 'qr-token')).resolves.toEqual({
      userCode: 'ABC123', endpoint: 'https://tuya.example', uid: 'uid-1', terminalId: 'terminal-1',
      accessToken: 'access', refreshToken: 'refresh', expiresAt: 1_700_003_600_000, updatedAt: expect.any(String),
    });
  });

  it('keeps polling state pending until Tuya confirms the authorization', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ success: false }) });
    const client = new TuyaCloudClient('homepilot-client', null);
    await expect(client.completeAuthorization('ABC123', 'qr-token')).resolves.toBeNull();
  });
});
