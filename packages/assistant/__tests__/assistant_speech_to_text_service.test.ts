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
