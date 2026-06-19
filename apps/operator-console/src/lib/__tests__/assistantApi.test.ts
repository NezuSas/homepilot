/// <reference types="jest" />
import { converseWithAssistant, transcribeAssistantSpeech } from '../assistantApi';
import { apiFetch } from '../apiClient';

jest.mock('../apiClient');
jest.mock('../../config', () => ({
  API_BASE_URL: 'http://localhost:3000',
}));

describe('assistantApi', () => {
  const mockApiFetch = apiFetch as jest.Mock;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('converseWithAssistant posts the conversation payload to the converse endpoint', async () => {
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

    await expect(request).rejects.toThrow('No pude entenderte a tiempo. Inténtalo de nuevo.');
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
