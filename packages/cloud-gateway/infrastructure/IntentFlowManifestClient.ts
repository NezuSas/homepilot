import { MANIFEST_REQUEST_TIMEOUT_MS } from './DirectoryEdgeServiceTokenClient';

export type IntentFlowManifestErrorCode =
  | 'INTENTFLOW_MANIFEST_CONFIG_INVALID'
  | 'INTENTFLOW_MANIFEST_REJECTED'
  | 'INTENTFLOW_MANIFEST_UNAVAILABLE'
  | 'INTENTFLOW_MANIFEST_TIMEOUT'
  | 'INTENTFLOW_MANIFEST_RESPONSE_INVALID';

export class IntentFlowManifestError extends Error {
  constructor(readonly code: IntentFlowManifestErrorCode) { super(code); this.name = 'IntentFlowManifestError'; }
}

type HttpFetch = (url: string, init: RequestInit) => Promise<Response>;

export function intentFlowManifestsUrl(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash) {
      throw new Error('INVALID_BASE_URL');
    }
    url.pathname = '/api/homepilot/service/manifests/';
    return url.toString();
  } catch { throw new IntentFlowManifestError('INTENTFLOW_MANIFEST_CONFIG_INVALID'); }
}

export class IntentFlowManifestClient {
  constructor(
    private readonly baseUrlProvider: () => string | undefined = () => process.env.HOMEPILOT_INTENTFLOW_BASE_URL,
    private readonly httpFetch: HttpFetch = fetch,
  ) {}

  async getManifests(edgeServiceToken: string): Promise<unknown> {
    const baseUrl = this.baseUrlProvider();
    if (!baseUrl?.trim() || !edgeServiceToken.trim()) throw new IntentFlowManifestError('INTENTFLOW_MANIFEST_CONFIG_INVALID');
    const url = intentFlowManifestsUrl(baseUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MANIFEST_REQUEST_TIMEOUT_MS);
    try {
      const response = await this.httpFetch(url, {
        method: 'GET', headers: { Authorization: `Bearer ${edgeServiceToken}` }, signal: controller.signal,
      });
      if (controller.signal.aborted) throw new IntentFlowManifestError('INTENTFLOW_MANIFEST_TIMEOUT');
      if (!response.ok) throw new IntentFlowManifestError(response.status >= 500
        ? 'INTENTFLOW_MANIFEST_UNAVAILABLE' : 'INTENTFLOW_MANIFEST_REJECTED');
      try {
        const payload: unknown = await response.json();
        if (controller.signal.aborted) throw new IntentFlowManifestError('INTENTFLOW_MANIFEST_TIMEOUT');
        return payload;
      } catch {
        throw new IntentFlowManifestError(controller.signal.aborted
          ? 'INTENTFLOW_MANIFEST_TIMEOUT' : 'INTENTFLOW_MANIFEST_RESPONSE_INVALID');
      }
    } catch (error) {
      if (controller.signal.aborted) throw new IntentFlowManifestError('INTENTFLOW_MANIFEST_TIMEOUT');
      if (error instanceof IntentFlowManifestError) throw error;
      throw new IntentFlowManifestError('INTENTFLOW_MANIFEST_UNAVAILABLE');
    } finally { clearTimeout(timeout); }
  }
}
