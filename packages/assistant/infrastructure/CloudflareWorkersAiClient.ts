import type { OllamaClientPort, OllamaGenerateOptions } from '../application/ports/OllamaClientPort';

/**
 * Cloudflare Workers AI adapter for bounded conversational responses.
 *
 * It only receives the prompt built from HomePilot's already-authorized,
 * compact context. It cannot execute actions or access local repositories.
 */
export class CloudflareWorkersAiClient implements OllamaClientPort {
  public constructor(
    private readonly accountId: string,
    private readonly apiToken: string,
    private readonly model: string,
    private readonly timeoutMs: number = 2_200
  ) {}

  public async generateJson(prompt: string, options?: OllamaGenerateOptions): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeoutMs ?? this.timeoutMs);

    try {
      const targetModel = options?.model ?? this.model;
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(this.accountId)}/ai/run/${encodeURI(targetModel)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
            temperature: options?.temperature ?? 0,
            max_tokens: options?.numPredict ?? 48,
            ...(options?.format
              ? { response_format: { type: 'json_schema', json_schema: options.format } }
              : {})
          }),
          signal: controller.signal
        }
      );

      if (!response.ok) {
        throw new Error(`Cloudflare Workers AI request failed (${response.status})`);
      }

      const payload = await response.json() as {
        success?: boolean;
        result?: { response?: unknown };
        errors?: Array<{ message?: string }>;
      };
      if (!payload.success) {
        throw new Error(`Cloudflare Workers AI request failed: ${payload.errors?.[0]?.message ?? 'unknown error'}`);
      }

      const result = payload.result?.response;
      if (typeof result === 'string') {
        try {
          return JSON.parse(result) as unknown;
        } catch {
          throw new Error('Cloudflare Workers AI returned invalid JSON');
        }
      }
      if (result && typeof result === 'object') return result;
      throw new Error('Cloudflare Workers AI returned an empty response');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Cloudflare Workers AI request timed out after ${options?.timeoutMs ?? this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
