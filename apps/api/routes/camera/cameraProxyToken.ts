import * as crypto from 'crypto';

export interface CameraProxyTokenPayload {
  readonly deviceId: string;
  readonly expiresAt: number;
  readonly nonce: string;
}

export const CAMERA_PROXY_TOKEN_TTL_MS = 30 * 60 * 1000;

function signCameraProxyPayload(encodedPayload: string): string {
  const secret = process.env.CAMERA_PROXY_SIGNING_SECRET
    || process.env.HOME_ASSISTANT_TOKEN
    || 'homepilot-camera-proxy-development-secret';
  return crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

function tokensMatch(providedToken: string, expectedToken: string): boolean {
  const provided = Buffer.from(providedToken);
  const expected = Buffer.from(expectedToken);
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

/** Crea un token HMAC de corta vida que autoriza el acceso a los medios de una cámara. */
export function createCameraProxyToken(deviceId: string): string {
  const payload: CameraProxyTokenPayload = {
    deviceId,
    expiresAt: Date.now() + CAMERA_PROXY_TOKEN_TTL_MS,
    nonce: crypto.randomUUID(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = signCameraProxyPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

/** Verifica firma (tiempo constante), dispositivo y vigencia del token. */
export function verifyCameraProxyToken(token: string, deviceId: string): boolean {
  const [encodedPayload, providedSignature] = token.split('.');
  if (!encodedPayload || !providedSignature) return false;

  const expectedSignature = signCameraProxyPayload(encodedPayload);
  if (!tokensMatch(providedSignature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as CameraProxyTokenPayload;
    return payload.deviceId === deviceId && Number.isFinite(payload.expiresAt) && payload.expiresAt > Date.now();
  } catch {
    return false;
  }
}
