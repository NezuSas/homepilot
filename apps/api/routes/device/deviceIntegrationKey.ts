import * as crypto from 'crypto';
import type { IncomingHttpHeaders } from 'http';

/**
 * Valida en tiempo constante la clave M2M de integración enviada en
 * `x-homepilot-integration-key` contra `HOMEPILOT_INTEGRATION_API_KEY`.
 */
export function hasValidIntegrationKey(headers: IncomingHttpHeaders): boolean {
  const expectedKey = process.env.HOMEPILOT_INTEGRATION_API_KEY;
  const headerValue = headers['x-homepilot-integration-key'];
  const providedKey = Array.isArray(headerValue) ? headerValue[0] : headerValue;

  if (!expectedKey || !providedKey) return false;

  const expected = Buffer.from(expectedKey);
  const provided = Buffer.from(providedKey);
  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
}
