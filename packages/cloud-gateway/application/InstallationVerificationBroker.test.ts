import {
  directoryAttestationUrl,
  InstallationVerificationBroker,
  InstallationVerificationError,
  parseInstallationChallenge,
} from './InstallationVerificationBroker';

const installationId = '098ced36-2143-4ca2-a1fb-3afdc32117b7';
const challengeId = 'e974d0f6-60b2-4ed0-b759-f8713156d37f';
const nonce = Buffer.alloc(32, 7).toString('base64url');
const challenge = { installationId, challengeId, nonce };
const config = { url: 'wss://accounts.example.test/gateway/edge', token: 'edge-secret', homeId: 'home-1', edgeId: 'edge-1' };
const validProof = { attestation: 'cGF5bG9hZA.c2lnbmF0dXJl', expiresIn: 90 };

function response(status: number, payload: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => payload } as Response;
}

function broker(fetchMock: jest.Mock, edgeConfig: typeof config | null = config): InstallationVerificationBroker {
  return new InstallationVerificationBroker(() => edgeConfig, fetchMock);
}

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code });
}

describe('InstallationVerificationBroker input and cloud identity', () => {
  it('accepts UUIDs and exactly 32 random bytes encoded as unpadded base64url', () => {
    expect(parseInstallationChallenge(challenge)).toEqual(challenge);
    expect(nonce).toHaveLength(43);
  });

  it.each([
    [{ ...challenge, installationId: 'not-a-uuid' }, 'installation UUID'],
    [{ ...challenge, challengeId: 'not-a-uuid' }, 'challenge UUID'],
    [{ ...challenge, nonce: '' }, 'empty nonce'],
    [{ ...challenge, nonce: `${nonce}=` }, 'padded nonce'],
    [{ ...challenge, nonce: 'short' }, 'short nonce'],
    [{ ...challenge, nonce: `${nonce.slice(0, 42)}+` }, 'invalid nonce characters'],
    [{ ...challenge, homeId: 'injected' }, 'extra identity'],
    [{ ...challenge, token: 'injected' }, 'extra credential'],
    [{ ...challenge, directoryUrl: 'https://attacker.test' }, 'extra URL'],
  ])('rejects %s (%s) before any network call', async (input, _description) => {
    const fetchMock = jest.fn();
    await expectCode(broker(fetchMock).attest(input), 'INSTALLATION_VERIFICATION_INPUT_INVALID');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires the existing complete cloud identity and a valid WSS URL', async () => {
    await expectCode(broker(jest.fn(), null).attest(challenge), 'INSTALLATION_VERIFICATION_CLOUD_NOT_PAIRED');
    await expectCode(broker(jest.fn(), { ...config, token: '' }).attest(challenge), 'INSTALLATION_VERIFICATION_CLOUD_NOT_PAIRED');
    await expectCode(broker(jest.fn(), { ...config, url: 'http://localhost/gateway/edge' }).attest(challenge), 'INSTALLATION_VERIFICATION_CLOUD_NOT_PAIRED');
    await expectCode(broker(jest.fn(), { ...config, url: 'wss://user:pass@accounts.example.test/gateway/edge' }).attest(challenge), 'INSTALLATION_VERIFICATION_CLOUD_NOT_PAIRED');
  });

  it('derives only HTTPS Directory origin and preserves an explicit port', () => {
    expect(directoryAttestationUrl(config.url)).toBe('https://accounts.example.test/directory/edge-attestation');
    expect(directoryAttestationUrl('wss://accounts.example.test:8443/gateway/edge'))
      .toBe('https://accounts.example.test:8443/directory/edge-attestation');
    expect(() => directoryAttestationUrl('wss://accounts.example.test/gateway/edge?host=evil'))
      .toThrow(InstallationVerificationError);
    expect(() => directoryAttestationUrl('wss://accounts.example.test/gateway/edge#fragment'))
      .toThrow(InstallationVerificationError);
  });
});

describe('InstallationVerificationBroker Directory exchange', () => {
  it('uses only the provisioned Edge token and sends exactly three challenge fields', async () => {
    const fetchMock = jest.fn().mockResolvedValue(response(200, validProof));
    await expect(broker(fetchMock).attest(challenge)).resolves.toEqual(validProof);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://accounts.example.test/directory/edge-attestation');
    expect(init).toEqual(expect.objectContaining({
      method: 'POST',
      headers: { Authorization: 'Bearer edge-secret', 'Content-Type': 'application/json' },
      signal: expect.any(AbortSignal),
    }));
    expect(JSON.parse(init.body as string)).toEqual(challenge);
    expect(JSON.stringify(init)).not.toContain('home-1');
    expect(JSON.stringify(init)).not.toContain('edge-1');
  });

  it.each([401, 403, 400])('maps Directory %s to a stable rejection', async (status) => {
    await expectCode(broker(jest.fn().mockResolvedValue(response(status, {}))).attest(challenge),
      'INSTALLATION_VERIFICATION_DIRECTORY_REJECTED');
  });

  it('maps server and network failures to unavailable without retrying', async () => {
    const serverError = jest.fn().mockResolvedValue(response(503, {}));
    await expectCode(broker(serverError).attest(challenge), 'INSTALLATION_VERIFICATION_DIRECTORY_UNAVAILABLE');
    expect(serverError).toHaveBeenCalledTimes(1);
    const networkError = jest.fn().mockRejectedValue(new Error('socket failed'));
    await expectCode(broker(networkError).attest(challenge), 'INSTALLATION_VERIFICATION_DIRECTORY_UNAVAILABLE');
    expect(networkError).toHaveBeenCalledTimes(1);
  });

  it('aborts after ten seconds and reports timeout', async () => {
    jest.useFakeTimers();
    try {
      const fetchMock = jest.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      }));
      const operation = broker(fetchMock).attest(challenge);
      jest.advanceTimersByTime(10_000);
      await expectCode(operation, 'INSTALLATION_VERIFICATION_TIMEOUT');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it.each([
    { ...validProof, homeId: 'unexpected' },
    { ...validProof, expiresIn: 91 },
    { ...validProof, attestation: 'bad' },
    { ...validProof, attestation: 'abc=.def' },
    { ...validProof, attestation: 'a.b.c' },
  ])('rejects malformed Directory responses without revealing them', async (payload) => {
    await expectCode(broker(jest.fn().mockResolvedValue(response(200, payload))).attest(challenge),
      'INSTALLATION_VERIFICATION_DIRECTORY_RESPONSE_INVALID');
  });

  it('rejects invalid JSON from Directory', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); } });
    await expectCode(broker(fetchMock).attest(challenge), 'INSTALLATION_VERIFICATION_DIRECTORY_RESPONSE_INVALID');
  });
});
