import {
  AssistantTextToSpeechService,
  AssistantTextToSpeechUnavailableError,
  AssistantTextToSpeechValidationError
} from '../application/AssistantTextToSpeechService';

describe('AssistantTextToSpeechService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('rejects empty text', async () => {
    const service = new AssistantTextToSpeechService('edge', 'http://tts.local', 1000);

    await expect(service.synthesize({ text: '   ', language: 'es' })).rejects.toBeInstanceOf(
      AssistantTextToSpeechValidationError
    );
  });

  it('rejects unsupported providers', async () => {
    const service = new AssistantTextToSpeechService('browser', 'http://tts.local', 1000);

    await expect(service.synthesize({ text: 'Hola', language: 'es' })).rejects.toBeInstanceOf(
      AssistantTextToSpeechUnavailableError
    );
  });

  it('returns audio from the edge tts service', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        provider: 'edge',
        audioContentType: 'audio/mpeg',
        audioBase64: 'YWJj'
      })
    });
    global.fetch = fetchMock;
    const service = new AssistantTextToSpeechService('edge', 'http://tts.local/', 1000);

    await expect(service.synthesize({ text: 'Hola casa', language: 'es' })).resolves.toEqual({
      provider: 'edge',
      audioContentType: 'audio/mpeg',
      audioBase64: 'YWJj'
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://tts.local/api/tts',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ text: 'Hola casa', language: 'es' })
      })
    );
  });

  it('rejects invalid tts payloads', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ provider: 'edge' })
    });
    const service = new AssistantTextToSpeechService('edge', 'http://tts.local', 1000);

    await expect(service.synthesize({ text: 'Hola', language: 'es' })).rejects.toBeInstanceOf(
      AssistantTextToSpeechUnavailableError
    );
  });
});
