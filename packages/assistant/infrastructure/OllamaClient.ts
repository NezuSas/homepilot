/**
 * Infrastructure adapter for interacting with Ollama API.
 */
import { OllamaClientPort } from '../application/ports/OllamaClientPort';

export class OllamaClient implements OllamaClientPort {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly timeoutMs: number = 8000
  ) {}

  /**
   * Generates a structured JSON response from Ollama.
   * Uses 'format: json' to enforce structured output if supported by the model.
   */
  public async generateJson(prompt: string, options?: { model?: string; timeoutMs?: number }): Promise<unknown> {
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
          format: 'json',
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
