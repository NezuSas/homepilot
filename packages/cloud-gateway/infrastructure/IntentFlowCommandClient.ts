import { MANIFEST_REQUEST_TIMEOUT_MS } from './DirectoryEdgeServiceTokenClient';

export type IntentFlowCommandErrorCode =
  | 'INTENTFLOW_COMMAND_CONFIG_INVALID' | 'INTENTFLOW_COMMAND_UNAUTHORIZED'
  | 'INTENTFLOW_COMMAND_DEVICE_UNAVAILABLE' | 'INTENTFLOW_COMMAND_FORBIDDEN'
  | 'INTENTFLOW_COMMAND_CONFIRMATION_REQUIRED' | 'INTENTFLOW_COMMAND_ROUTE_MISMATCH'
  | 'INTENTFLOW_COMMAND_EXECUTION_FAILED' | 'INTENTFLOW_COMMAND_REJECTED'
  | 'INTENTFLOW_COMMAND_UNAVAILABLE' | 'INTENTFLOW_COMMAND_TIMEOUT';

export class IntentFlowCommandError extends Error {
  constructor(readonly code: IntentFlowCommandErrorCode) { super(code); this.name = 'IntentFlowCommandError'; }
}

type HttpFetch = (url: string, init: RequestInit) => Promise<Response>;

export function intentFlowCommandUrl(baseUrl: string, boardId: number, commandKey: string): string {
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash
      || !Number.isSafeInteger(boardId) || boardId <= 0 || !commandKey.trim()
      || commandKey !== commandKey.trim() || commandKey === '.' || commandKey === '..') {
      throw new Error('INVALID_COMMAND_URL');
    }
    url.pathname = `/api/homepilot/service/boards/${boardId}/commands/${encodeURIComponent(commandKey)}/execute/`;
    return url.toString();
  } catch { throw new IntentFlowCommandError('INTENTFLOW_COMMAND_CONFIG_INVALID'); }
}

/** Sends only the command key and its server-resolved board identity. */
export class IntentFlowCommandClient {
  constructor(
    private readonly baseUrlProvider: () => string | undefined = () => process.env.HOMEPILOT_INTENTFLOW_BASE_URL,
    private readonly httpFetch: HttpFetch = fetch,
  ) {}

  async execute(boardId: number, commandKey: string, token: string): Promise<void> {
    const baseUrl = this.baseUrlProvider();
    if (!baseUrl?.trim() || !token.trim()) throw new IntentFlowCommandError('INTENTFLOW_COMMAND_CONFIG_INVALID');
    const url = intentFlowCommandUrl(baseUrl, boardId, commandKey);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MANIFEST_REQUEST_TIMEOUT_MS);
    try {
      const response = await this.httpFetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: '{}', signal: controller.signal,
      });
      if (controller.signal.aborted) throw new IntentFlowCommandError('INTENTFLOW_COMMAND_TIMEOUT');
      if (response.status === 200) return;
      if (response.status === 401) throw new IntentFlowCommandError('INTENTFLOW_COMMAND_UNAUTHORIZED');
      if (response.status === 403) throw new IntentFlowCommandError('INTENTFLOW_COMMAND_FORBIDDEN');
      if (response.status === 502) throw new IntentFlowCommandError('INTENTFLOW_COMMAND_EXECUTION_FAILED');
      if (response.status === 400 || response.status === 409) {
        let code: unknown;
        try {
          const payload: unknown = await response.json();
          if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
            const details = payload as Record<string, unknown>;
            code = details.code ?? details.error;
            if (code && typeof code === 'object' && 'code' in code) code = code.code;
          }
        } catch { /* Unknown response remains rejected without exposing its body. */ }
        if (response.status === 400 && code === 'command_device_unavailable')
          throw new IntentFlowCommandError('INTENTFLOW_COMMAND_DEVICE_UNAVAILABLE');
        if (response.status === 409 && code === 'command_confirmation_required')
          throw new IntentFlowCommandError('INTENTFLOW_COMMAND_CONFIRMATION_REQUIRED');
        if (response.status === 409 && code === 'homepilot_local_execution_required')
          throw new IntentFlowCommandError('INTENTFLOW_COMMAND_ROUTE_MISMATCH');
        throw new IntentFlowCommandError('INTENTFLOW_COMMAND_REJECTED');
      }
      throw new IntentFlowCommandError(response.status >= 500
        ? 'INTENTFLOW_COMMAND_UNAVAILABLE' : 'INTENTFLOW_COMMAND_REJECTED');
    } catch (error) {
      if (controller.signal.aborted) throw new IntentFlowCommandError('INTENTFLOW_COMMAND_TIMEOUT');
      if (error instanceof IntentFlowCommandError) throw error;
      throw new IntentFlowCommandError('INTENTFLOW_COMMAND_UNAVAILABLE');
    } finally { clearTimeout(timeout); }
  }
}
