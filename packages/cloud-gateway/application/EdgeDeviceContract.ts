export interface BoundDeviceIdentity {
  bindingState: 'bound';
  homeId: string;
  edgeId: string;
  keyId: string;
  publicKey: string;
  algorithm: 'ES256';
  boundAt: string;
}

export interface CloudGatewayConnectorConfig {
  url: string;
  token: string;
  homeId: string;
  edgeId: string;
}

export type DirectoryTokenErrorCode =
  | 'INTENTFLOW_EDGE_NOT_PAIRED'
  | 'INTENTFLOW_DIRECTORY_REJECTED'
  | 'INTENTFLOW_DIRECTORY_UNAVAILABLE'
  | 'INTENTFLOW_DIRECTORY_TIMEOUT'
  | 'INTENTFLOW_DIRECTORY_RESPONSE_INVALID'
  | 'DEVICE_IDENTITY_INVALID';

export class DirectoryTokenError extends Error {
  constructor(readonly code: DirectoryTokenErrorCode) { super(code); this.name = 'DirectoryTokenError'; }
}

/** Never accepts a caller-selected Directory host. */
export function directoryEdgeDeviceUrl(gatewayUrl: string, action: 'enroll' | 'challenge' | 'service-token'): string {
  try {
    const url = new URL(gatewayUrl);
    if (url.protocol !== 'wss:' || !url.hostname || url.username || url.password || url.search || url.hash) {
      throw new Error('INVALID_GATEWAY');
    }
    url.protocol = 'https:';
    url.pathname = action === 'service-token' ? '/directory/edge-service-token' : `/directory/edge-device/${action}`;
    return url.toString();
  } catch {
    throw new DirectoryTokenError('INTENTFLOW_EDGE_NOT_PAIRED');
  }
}
