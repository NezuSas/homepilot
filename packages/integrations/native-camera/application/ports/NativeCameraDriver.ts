import type { NativeCameraSourceType } from '../../../../devices/domain/repositories/NativeCameraSourceRepository';

/**
 * Connection details an operator supplied (or that were resolved from a previous
 * save) for a candidate native camera, before/while a driver negotiates the
 * definitive stream endpoint.
 */
export interface NativeCameraEndpoint {
  readonly host: string;
  readonly onvifPort: number;
  readonly rtspPort: number;
  readonly username: string;
  readonly password: string;
  readonly rtspPath: string;
}

/** A normalized pan/tilt/zoom velocity vector; each axis in [-1, 1]. */
export interface PtzVector {
  readonly pan?: number;
  readonly tilt?: number;
  readonly zoom?: number;
}

/** The stream endpoint a driver resolved (or accepted as-is) for a camera. */
export interface NativeCameraStreamProfile {
  readonly rtspPort: number;
  readonly rtspPath: string;
  /** ONVIF media profile token; null for non-ONVIF drivers or unresolved profiles. */
  readonly profileToken: string | null;
  /** ONVIF PTZ configuration token, if the negotiated profile advertised one. */
  readonly ptzConfigurationToken: string | null;
  /** Whether the negotiated profile confirmed continuous-move PTZ support. */
  readonly ptzSupported: boolean;
}

export type NativeCameraNegotiation =
  | { readonly outcome: 'negotiated'; readonly profile: NativeCameraStreamProfile }
  /** Protocol offers no negotiation; only TCP reachability was confirmed. */
  | { readonly outcome: 'reachable'; readonly profile: NativeCameraStreamProfile }
  | { readonly outcome: 'unauthorized' }
  | { readonly outcome: 'unreachable'; readonly detail: string };

export interface DiscoveredNativeCamera {
  readonly urn: string;
  readonly name: string;
  readonly host: string;
  readonly onvifPort: number;
}

/**
 * One implementation per native camera protocol (ONVIF, RTSP/DVR, Sonoff-RTSP).
 * Owns everything protocol-specific: LAN discovery (if any) and endpoint
 * negotiation/validation before a camera is persisted.
 */
export interface NativeCameraDriver {
  readonly sourceType: NativeCameraSourceType;
  supportsDiscovery(): boolean;
  discover(): Promise<ReadonlyArray<DiscoveredNativeCamera>>;
  negotiate(endpoint: NativeCameraEndpoint): Promise<NativeCameraNegotiation>;
  /** Whether a negotiated profile supports PTZ control. */
  supportsPtz(profile: NativeCameraStreamProfile): boolean;
  /** Absent on drivers that never support PTZ (RTSP/DVR, Sonoff-RTSP). */
  movePtz?(endpoint: NativeCameraEndpoint, profile: NativeCameraStreamProfile, vector: PtzVector): Promise<void>;
  stopPtz?(endpoint: NativeCameraEndpoint, profile: NativeCameraStreamProfile): Promise<void>;
}
