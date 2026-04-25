import { OllamaClient } from '../infrastructure/OllamaClient';

describe('OllamaClient', () => {
  const baseUrl = 'http://localhost:11434';
  const model = 'phi3';
  const timeoutMs = 100;
  let client: OllamaClient;

  beforeEach(() => {
    client = new OllamaClient(baseUrl, model, timeoutMs);
    global.fetch = jest.fn();
  });

  it('should generate JSON successfully', async () => {
    const mockResponse = { response: JSON.stringify({ type: 'scene', sceneId: '123' }) };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const result = await client.generateJson('test prompt');
    expect(result).toEqual({ type: 'scene', sceneId: '123' });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/generate'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"format":"json"')
      })
    );
  });

  it('should throw error on API failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('Internal Server Error'),
    });

    await expect(client.generateJson('test')).rejects.toThrow('Ollama API error (500)');
  });

  it('should throw timeout error', async () => {
    (global.fetch as jest.Mock).mockImplementation(() => 
      new Promise((_, reject) => {
        const error = new Error('The user aborted a request.');
        error.name = 'AbortError';
        setTimeout(() => reject(error), 50);
      })
    );

    await expect(client.generateJson('test')).rejects.toThrow('Ollama request timed out');
  });

  it('should throw error on invalid JSON response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ response: 'not a json' }),
    });

    await expect(client.generateJson('test')).rejects.toThrow('Failed to parse Ollama response as JSON');
  });
});
