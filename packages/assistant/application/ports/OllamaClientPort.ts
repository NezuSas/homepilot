/**
 * OllamaClientPort
 *
 * Port for generating structured JSON from an LLM via Ollama.
 */
export interface OllamaGenerateOptions {
  model?: string;
  timeoutMs?: number;
  /** A JSON Schema object to constrain decoding, or 'json' for unconstrained JSON. Defaults to 'json'. */
  format?: unknown;
  /** Defaults to 0 — a command-understanding assistant should be deterministic, not creative. */
  temperature?: number;
  /** Caps generation length; defaults to 256, comfortably more than a JSON plan or a short reply needs. */
  numPredict?: number;
}

export interface OllamaClientPort {
  generateJson(prompt: string, options?: OllamaGenerateOptions): Promise<unknown>;
}
