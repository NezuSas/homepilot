import { createPublicKey, verify } from 'node:crypto';
import type { UsedSsoTokenRepository } from './ports/DirectorySsoPorts';

export interface DirectorySsoPayload { directoryAccountId: string; homeId: string; iat: number; exp: number; jti: string; }
export class DirectorySsoVerifier {
  constructor(private readonly usedTokens: UsedSsoTokenRepository, private readonly publicKeyPem = process.env.DIRECTORY_SSO_PUBLIC_KEY) {}
  async verify(token: string): Promise<DirectorySsoPayload> {
    if (!this.publicKeyPem) throw new DirectorySsoError('SSO_NOT_CONFIGURED');
    const [payloadPart, signaturePart, extra] = token.split('.');
    if (!payloadPart || !signaturePart || extra) throw new DirectorySsoError('SSO_TOKEN_INVALID');
    let payload: DirectorySsoPayload;
    try { payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString()) as DirectorySsoPayload; } catch { throw new DirectorySsoError('SSO_TOKEN_INVALID'); }
    if (!verify(null, Buffer.from(payloadPart), createPublicKey(this.publicKeyPem.replace(/\\n/g, '\n')), Buffer.from(signaturePart, 'base64url'))) throw new DirectorySsoError('SSO_TOKEN_INVALID');
    if (!payload.directoryAccountId || !payload.homeId || !payload.jti || !Number.isInteger(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) throw new DirectorySsoError('SSO_TOKEN_EXPIRED');
    await this.usedTokens.purgeExpired();
    if (await this.usedTokens.isUsed(payload.jti)) throw new DirectorySsoError('SSO_TOKEN_REPLAYED');
    return payload;
  }
  async consume(payload: DirectorySsoPayload): Promise<void> { await this.usedTokens.markUsed(payload.jti, new Date(payload.exp * 1000).toISOString()); }
}
export class DirectorySsoError extends Error { constructor(public readonly code: 'SSO_NOT_CONFIGURED'|'SSO_TOKEN_INVALID'|'SSO_TOKEN_EXPIRED'|'SSO_TOKEN_REPLAYED') { super(code); } }