/**
 * Infrastructure adapter for interacting with Ollama API.
 */
import { OllamaClientPort, OllamaGenerateOptions } from '../application/ports/OllamaClientPort';

export class OllamaClient implements OllamaClientPort {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly timeoutMs: number = 8000
  ) {}

  /**
   * Generates a structured JSON response from Ollama.
   * `format` defaults to `'json'` (unconstrained JSON) but callers that already
   * know the expected shape (e.g. the Planner V2 schema) can pass it directly so
   * Ollama's grammar-constrained decoding rules out invalid enums/fields outright,
   * rather than relying solely on post-hoc validation.
   * `keep_alive` keeps the model resident between requests — without it, every
   * single call pays the full model-load cost on top of inference time.
   */
  /**
   * Keeps the configured model resident before the first customer request.
   * Callers must treat a failure as non-fatal: deterministic HomePilot flows
   * remain available even when the local model is unavailable.
   */
  public async warmUp(timeoutMs: number = 5_000): Promise<void> {
    await this.generateJson('Return JSON where ready is true.', {
      timeoutMs,
      numPredict: 8,
      format: {
        type: 'object',
        additionalProperties: false,
        required: ['ready'],
        properties: { ready: { type: 'boolean' } }
      }
    });
  }
  public async generateJson(prompt: string, options?: OllamaGenerateOptions): Promise<unknown> {
    const targetModel = options?.model || this.model;
    const targetTimeout = options?.timeoutMs || this.timeoutMs;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), targetTimeout);

    try {
      const url = `${this.baseUrl.replace(/\/$/, '')}/api/generate`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: targetModel,
          prompt,
          stream: false,
          format: options?.format ?? 'json',
          keep_alive: '30m',
          options: {
            temperature: options?.temperature ?? 0,
            num_predict: options?.numPredict ?? 256,
            num_ctx: 1024,
            top_k: 20,
            top_p: 0.9
          }
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Ollama API error (${response.status}): ${text}`);
      }

      const data = await response.json() as { response: string };
      
      if (!data.response) {
        throw new Error('Ollama returned an empty response');
      }

      try {
        return JSON.parse(data.response);
      } catch (parseError: unknown) {
        throw new Error(`Failed to parse Ollama response as JSON: ${data.response}`);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Ollama request timed out after ${targetTimeout}ms`);
        }
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
