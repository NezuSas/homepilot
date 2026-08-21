import {
  AssistantSpeechToTextService,
  AssistantSpeechToTextUnavailableError,
  AssistantSpeechToTextValidationError
} from '../application/AssistantSpeechToTextService';

describe('AssistantSpeechToTextService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('rejects empty audio', async () => {
    const service = new AssistantSpeechToTextService('whisper-local', 'http://stt.local', 1000);

    await expect(service.transcribe({ audioBase64: '', audioContentType: 'audio/webm', language: 'es' })).rejects.toBeInstanceOf(
      AssistantSpeechToTextValidationError
    );
  });

  it('rejects unsupported providers', async () => {
    const service = new AssistantSpeechToTextService('browser', 'http://stt.local', 1000);

    await expect(service.transcribe({ audioBase64: 'YWJj', audioContentType: 'audio/webm', language: 'es' })).rejects.toBeInstanceOf(
      AssistantSpeechToTextUnavailableError
    );
  });

  it('returns transcript from the local whisper service', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        provider: 'whisper-local',
        transcript: 'enciende la sala'
      })
    } as unknown as Response);

    const service = new AssistantSpeechToTextService('whisper-local', 'http://stt.local/', 1000);
    const response = await service.transcribe({ audioBase64: 'YWJj', audioContentType: 'audio/webm', language: 'es' });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://stt.local/api/stt',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          audioBase64: 'YWJj',
          audioContentType: 'audio/webm',
          language: 'es'
        })
      })
    );
    expect(response).toEqual({
      provider: 'whisper-local',
      transcript: 'enciende la sala'
    });
  });

  it('rejects invalid stt payloads', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ provider: 'other', transcript: 'hola' })
    } as unknown as Response);

    const service = new AssistantSpeechToTextService('whisper-local', 'http://stt.local', 1000);

    await expect(service.transcribe({ audioBase64: 'YWJj', audioContentType: 'audio/webm', language: 'es' })).rejects.toBeInstanceOf(
      AssistantSpeechToTextUnavailableError
    );
  });
});

  it('rejects an unsupported audio content type and oversized payload before contacting the provider', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const service = new AssistantSpeechToTextService('whisper-local', 'http://stt.local', 1000);

    await expect(service.transcribe({ audioBase64: 'YWJj', audioContentType: 'text/plain', language: 'es' })).rejects.toThrow('audio/*');
    await expect(service.transcribe({ audioBase64: 'a'.repeat(12_000_001), audioContentType: 'audio/webm', language: 'es' })).rejects.toThrow('too large');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards only bounded local context terms to Whisper', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        provider: 'whisper-local',
        transcript: 'apaga dicroicos trabajo'
      })
    } as unknown as Response);
    const service = new AssistantSpeechToTextService('whisper-local', 'http://stt.local', 1000);

    await service.transcribe({
      audioBase64: 'YWJj',
      audioContentType: 'audio/webm',
      language: 'es',
      contextTerms: ['Dicroicos Trabajo', 'Cuarto Master', 'Dicroicos Trabajo', 'x'.repeat(65)]
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://stt.local/api/stt',
      expect.objectContaining({
        body: JSON.stringify({
          audioBase64: 'YWJj',
          audioContentType: 'audio/webm',
          language: 'es',
          contextTerms: ['Dicroicos Trabajo', 'Cuarto Master']
        })
      })
    );
  });

  it('maps a non-successful Whisper response to the stable unavailable error', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502 } as unknown as Response);
    const service = new AssistantSpeechToTextService('whisper-local', 'http://stt.local', 1000);

    await expect(service.transcribe({ audioBase64: 'YWJj', audioContentType: 'audio/webm', language: 'es' })).rejects.toThrow('STT service returned 502');
  });