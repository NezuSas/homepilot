export interface AssistantSpeechToTextRequest {
  audioBase64: string;
  audioContentType: string;
  language: 'es' | 'en';
  contextTerms?: readonly string[];
}

export interface AssistantSpeechToTextResponse {
  provider: 'whisper-local';
  transcript: string;
}

export class AssistantSpeechToTextValidationError extends Error {}

export class AssistantSpeechToTextUnavailableError extends Error {}

const MAX_AUDIO_BASE64_LENGTH = 12_000_000;
const MAX_CONTEXT_TERMS = 40;
const MAX_CONTEXT_TERM_LENGTH = 64;
const MINIMUM_EDGE_STT_TIMEOUT_MS = 60_000;

function resolveEdgeTimeout(value: string | undefined, minimumMs: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? Math.max(parsed, minimumMs) : minimumMs;
}

function normalizeContextTerms(contextTerms: readonly string[] | undefined): string[] {
  if (!contextTerms) return [];

  const terms = new Set<string>();
  for (const candidate of contextTerms) {
    const term = candidate.trim().replace(/\s+/g, ' ');
    if (term && term.length <= MAX_CONTEXT_TERM_LENGTH) {
      terms.add(term);
    }
    if (terms.size >= MAX_CONTEXT_TERMS) break;
  }
  return [...terms];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseTranscriptResponse(value: unknown): AssistantSpeechToTextResponse {
  if (!isRecord(value)) {
    throw new AssistantSpeechToTextUnavailableError('Invalid STT response');
  }

  if (value.provider !== 'whisper-local' || typeof value.transcript !== 'string') {
    throw new AssistantSpeechToTextUnavailableError('Invalid STT response');
  }

  return {
    provider: value.provider,
    transcript: value.transcript.trim()
  };
}

export class AssistantSpeechToTextService {
  constructor(
    private readonly provider = process.env.STT_PROVIDER || 'whisper-local',
    private readonly baseUrl = process.env.STT_BASE_URL || 'http://localhost:8090',
    private readonly timeoutMs = resolveEdgeTimeout(process.env.STT_TIMEOUT_MS, MINIMUM_EDGE_STT_TIMEOUT_MS)
  ) {}

  async transcribe(request: AssistantSpeechToTextRequest): Promise<AssistantSpeechToTextResponse> {
    const audioBase64 = request.audioBase64.trim();
    const audioContentType = request.audioContentType.trim();
    const contextTerms = normalizeContextTerms(request.contextTerms);

    if (!audioBase64) {
      throw new AssistantSpeechToTextValidationError('audioBase64 is required');
    }

    if (audioBase64.length > MAX_AUDIO_BASE64_LENGTH) {
      throw new AssistantSpeechToTextValidationError('audioBase64 is too large');
    }

    if (!audioContentType.startsWith('audio/')) {
      throw new AssistantSpeechToTextValidationError('audioContentType must be audio/*');
    }

    if (this.provider !== 'whisper-local') {
      throw new AssistantSpeechToTextUnavailableError(`Unsupported STT provider: ${this.provider}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/api/stt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audioBase64,
          audioContentType,
          language: request.language,
          ...(contextTerms.length > 0 ? { contextTerms } : {})
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new AssistantSpeechToTextUnavailableError(`STT service returned ${response.status}`);
      }

      return parseTranscriptResponse(await response.json());
    } catch (error: unknown) {
      if (
        error instanceof AssistantSpeechToTextValidationError ||
        error instanceof AssistantSpeechToTextUnavailableError
      ) {
        throw error;
      }
      throw new AssistantSpeechToTextUnavailableError(error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timeout);
    }
  }
}
