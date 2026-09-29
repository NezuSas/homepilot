import type { CloudGatewayConnectorConfig } from './CloudEdgeConfigProvider';
import type { EdgeDeviceIdentityService } from '../application/EdgeDeviceIdentityService';
import { DeviceIdentityError } from '../application/DeviceIdentityProvider';
import { DirectoryTokenError, directoryEdgeDeviceUrl } from '../application/EdgeDeviceContract';

export { DirectoryTokenError, directoryEdgeDeviceUrl } from '../application/EdgeDeviceContract';
export type { DirectoryTokenErrorCode } from '../application/EdgeDeviceContract';

export const MANIFEST_REQUEST_TIMEOUT_MS = 10_000;
export const COMMAND_TOKEN_TTL_SECONDS = 120;

type EdgeConfigProvider = () => CloudGatewayConnectorConfig | null;
type HttpFetch = (url: string, init: RequestInit) => Promise<Response>;

export function directoryEdgeServiceTokenUrl(gatewayUrl: string): string {
  return directoryEdgeDeviceUrl(gatewayUrl, 'service-token');
}

export function canonicalDeviceProofPayload(input: {
  homeId: string; edgeId: string; challengeId: string; nonce: string; scope: 'homepilot.manifest.read' | 'homepilot.command.execute';
}): Buffer {
  const fields = [input.homeId, input.edgeId, input.challengeId, input.nonce, input.scope];
  if (fields.some(value => !value || /[\r\n,]/.test(value))) throw new DeviceIdentityError();
  return Buffer.from(`homepilot.edge-device-proof.v1\n${fields.join('\n')}\n`, 'utf8');
}

/** The provisioned Edge credential is re-read for every exchange. */
export class DirectoryEdgeServiceTokenClient {
  constructor(private readonly configProvider: EdgeConfigProvider, private readonly httpFetch: HttpFetch = fetch,
    private readonly identity?: EdgeDeviceIdentityService) {}

  async requestToken(): Promise<string> {
    return (await this.exchange()).token;
  }

  async requestCommandToken(): Promise<{ token: string; expiresIn: number }> {
    return this.exchange('homepilot.command.execute');
  }

  private async exchange(scope?: 'homepilot.command.execute'): Promise<{ token: string; expiresIn: number }> {
    const config = this.configProvider();
    if (!config?.token?.trim() || !config.homeId?.trim() || !config.edgeId?.trim()) {
      throw new DirectoryTokenError('INTENTFLOW_EDGE_NOT_PAIRED');
    }
    const url = directoryEdgeServiceTokenUrl(config.url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MANIFEST_REQUEST_TIMEOUT_MS);
    try {
      const identity = this.identity;
      const binding = identity?.getBinding();
      let body: string | undefined = scope ? JSON.stringify({ scope }) : undefined;
      if (binding && identity) {
        identity.assertReady();
        if (binding.homeId !== config.homeId || binding.edgeId !== config.edgeId) throw new DeviceIdentityError();
        const requestedScope = scope ?? 'homepilot.manifest.read';
        const challengeResponse = await this.httpFetch(directoryEdgeDeviceUrl(config.url, 'challenge'), {
          method: 'POST', headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope: requestedScope }), signal: controller.signal,
        });
        if (!challengeResponse.ok) throw new DirectoryTokenError(challengeResponse.status >= 500
          ? 'INTENTFLOW_DIRECTORY_UNAVAILABLE' : 'INTENTFLOW_DIRECTORY_REJECTED');
        let challenge: unknown;
        try { challenge = await challengeResponse.json(); }
        catch { throw new DirectoryTokenError('INTENTFLOW_DIRECTORY_RESPONSE_INVALID'); }
        if (!isDeviceChallenge(challenge, requestedScope)) throw new DirectoryTokenError('INTENTFLOW_DIRECTORY_RESPONSE_INVALID');
        const payload = canonicalDeviceProofPayload({ homeId: binding.homeId, edgeId: binding.edgeId,
          challengeId: challenge.challengeId, nonce: challenge.nonce, scope: requestedScope });
        let signature: Buffer;
        let currentKeyId: string;
        try {
          signature = await identity.provider.sign(payload);
          currentKeyId = await identity.provider.getKeyId();
        }
        catch { throw new DeviceIdentityError(); }
        if (signature.length !== 64 || currentKeyId !== binding.keyId) throw new DeviceIdentityError();
        body = JSON.stringify({ scope: requestedScope, deviceProof: {
          challengeId: challenge.challengeId, keyId: binding.keyId, signature: signature.toString('base64url'),
        } });
      }
      const response = await this.httpFetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body } : {}),
        signal: controller.signal,
      });
      if (controller.signal.aborted) throw new DirectoryTokenError('INTENTFLOW_DIRECTORY_TIMEOUT');
      if (!response.ok) throw new DirectoryTokenError(response.status >= 500
        ? 'INTENTFLOW_DIRECTORY_UNAVAILABLE' : 'INTENTFLOW_DIRECTORY_REJECTED');
      let payload: unknown;
      try { payload = await response.json(); }
      catch { throw new DirectoryTokenError(controller.signal.aborted
        ? 'INTENTFLOW_DIRECTORY_TIMEOUT' : 'INTENTFLOW_DIRECTORY_RESPONSE_INVALID'); }
      if (controller.signal.aborted) throw new DirectoryTokenError('INTENTFLOW_DIRECTORY_TIMEOUT');
      if (payload === null || typeof payload !== 'object' || Array.isArray(payload)
        || typeof (payload as Record<string, unknown>).token !== 'string'
        || !(payload as { token: string }).token.trim()) {
        throw new DirectoryTokenError('INTENTFLOW_DIRECTORY_RESPONSE_INVALID');
      }
      const expiresIn = (payload as Record<string, unknown>).expiresIn;
      if (scope && expiresIn !== undefined
        && (typeof expiresIn !== 'number' || !Number.isSafeInteger(expiresIn)
          || expiresIn <= 0 || expiresIn > COMMAND_TOKEN_TTL_SECONDS)) {
        throw new DirectoryTokenError('INTENTFLOW_DIRECTORY_RESPONSE_INVALID');
      }
      return { token: (payload as { token: string }).token,
        expiresIn: scope && typeof expiresIn === 'number' ? expiresIn : COMMAND_TOKEN_TTL_SECONDS };
    } catch (error) {
      if (controller.signal.aborted) throw new DirectoryTokenError('INTENTFLOW_DIRECTORY_TIMEOUT');
      if (error instanceof DeviceIdentityError) throw new DirectoryTokenError('DEVICE_IDENTITY_INVALID');
      if (error instanceof DirectoryTokenError) throw error;
      throw new DirectoryTokenError('INTENTFLOW_DIRECTORY_UNAVAILABLE');
    } finally { clearTimeout(timeout); }
  }
}

function isDeviceChallenge(value: unknown, scope: string): value is { challengeId: string; nonce: string; scope: string; expiresIn: number } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return Object.keys(row).length === 4 && typeof row.challengeId === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.challengeId)
    && typeof row.nonce === 'string' && /^[A-Za-z0-9_-]{43}$/.test(row.nonce)
    && Buffer.from(row.nonce, 'base64url').length === 32
    && Buffer.from(row.nonce, 'base64url').toString('base64url') === row.nonce
    && row.scope === scope && row.expiresIn === 60;
}
