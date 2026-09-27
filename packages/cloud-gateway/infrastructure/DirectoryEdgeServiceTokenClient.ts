import type { CloudGatewayConnectorConfig } from './CloudEdgeConfigProvider';

export const MANIFEST_REQUEST_TIMEOUT_MS = 10_000;

export type DirectoryTokenErrorCode =
  | 'INTENTFLOW_EDGE_NOT_PAIRED'
  | 'INTENTFLOW_DIRECTORY_REJECTED'
  | 'INTENTFLOW_DIRECTORY_UNAVAILABLE'
  | 'INTENTFLOW_DIRECTORY_TIMEOUT'
  | 'INTENTFLOW_DIRECTORY_RESPONSE_INVALID';

export class DirectoryTokenError extends Error {
  constructor(readonly code: DirectoryTokenErrorCode) { super(code); this.name = 'DirectoryTokenError'; }
}

type EdgeConfigProvider = () => CloudGatewayConnectorConfig | null;
type HttpFetch = (url: string, init: RequestInit) => Promise<Response>;

/** Never accepts a caller-selected Directory host. */
export function directoryEdgeServiceTokenUrl(gatewayUrl: string): string {
  try {
    const url = new URL(gatewayUrl);
    if (url.protocol !== 'wss:' || !url.hostname || url.username || url.password || url.search || url.hash) {
      throw new Error('INVALID_GATEWAY');
    }
    url.protocol = 'https:';
    url.pathname = '/directory/edge-service-token';
    return url.toString();
  } catch {
    throw new DirectoryTokenError('INTENTFLOW_EDGE_NOT_PAIRED');
  }
}

/** The provisioned Edge credential is re-read for every exchange. */
export class DirectoryEdgeServiceTokenClient {
  constructor(private readonly configProvider: EdgeConfigProvider, private readonly httpFetch: HttpFetch = fetch) {}

  async requestToken(): Promise<string> {
    const config = this.configProvider();
    if (!config?.token?.trim() || !config.homeId?.trim() || !config.edgeId?.trim()) {
      throw new DirectoryTokenError('INTENTFLOW_EDGE_NOT_PAIRED');
    }
    const url = directoryEdgeServiceTokenUrl(config.url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MANIFEST_REQUEST_TIMEOUT_MS);
    try {
      const response = await this.httpFetch(url, {
        method: 'POST', headers: { Authorization: `Bearer ${config.token}` }, signal: controller.signal,
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
      return (payload as { token: string }).token;
    } catch (error) {
      if (controller.signal.aborted) throw new DirectoryTokenError('INTENTFLOW_DIRECTORY_TIMEOUT');
      if (error instanceof DirectoryTokenError) throw error;
      throw new DirectoryTokenError('INTENTFLOW_DIRECTORY_UNAVAILABLE');
    } finally { clearTimeout(timeout); }
  }
}
