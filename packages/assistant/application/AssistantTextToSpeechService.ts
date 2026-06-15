export interface AssistantTextToSpeechRequest {
  text: string;
  language: 'es' | 'en';
}

export interface AssistantTextToSpeechResponse {
  provider: 'piper';
  audioContentType: 'audio/wav';
  audioBase64: string;
}

export class AssistantTextToSpeechValidationError extends Error {}

export class AssistantTextToSpeechUnavailableError extends Error {}

const MAX_TEXT_LENGTH = 1200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseAudioResponse(value: unknown): AssistantTextToSpeechResponse {
  if (!isRecord(value)) {
    throw new AssistantTextToSpeechUnavailableError('Invalid TTS response');
  }

  if (
    value.provider !== 'piper' ||
    value.audioContentType !== 'audio/wav' ||
    typeof value.audioBase64 !== 'string' ||
    value.audioBase64.length === 0
  ) {
    throw new AssistantTextToSpeechUnavailableError('Invalid TTS response');
  }

  return {
    provider: value.provider,
    audioContentType: value.audioContentType,
    audioBase64: value.audioBase64
  };
}

export class AssistantTextToSpeechService {
  constructor(
    private readonly provider = process.env.TTS_PROVIDER || 'piper',
    private readonly baseUrl = process.env.TTS_BASE_URL || 'http://localhost:8088',
    private readonly timeoutMs = Number.parseInt(process.env.TTS_TIMEOUT_MS || '12000', 10)
  ) {}

  async synthesize(request: AssistantTextToSpeechRequest): Promise<AssistantTextToSpeechResponse> {
    const text = request.text.trim();
    if (!text) {
      throw new AssistantTextToSpeechValidationError('text is required');
    }

    if (text.length > MAX_TEXT_LENGTH) {
      throw new AssistantTextToSpeechValidationError(`text must be ${MAX_TEXT_LENGTH} characters or fewer`);
    }

    if (this.provider !== 'piper') {
      throw new AssistantTextToSpeechUnavailableError(`Unsupported TTS provider: ${this.provider}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          language: request.language
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new AssistantTextToSpeechUnavailableError(`TTS service returned ${response.status}`);
      }

      return parseAudioResponse(await response.json());
    } catch (error: unknown) {
      if (
        error instanceof AssistantTextToSpeechValidationError ||
        error instanceof AssistantTextToSpeechUnavailableError
      ) {
        throw error;
      }
      throw new AssistantTextToSpeechUnavailableError(error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timeout);
    }
  }
}
