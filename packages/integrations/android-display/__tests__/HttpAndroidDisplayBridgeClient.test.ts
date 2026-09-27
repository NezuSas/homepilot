import { HttpAndroidDisplayBridgeClient } from '../infrastructure/HttpAndroidDisplayBridgeClient';

const token = 'x'.repeat(40);
const reply = (status: number, payload: object) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
}) as Response;

describe('HttpAndroidDisplayBridgeClient', () => {
  it('sends only typed private bridge requests with internal authentication', async () => {
    const fetcher = jest.fn().mockResolvedValue(reply(200, { state: 'online' })) as unknown as typeof fetch;
    const client = new HttpAndroidDisplayBridgeClient('http://127.0.0.1:5002', token, fetcher);
    expect(await client.connect('11111111-1111-4111-8111-111111111111', '192.168.1.37', 5555)).toBe('online');
    expect(fetcher).toHaveBeenCalledWith('http://127.0.0.1:5002/internal/v1/displays/connect',
      expect.objectContaining({ method: 'POST', headers: expect.objectContaining({
        'X-HomePilot-Bridge-Token': token,
      }), body: JSON.stringify({ sourceId: '11111111-1111-4111-8111-111111111111', host: '192.168.1.37', port: 5555 }) }));
  });

  it('does not expose raw bridge errors or permit arbitrary host configuration', async () => {
    expect(() => new HttpAndroidDisplayBridgeClient('http://192.168.1.37:5002', token)).toThrow('BRIDGE_CONFIG_INVALID');
    const fetcher = jest.fn().mockRejectedValue(new Error('secret ADB stdout')) as unknown as typeof fetch;
    const client = new HttpAndroidDisplayBridgeClient('http://127.0.0.1:5002', token, fetcher);
    await expect(client.state('11111111-1111-4111-8111-111111111111')).rejects.toMatchObject({ code: 'BRIDGE_UNAVAILABLE' });
  });

  it('fails closed without a token and maps a bridge timeout to a safe code', async () => {
    const fetcher = jest.fn().mockResolvedValue(reply(504, { error: 'ADB_TIMEOUT' })) as unknown as typeof fetch;
    await expect(new HttpAndroidDisplayBridgeClient('http://127.0.0.1:5002', '', fetcher)
      .state('11111111-1111-4111-8111-111111111111')).rejects.toMatchObject({ code: 'BRIDGE_NOT_CONFIGURED' });
    await expect(new HttpAndroidDisplayBridgeClient('http://127.0.0.1:5002', token, fetcher)
      .state('11111111-1111-4111-8111-111111111111')).rejects.toMatchObject({ code: 'ADB_TIMEOUT' });
  });

  it('sanitizes incomplete inspect metadata and distinguishes screen from connection', async () => {
    const fetcher = jest.fn().mockResolvedValue(reply(200, { metadata: {
      manufacturer: 'Droidlogic', screenState: 'asleep', density: '480', androidId: null,
    } })) as unknown as typeof fetch;
    const client = new HttpAndroidDisplayBridgeClient('http://127.0.0.1:5002', token, fetcher);
    expect(await client.inspect('11111111-1111-4111-8111-111111111111')).toEqual(expect.objectContaining({
      manufacturer: 'Droidlogic', androidId: null, densityDpi: 480, screenState: 'asleep',
    }));
  });
});
