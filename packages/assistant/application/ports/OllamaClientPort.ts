/**
 * OllamaClientPort
 * 
 * Port for generating structured JSON from an LLM via Ollama.
 */
export interface OllamaClientPort {
  generateJson(prompt: string, options?: { model?: string; timeoutMs?: number }): Promise<unknown>;
}
