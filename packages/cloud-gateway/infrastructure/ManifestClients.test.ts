import { DirectoryEdgeServiceTokenClient, directoryEdgeServiceTokenUrl } from './DirectoryEdgeServiceTokenClient';
import { IntentFlowManifestClient, intentFlowManifestsUrl } from './IntentFlowManifestClient';

const config = { url: 'wss://accounts.example.test:8443/gateway/edge', token: 'edge-secret-never-log', homeId: 'home', edgeId: 'edge' };
function response(status: number, payload: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => payload } as Response;
}

describe('Directory Edge Service Token client', () => {
  it('derives HTTPS Directory URL from provisioned WSS and preserves port', () => {
    expect(directoryEdgeServiceTokenUrl(config.url))
      .toBe('https://accounts.example.test:8443/directory/edge-service-token');
    for (const url of ['ws://accounts.example.test/gateway/edge',
      'wss://user:pass@accounts.example.test/gateway/edge',
      'wss://accounts.example.test/gateway/edge?x=1',
      'wss://accounts.example.test/gateway/edge#x']) {
      expect(() => directoryEdgeServiceTokenUrl(url)).toThrow();
    }
  });

  it('re-reads provisioned Edge credential and posts without a body', async () => {
    const provider = jest.fn().mockReturnValue(config);
    const http = jest.fn().mockResolvedValue(response(200, { token: 'ephemeral' }));
    const client = new DirectoryEdgeServiceTokenClient(provider, http);
    await expect(client.requestToken()).resolves.toBe('ephemeral');
    await client.requestToken();
    expect(provider).toHaveBeenCalledTimes(2);
    expect(http.mock.calls[0][1]).toEqual(expect.objectContaining({
      method: 'POST', headers: { Authorization: `Bearer ${config.token}` }, signal: expect.any(AbortSignal),
    }));
    expect(http.mock.calls[0][1].body).toBeUndefined();
  });

  it('requests command.execute with the same Edge credential without changing manifest.read', async () => {
    const http = jest.fn().mockResolvedValue(response(200, { token: 'command-token', expiresIn: 120 }));
    const client = new DirectoryEdgeServiceTokenClient(() => config, http);
    await expect(client.requestCommandToken()).resolves.toEqual({ token: 'command-token', expiresIn: 120 });
    expect(http).toHaveBeenCalledWith(directoryEdgeServiceTokenUrl(config.url), expect.objectContaining({
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'homepilot.command.execute' }),
    }));
    await expect(client.requestToken()).resolves.toBe('command-token');
    expect(http.mock.calls[1][1].body).toBeUndefined();
  });

  it.each([0, -1, 121, '120'])('rejects invalid command-token lifetime %p', async (expiresIn) => {
    const client = new DirectoryEdgeServiceTokenClient(() => config,
      jest.fn().mockResolvedValue(response(200, { token: 'command-token', expiresIn })));
    await expect(client.requestCommandToken()).rejects.toMatchObject({ code: 'INTENTFLOW_DIRECTORY_RESPONSE_INVALID' });
  });

  it.each([401, 403, 503])('classifies Directory HTTP %s without leaking token', async (status) => {
    const client = new DirectoryEdgeServiceTokenClient(() => config, jest.fn().mockResolvedValue(response(status, {})));
    await expect(client.requestToken()).rejects.toMatchObject({
      code: status >= 500 ? 'INTENTFLOW_DIRECTORY_UNAVAILABLE' : 'INTENTFLOW_DIRECTORY_REJECTED',
    });
  });

  it('rejects missing token and sanitizes errors', async () => {
    await expect(new DirectoryEdgeServiceTokenClient(() => config,
      jest.fn().mockResolvedValue(response(200, { token: '' }))).requestToken())
      .rejects.toMatchObject({ code: 'INTENTFLOW_DIRECTORY_RESPONSE_INVALID' });
    const failure = await new DirectoryEdgeServiceTokenClient(() => config,
      jest.fn().mockRejectedValue(new Error(config.token))).requestToken().catch((error: unknown) => error);
    expect(String(failure)).not.toContain(config.token);
  });

  it('rejects invalid Directory JSON without exposing the underlying error', async () => {
    const http = jest.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => { throw new Error(config.token); },
    } as unknown as Response);
    const failure = await new DirectoryEdgeServiceTokenClient(() => config, http)
      .requestToken().catch((error: unknown) => error);
    expect(failure).toMatchObject({ code: 'INTENTFLOW_DIRECTORY_RESPONSE_INVALID' });
    expect(String(failure)).not.toContain(config.token);
    expect(http).toHaveBeenCalledTimes(1);
  });

  it('does not retry Directory HTTP or network failures', async () => {
    const httpFailure = jest.fn().mockResolvedValue(response(503, {}));
    await expect(new DirectoryEdgeServiceTokenClient(() => config, httpFailure).requestToken())
      .rejects.toMatchObject({ code: 'INTENTFLOW_DIRECTORY_UNAVAILABLE' });
    expect(httpFailure).toHaveBeenCalledTimes(1);

    const networkFailure = jest.fn().mockRejectedValue(new Error('network unavailable'));
    await expect(new DirectoryEdgeServiceTokenClient(() => config, networkFailure).requestToken())
      .rejects.toMatchObject({ code: 'INTENTFLOW_DIRECTORY_UNAVAILABLE' });
    expect(networkFailure).toHaveBeenCalledTimes(1);
  });

  it('aborts a hung Directory request at ten seconds', async () => {
    jest.useFakeTimers();
    try {
      const http = jest.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      }));
      const request = new DirectoryEdgeServiceTokenClient(() => config, http).requestToken();
      jest.advanceTimersByTime(10_000);
      await expect(request).rejects.toMatchObject({ code: 'INTENTFLOW_DIRECTORY_TIMEOUT' });
    } finally { jest.useRealTimers(); }
  });
});

