import { XMLParser } from 'fast-xml-parser';
import { buildGetCapabilitiesEnvelope, buildGetProfilesEnvelope, buildGetStreamUriEnvelope, buildGetPtzConfigurationOptionsEnvelope, buildContinuousMoveEnvelope, buildPtzStopEnvelope } from './OnvifSoapEnvelopes';
import type { OnvifCredentials, PtzVector } from './OnvifSoapEnvelopes';

export interface OnvifServiceAddresses {
  readonly mediaXAddr: string;
  readonly ptzXAddr: string | null;
}

export interface OnvifPtzConfigurationOptions {
  readonly supportsContinuousMove: boolean;
}

export interface OnvifVideoProfile {
  readonly token: string;
  readonly name: string;
  readonly encoding: string | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly ptzConfigurationToken: string | null;
}

export class OnvifUnauthorizedError extends Error {
  constructor() {
    super('ONVIF credentials rejected');
    this.name = 'OnvifUnauthorizedError';
  }
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true });

/** Normalizes a fast-xml-parser node that is an object for a single child but an array for multiple children. */
function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Walks a chain of object keys on an untyped (fast-xml-parser-derived) value without `any`. */
function dig(value: unknown, ...keys: string[]): unknown {
  let current: unknown = value;
  for (const key of keys) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Minimal ONVIF SOAP client covering only the operations native camera
 * negotiation needs: `GetCapabilities` (to find the Media service address),
 * `GetProfiles` (to enumerate video profiles) and `GetStreamUri` (to resolve
 * the definitive RTSP endpoint for a chosen profile). Replaces `node-onvif`
 * (unmaintained, only exposed `init()`/`getUdpStreamUrl()` with no profile
 * selection) with real SOAP calls parsed by `fast-xml-parser`.
 */
export class OnvifSoapClient {
  constructor(private readonly timeoutMs: number = 5000) {}

  public async getCapabilities(deviceServiceUrl: string, credentials: OnvifCredentials): Promise<OnvifServiceAddresses> {
    const parsed = await this.postSoap(deviceServiceUrl, buildGetCapabilitiesEnvelope(credentials));
    const mediaXAddr = dig(parsed, 'Envelope', 'Body', 'GetCapabilitiesResponse', 'Capabilities', 'Media', 'XAddr');
    if (typeof mediaXAddr !== 'string' || !mediaXAddr) {
      throw new Error('ONVIF device did not report a Media service address');
    }
    const ptzXAddr = dig(parsed, 'Envelope', 'Body', 'GetCapabilitiesResponse', 'Capabilities', 'PTZ', 'XAddr');
    return { mediaXAddr, ptzXAddr: typeof ptzXAddr === 'string' && ptzXAddr ? ptzXAddr : null };
  }

  public async getMediaServiceUrl(deviceServiceUrl: string, credentials: OnvifCredentials): Promise<string> {
    return (await this.getCapabilities(deviceServiceUrl, credentials)).mediaXAddr;
  }

  public async getPtzConfigurationOptions(ptzServiceUrl: string, credentials: OnvifCredentials, configurationToken: string): Promise<OnvifPtzConfigurationOptions> {
    const parsed = await this.postSoap(ptzServiceUrl, buildGetPtzConfigurationOptionsEnvelope(credentials, configurationToken));
    const continuousSpace = dig(parsed, 'Envelope', 'Body', 'GetConfigurationOptionsResponse', 'PTZConfigurationOptions', 'Spaces', 'ContinuousPanTiltVelocitySpace');
    return { supportsContinuousMove: continuousSpace !== undefined };
  }

  public async continuousMove(ptzServiceUrl: string, credentials: OnvifCredentials, profileToken: string, vector: PtzVector): Promise<void> {
    await this.postSoap(ptzServiceUrl, buildContinuousMoveEnvelope(credentials, profileToken, vector));
  }

  public async stopPtz(ptzServiceUrl: string, credentials: OnvifCredentials, profileToken: string): Promise<void> {
    await this.postSoap(ptzServiceUrl, buildPtzStopEnvelope(credentials, profileToken));
  }

  public async getProfiles(mediaServiceUrl: string, credentials: OnvifCredentials): Promise<ReadonlyArray<OnvifVideoProfile>> {
    const parsed = await this.postSoap(mediaServiceUrl, buildGetProfilesEnvelope(credentials));
    const rawProfiles = asArray(dig(parsed, 'Envelope', 'Body', 'GetProfilesResponse', 'Profiles'));

    return rawProfiles
      .map((profile) => this.toVideoProfile(profile))
      .filter((profile): profile is OnvifVideoProfile => profile.token.length > 0);
  }

  public async getStreamUri(mediaServiceUrl: string, credentials: OnvifCredentials, profileToken: string): Promise<string> {
    const parsed = await this.postSoap(mediaServiceUrl, buildGetStreamUriEnvelope(credentials, profileToken));
    const uri = dig(parsed, 'Envelope', 'Body', 'GetStreamUriResponse', 'MediaUri', 'Uri');
    if (typeof uri !== 'string' || !uri) {
      throw new Error('ONVIF device did not report a stream URI');
    }
    return uri;
  }

  private toVideoProfile(profile: unknown): OnvifVideoProfile {
    const token = dig(profile, '@_token');
    const name = dig(profile, 'Name');
    const encoding = dig(profile, 'VideoEncoderConfiguration', 'Encoding');
    const width = dig(profile, 'VideoEncoderConfiguration', 'Resolution', 'Width');
    const height = dig(profile, 'VideoEncoderConfiguration', 'Resolution', 'Height');
    const ptzConfigurationToken = dig(profile, 'PTZConfiguration', '@_token');

    return {
      token: token !== undefined ? String(token) : '',
      name: name !== undefined ? String(name) : '',
      encoding: encoding !== undefined ? String(encoding) : null,
      width: width !== undefined ? Number(width) : null,
      height: height !== undefined ? Number(height) : null,
      ptzConfigurationToken: ptzConfigurationToken !== undefined ? String(ptzConfigurationToken) : null,
    };
  }

  private async postSoap(url: string, envelope: string): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/soap+xml; charset=utf-8' },
        body: envelope,
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        const lower = text.toLowerCase();
        if (res.status === 401 || lower.includes('notauthorized') || lower.includes('unauthorized')) {
          throw new OnvifUnauthorizedError();
        }
        throw new Error(`ONVIF request failed with status ${res.status}`);
      }
      return parser.parse(text);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Selects the best video profile to persist for streaming: prefers H.264,
 * then the highest resolution not exceeding 1920x1080 — the edge box
 * re-encodes with `libx264 -preset veryfast`, so ingesting a 4K source would
 * be wasted work. Profiles are returned in preference order; the caller
 * tries `GetStreamUri` against each until one succeeds.
 */
export function orderProfilesByPreference(profiles: ReadonlyArray<OnvifVideoProfile>): ReadonlyArray<OnvifVideoProfile> {
  const withinCap = (p: OnvifVideoProfile) => (p.width ?? 0) <= 1920 && (p.height ?? 0) <= 1080;
  const pixels = (p: OnvifVideoProfile) => (p.width ?? 0) * (p.height ?? 0);

  // Tiered comparator (not a weighted sum): encoding, then resolution-cap
  // compliance, then pixel count — a weighted sum would let a huge
  // over-the-cap resolution outscore a compliant one on raw pixel count alone.
  return [...profiles].sort((a, b) => {
    const aH264 = a.encoding === 'H264';
    const bH264 = b.encoding === 'H264';
    if (aH264 !== bH264) return aH264 ? -1 : 1;

    const aCap = withinCap(a);
    const bCap = withinCap(b);
    if (aCap !== bCap) return aCap ? -1 : 1;

    return pixels(b) - pixels(a);
  });
}
