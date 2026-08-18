import { apiFetch, configureApiClient, readApiError } from '../apiClient';

const dispatchEvent = jest.fn();
const getItem = jest.fn();

beforeAll(() => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent, localStorage: { getItem } } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: { lang: 'es' } } });
});

beforeEach(() => {
  dispatchEvent.mockReset();
  getItem.mockReset().mockReturnValue(null);
  globalThis.fetch = jest.fn();
});

describe('apiFetch', () => {
  it('adds language and bearer token for protected requests', async () => {
    const unauthorized = jest.fn();
    configureApiClient({ getToken: () => 'token-1', onUnauthorized: unauthorized });
    getItem.mockReturnValue('en');
    (globalThis.fetch as jest.Mock).mockResolvedValue(new Response('{}', { status: 200 }));

    await apiFetch('/api/v1/devices', { headers: { 'X-Request': 'request-1' } });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/devices', expect.objectContaining({ headers: expect.any(Headers) }));
    const headers = (globalThis.fetch as jest.Mock).mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer token-1');
    expect(headers.get('Accept-Language')).toBe('en');
    expect(headers.get('X-Request')).toBe('request-1');
    expect(unauthorized).not.toHaveBeenCalled();
  });

  it('accepts Request inputs while adding the current authorization headers', async () => {
    configureApiClient({ getToken: () => 'token-request', onUnauthorized: jest.fn() });
    const request = new Request('http://localhost/api/v1/devices', { headers: { 'X-Request': 'request-object' } });
    (globalThis.fetch as jest.Mock).mockResolvedValue(new Response('{}', { status: 200 }));

    await apiFetch(request);

    expect(globalThis.fetch).toHaveBeenCalledWith(request, expect.objectContaining({ headers: expect.any(Headers) }));
    const headers = (globalThis.fetch as jest.Mock).mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer token-request');
  });
  it('does not authorize whitelisted requests and preflights missing protected tokens', async () => {
    configureApiClient({ getToken: () => null, onUnauthorized: jest.fn() });
    (globalThis.fetch as jest.Mock).mockResolvedValue(new Response('{}', { status: 200 }));
    await apiFetch('/api/v1/auth/login');
    const whitelistedHeaders = (globalThis.fetch as jest.Mock).mock.calls[0][1].headers as Headers;
    expect(whitelistedHeaders.get('Authorization')).toBeNull();

    const unauthorized = jest.fn();
    configureApiClient({ getToken: () => null, onUnauthorized: unauthorized });
    const result = await apiFetch('/api/v1/devices');
    expect(result.status).toBe(401);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(dispatchEvent).toHaveBeenCalled();
    expect(unauthorized).toHaveBeenCalled();
  });

  it('notifies only authenticated protected 401 responses', async () => {
    const unauthorized = jest.fn();
    configureApiClient({ getToken: () => 'token-1', onUnauthorized: unauthorized });
    (globalThis.fetch as jest.Mock).mockResolvedValue(new Response('{}', { status: 401 }));
    await apiFetch(new URL('http://localhost/api/v1/devices'));
    expect(unauthorized).toHaveBeenCalledTimes(1);
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
  });
});

describe('readApiError', () => {
  it.each([
    [JSON.stringify({ error: 'simple error' }), 'simple error'],
    [JSON.stringify({ error: { message: 'nested error' } }), 'nested error'],
    [JSON.stringify({ message: 'message error' }), 'message error'],
    ['not-json', 'fallback'],
  ])('extracts %s safely', async (body, expected) => {
    expect(await readApiError(new Response(body), 'fallback')).toBe(expected);
  });
});