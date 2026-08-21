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

  it('should keep the model resident and use deterministic, bounded generation options', async () => {
    const mockResponse = { response: JSON.stringify({ ok: true }) };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    await client.generateJson('test prompt');

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.keep_alive).toBe('30m');
    expect(body.options).toEqual({ temperature: 0, num_predict: 256, num_ctx: 1024, top_k: 20, top_p: 0.9 });
  });

  it('should use a caller-provided JSON Schema as the format instead of plain "json"', async () => {
    const mockResponse = { response: JSON.stringify({ ok: true }) };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const schema = { type: 'object', properties: { ok: { type: 'boolean' } } };
    await client.generateJson('test prompt', { format: schema });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.format).toEqual(schema);
  });

  it('should allow overriding temperature and generation length', async () => {
    const mockResponse = { response: JSON.stringify({ ok: true }) };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    await client.generateJson('test prompt', { temperature: 0.7, numPredict: 100 });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.options.temperature).toBe(0.7);
    expect(body.options.num_predict).toBe(100);
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
  it('preloads the configured local model with a bounded structured request', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ response: JSON.stringify({ ready: true }) }),
    });

    await client.warmUp(750);

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.model).toBe(model);
    expect(body.keep_alive).toBe('30m');
    expect(body.options.num_predict).toBe(8);
    expect(init.body).toContain('Return JSON where ready is true.');
  });
});