describe('IntentFlow manifest client', () => {
  it('requires HTTPS and never accepts URL credentials/query/fragment', () => {
    expect(intentFlowManifestsUrl('https://intent.example.test:9443/'))
      .toBe('https://intent.example.test:9443/api/homepilot/service/manifests/');
    for (const url of ['http://intent.example.test', 'https://u:p@intent.example.test',
      'https://intent.example.test/?x=1', 'https://intent.example.test/#x']) {
      expect(() => intentFlowManifestsUrl(url)).toThrow();
    }
  });

  it('sends only GET with ephemeral bearer and does not retry', async () => {
    const http = jest.fn().mockResolvedValue(response(200, { schemaVersion: 'homepilot.manifest-bundle.v1' }));
    const client = new IntentFlowManifestClient(() => 'https://intent.example.test', http);
    await client.getManifests('service-secret');
    expect(http).toHaveBeenCalledTimes(1);
    expect(http.mock.calls[0][1]).toEqual(expect.objectContaining({
      method: 'GET', headers: { Authorization: 'Bearer service-secret' }, signal: expect.any(AbortSignal),
    }));
  });

  it.each([401, 403, 503])('classifies manifest HTTP %s', async (status) => {
    const client = new IntentFlowManifestClient(() => 'https://intent.example.test',
      jest.fn().mockResolvedValue(response(status, {})));
    await expect(client.getManifests('token')).rejects.toMatchObject({
      code: status >= 500 ? 'INTENTFLOW_MANIFEST_UNAVAILABLE' : 'INTENTFLOW_MANIFEST_REJECTED',
    });
  });

  it('rejects invalid IntentFlow JSON', async () => {
    const http = jest.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => { throw new SyntaxError('invalid JSON'); },
    } as unknown as Response);
    await expect(new IntentFlowManifestClient(() => 'https://intent.example.test', http).getManifests('token'))
      .rejects.toMatchObject({ code: 'INTENTFLOW_MANIFEST_RESPONSE_INVALID' });
    expect(http).toHaveBeenCalledTimes(1);
  });

  it('does not retry IntentFlow HTTP or network failures', async () => {
    const httpFailure = jest.fn().mockResolvedValue(response(503, {}));
    await expect(new IntentFlowManifestClient(() => 'https://intent.example.test', httpFailure).getManifests('token'))
      .rejects.toMatchObject({ code: 'INTENTFLOW_MANIFEST_UNAVAILABLE' });
    expect(httpFailure).toHaveBeenCalledTimes(1);

    const networkFailure = jest.fn().mockRejectedValue(new Error('network unavailable'));
    await expect(new IntentFlowManifestClient(() => 'https://intent.example.test', networkFailure).getManifests('token'))
      .rejects.toMatchObject({ code: 'INTENTFLOW_MANIFEST_UNAVAILABLE' });
    expect(networkFailure).toHaveBeenCalledTimes(1);
  });

  it('aborts a hung manifest request at ten seconds', async () => {
    jest.useFakeTimers();
    try {
      const http = jest.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      }));
      const request = new IntentFlowManifestClient(() => 'https://intent.example.test', http).getManifests('token');
      jest.advanceTimersByTime(10_000);
      await expect(request).rejects.toMatchObject({ code: 'INTENTFLOW_MANIFEST_TIMEOUT' });
    } finally { jest.useRealTimers(); }
  });
});
