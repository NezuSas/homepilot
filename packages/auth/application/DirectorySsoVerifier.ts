import { createPublicKey, verify } from 'node:crypto';
import type { UsedSsoTokenRepository } from './ports/DirectorySsoPorts';

export interface DirectorySsoPayload { directoryAccountId: string; homeId: string; iat: number; exp: number; jti: string; }

export interface DirectorySsoHomeScope {
  homeId: string;
}

export class DirectorySsoVerifier {
  constructor(
    private readonly usedTokens: UsedSsoTokenRepository,
    private readonly publicKeyPem = process.env.DIRECTORY_SSO_PUBLIC_KEY,
    private readonly homeScope: DirectorySsoHomeScope | undefined = configuredHomeScope()
  ) {}

  async verify(token: string): Promise<DirectorySsoPayload> {
    if (!this.publicKeyPem) throw new DirectorySsoError('SSO_NOT_CONFIGURED');
    const [payloadPart, signaturePart, extra] = token.split('.');
    if (!payloadPart || !signaturePart || extra) throw new DirectorySsoError('SSO_TOKEN_INVALID');
    let payload: DirectorySsoPayload;
    try { payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString()) as DirectorySsoPayload; } catch { throw new DirectorySsoError('SSO_TOKEN_INVALID'); }
    if (!verify(null, Buffer.from(payloadPart), createPublicKey(this.publicKeyPem.replace(/\\n/g, '\n')), Buffer.from(signaturePart, 'base64url'))) throw new DirectorySsoError('SSO_TOKEN_INVALID');
    if (!payload.directoryAccountId || !payload.homeId || !payload.jti || !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) {
      throw new DirectorySsoError('SSO_TOKEN_INVALID');
    }
    if (this.homeScope && payload.homeId !== this.homeScope.homeId) throw new DirectorySsoError('SSO_TOKEN_HOME_MISMATCH');
    if (payload.exp <= Math.floor(Date.now() / 1000)) throw new DirectorySsoError('SSO_TOKEN_EXPIRED');
    await this.usedTokens.purgeExpired();
    if (await this.usedTokens.isUsed(payload.jti)) throw new DirectorySsoError('SSO_TOKEN_REPLAYED');
    return payload;
  }

  async consume(payload: DirectorySsoPayload): Promise<void> { await this.usedTokens.markUsed(payload.jti, new Date(payload.exp * 1000).toISOString()); }
}

function configuredHomeScope(): DirectorySsoHomeScope | undefined {
  const homeId = process.env.DIRECTORY_SSO_HOME_ID?.trim();
  return homeId ? { homeId } : undefined;
}

export class DirectorySsoError extends Error { constructor(public readonly code: 'SSO_NOT_CONFIGURED'|'SSO_TOKEN_INVALID'|'SSO_TOKEN_EXPIRED'|'SSO_TOKEN_REPLAYED'|'SSO_TOKEN_HOME_MISMATCH') { super(code); } }