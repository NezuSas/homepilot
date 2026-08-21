/// <reference types="jest" />
import { converseWithAssistant, synthesizeAssistantSpeech, transcribeAssistantSpeech } from '../assistantApi';
import { apiFetch } from '../apiClient';
import i18n from '../../i18n';

jest.mock('../apiClient');
jest.mock('../../config', () => ({
  API_BASE_URL: 'http://localhost:3000',
}));

describe('Feature: consola conversa con el asistente', () => {
  const mockApiFetch = apiFetch as jest.Mock;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('Scenario: Given una conversación When la consola la envía Then publica el payload en el endpoint del asistente', async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        type: 'answer',
        message: 'Hola',
      }),
    });

    const result = await converseWithAssistant({
      prompt: 'hola',
      sourceRoomId: 'room-1',
    });

    expect(mockApiFetch).toHaveBeenCalledWith('http://localhost:3000/api/v1/assistant/converse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'hola',
        sourceRoomId: 'room-1',
      }),
    });
    expect(result).toEqual({
      type: 'answer',
      message: 'Hola',
    });
  });

  it('converseWithAssistant throws the backend message on failure', async () => {
    mockApiFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        message: 'Assistant failed',
      }),
    });

    await expect(converseWithAssistant({ prompt: 'haz algo' })).rejects.toThrow('Assistant failed');
  });

  it('converseWithAssistant falls back to a status-based error when response json is unavailable', async () => {
    mockApiFetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => {
        throw new Error('invalid json');
      },
    });

    await expect(converseWithAssistant({ prompt: 'haz algo' })).rejects.toThrow(
      'Assistant conversation failed (503)'
    );
  });

  it('converseWithAssistant reads the standard nested API error message', async () => {
    mockApiFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Los datos proporcionados no son válidos.' } }),
    });

    await expect(converseWithAssistant({ prompt: 'haz algo' })).rejects.toThrow(
      'Los datos proporcionados no son válidos.'
    );
  });

  it('converseWithAssistant aborts voice requests after the configured timeout', async () => {
    jest.useFakeTimers();
    mockApiFetch.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));

    const request = converseWithAssistant({ prompt: 'orden confusa' }, { timeoutMs: 5000 });
    jest.advanceTimersByTime(5000);

    await expect(request).rejects.toThrow(i18n.t('assistant.conversation.voice_timeout'));
    jest.useRealTimers();
  });

  it('converseWithAssistant preserves caller cancellation without converting it to a timeout', async () => {
    const controller = new AbortController();
    mockApiFetch.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));

    const request = converseWithAssistant({ prompt: 'orden anterior' }, { signal: controller.signal });
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('transcribeAssistantSpeech releases a passive request after its timeout', async () => {
    jest.useFakeTimers();
    mockApiFetch.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));

    const request = transcribeAssistantSpeech('YWJj', 'audio/webm', { timeoutMs: 8000 });
    jest.advanceTimersByTime(8000);

    await expect(request).resolves.toBeNull();
    jest.useRealTimers();
  });
});

describe('Feature: assistant voice API contracts', () => {
  const mockApiFetch = apiFetch as jest.Mock;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns a valid local TTS response and rejects invalid or failed payloads safely', async () => {
    mockApiFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ provider: 'piper', audioContentType: 'audio/wav', audioBase64: 'UklGRg==' }) });
    await expect(synthesizeAssistantSpeech('Hola')).resolves.toEqual({ provider: 'piper', audioContentType: 'audio/wav', audioBase64: 'UklGRg==' });

    mockApiFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ provider: 'kokoro', audioContentType: 'audio/wav', audioBase64: 'S29rb3Jv' }) });
    await expect(synthesizeAssistantSpeech('Hola')).resolves.toEqual({ provider: 'kokoro', audioContentType: 'audio/wav', audioBase64: 'S29rb3Jv' });


    mockApiFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ provider: 'remote', audioContentType: 'audio/wav', audioBase64: 'audio' }) });
    await expect(synthesizeAssistantSpeech('Hola')).resolves.toBeNull();

    mockApiFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    await expect(synthesizeAssistantSpeech('Hola')).resolves.toBeNull();
  });

  it('cancels a pending TTS request without removing the written response', async () => {
    const controller = new AbortController();
    mockApiFetch.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));

    const request = synthesizeAssistantSpeech('Hola', { signal: controller.signal });
    controller.abort();

    await expect(request).resolves.toBeNull();
  });

  it('degrades safely when speech payloads are malformed or unavailable', async () => {
    mockApiFetch.mockResolvedValueOnce({ ok: true, json: async () => { throw new Error('invalid json'); } });
    await expect(synthesizeAssistantSpeech('Hola')).resolves.toBeNull();

    mockApiFetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'unavailable' }) });
    await expect(transcribeAssistantSpeech('YWJj', 'audio/webm')).resolves.toBeNull();
  });
  it('releases the voice interaction when Whisper reports a capture conflict', async () => {
    mockApiFetch.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'capture already active' }) });

    await expect(transcribeAssistantSpeech('YWJj', 'audio/webm')).resolves.toBeNull();
  });
  it('accepts only valid local speech-to-text payloads and propagates non-timeout transport failures', async () => {
    mockApiFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ provider: 'whisper-local', transcript: 'Apaga la sala' }) });
    await expect(transcribeAssistantSpeech('YWJj', 'audio/webm')).resolves.toEqual({ provider: 'whisper-local', transcript: 'Apaga la sala' });

    mockApiFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ provider: 'whisper-local' }) });
    await expect(transcribeAssistantSpeech('YWJj', 'audio/webm')).resolves.toBeNull();

    mockApiFetch.mockRejectedValueOnce(new Error('network unavailable'));
    await expect(transcribeAssistantSpeech('YWJj', 'audio/webm')).rejects.toThrow('network unavailable');
  });
  it('cancels a speech-to-text request when its assistant turn is invalidated', async () => {
    const controller = new AbortController();
    mockApiFetch.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));

    const request = transcribeAssistantSpeech('YWJj', 'audio/webm', { signal: controller.signal });
    controller.abort();

    await expect(request).resolves.toBeNull();
  });
  it('forwards an already-aborted caller signal to the assistant request without creating a timeout', async () => {
    const controller = new AbortController();
    controller.abort();
    mockApiFetch.mockImplementation((_url: string, init: RequestInit) => {
      expect(init.signal?.aborted).toBe(true);
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    });

    await expect(converseWithAssistant({ prompt: 'cancelled before send' }, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});