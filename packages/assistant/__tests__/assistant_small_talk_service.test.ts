import { AssistantSmallTalkService } from '../application/AssistantSmallTalkService';
import { createMockOllamaClient, createMockAssistantContextBuilder } from './test_helpers';
import type { OllamaClientPort } from '../application/ports/OllamaClientPort';
import type { AssistantContextBuilderPort } from '../application/ports/AssistantContextBuilderPort';

describe('AssistantSmallTalkService', () => {
  let service: AssistantSmallTalkService;
  let mockOllama: jest.Mocked<OllamaClientPort>;
  let mockContextBuilder: jest.Mocked<AssistantContextBuilderPort>;

  beforeEach(() => {
    process.env.OLLAMA_ENABLED = 'true';
    process.env.ASSISTANT_CONVERSATIONAL_LLM_PROVIDER = 'ollama';
    mockOllama = createMockOllamaClient();
    mockContextBuilder = createMockAssistantContextBuilder({
      buildUltraLightLlmHomeMap: jest.fn().mockResolvedValue({ text: 'Devices: none', devicesCount: 0 })
    });
    service = new AssistantSmallTalkService(mockOllama, mockContextBuilder);
  });

  it('should use the compact authorized home map and include it in the prompt', async () => {
    mockOllama.generateJson.mockResolvedValue({ text: 'Hello from Ollama' });
    
    await service.handle('dime algo interesante', 'es');
    
    expect(mockContextBuilder.buildUltraLightLlmHomeMap).toHaveBeenCalledWith('dime algo interesante', undefined);
    const callArg = mockOllama.generateJson.mock.calls[0][0];
    expect(callArg).toContain('Home:');
    expect(callArg).toContain('Devices: none');
  });

  it('should bound the context sent to Ollama for interactive latency', async () => {
    mockContextBuilder.buildUltraLightLlmHomeMap.mockResolvedValue({ text: 'a'.repeat(400), devicesCount: 0 });
    mockOllama.generateJson.mockResolvedValue({ text: 'Respuesta breve' });

    await service.handle('dime algo interesante', 'es');

    const callArg = mockOllama.generateJson.mock.calls[0][0];
    expect(callArg).toContain(`${'a'.repeat(120)}…`);
    expect(callArg).not.toContain('a'.repeat(121));
  });

  it('should pass userId to contextBuilder if provided', async () => {
    mockOllama.generateJson.mockResolvedValue({ text: 'Hello' });
    
    await service.handle('hola', 'es', 'Oscar', 'user-123');
    
    expect(mockContextBuilder.buildUltraLightLlmHomeMap).toHaveBeenCalledWith('hola', 'user-123');
  });

  it('should include userName in the prompt if provided', async () => {
    mockOllama.generateJson.mockResolvedValue({ text: 'Hello from Ollama' });
    
    await service.handle('hola', 'es', 'Oscar');
    
    const callArg = mockOllama.generateJson.mock.calls[0][0];
    expect(callArg).toContain('User: Oscar.');
  });

  it('should return answer when Ollama returns valid JSON', async () => {
    mockOllama.generateJson.mockResolvedValue({ text: 'Hello from Ollama' });
    
    const response = await service.handle('hola', 'es');
    
    expect(response.type).toBe('answer');
    expect(response.message).toBe('Hello from Ollama');
    expect(mockOllama.generateJson).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ timeoutMs: 800, numPredict: 20, format: expect.objectContaining({ type: 'object' }) }));
    expect(mockOllama.generateJson.mock.calls[0][0]).toContain('at most 56 characters');
  });

  it('should return a complete clause when Ollama reaches the response limit', async () => {
    mockOllama.generateJson.mockResolvedValue({ text: 'Tu casa es un lugar tranquilo y acogedor, perfecto para relajarte con la' });

    const response = await service.handle('dime algo interesante', 'es');

    expect(response.message).toBe('Tu casa es un lugar tranquilo y acogedor.');
  });

  it('should return an authorized device summary when Ollama is unavailable', async () => {
    mockContextBuilder.buildUltraLightLlmHomeMap.mockResolvedValue({ text: 'Devices: seven', devicesCount: 7 });
    mockOllama.generateJson.mockRejectedValue(new Error('timeout'));

    const response = await service.handle('dime algo interesante', 'es');

    expect(response.message).toBe('Tu casa tiene 7 dispositivos disponibles para consultar y controlar.');
  });

  it('should return fallback when Ollama returns malformed object', async () => {
    mockOllama.generateJson.mockResolvedValue({ wrong_key: 'oops' });
    
    const response = await service.handle('hola', 'es');
    
    expect(response.type).toBe('answer');
    expect(response.message).toBe('Tu casa tiene 0 dispositivos disponibles para consultar y controlar.');
  });

  it('should return fallback when Ollama returns empty text', async () => {
    mockOllama.generateJson.mockResolvedValue({ text: '  ' });
    
    const response = await service.handle('hola', 'es');
    
    expect(response.type).toBe('answer');
    expect(response.message).toBe('Tu casa tiene 0 dispositivos disponibles para consultar y controlar.');
  });

  it('should return English fallback when language is en', async () => {
    mockOllama.generateJson.mockResolvedValue(null);
    
    const response = await service.handle('hi', 'en');
    
    expect(response.type).toBe('answer');
    expect(response.message).toBe('Your home has 0 devices ready to check or control.');
  });

  it('uses the local responder by default without invoking Ollama', async () => {
    delete process.env.ASSISTANT_CONVERSATIONAL_LLM_PROVIDER;

    const response = await service.handle('a que hora debo dormir', 'es');

    expect(response).toEqual(expect.objectContaining({
      type: 'answer',
      message: expect.stringContaining('No puedo recomendar una hora personal para dormir'),
      llmAttempted: false
    }));
    expect(mockOllama.generateJson).not.toHaveBeenCalled();
  });

  it('returns a local home-focused answer when Ollama is disabled', async () => {
    process.env.OLLAMA_ENABLED = 'false';
    
    const response = await service.handle('hola', 'es');
    
    expect(response.type).toBe('answer');
    expect(response.message).toContain('Puedo ayudarte a revisar la casa');
    expect(mockOllama.generateJson).not.toHaveBeenCalled();
  });

  it('uses the configured Cloudflare conversational client without enabling Ollama', async () => {
    process.env.OLLAMA_ENABLED = 'false';
    process.env.ASSISTANT_CONVERSATIONAL_LLM_PROVIDER = 'cloudflare';
    mockOllama.generateJson.mockResolvedValue({ text: 'Respuesta desde Cloudflare' });

    const response = await service.handle('dime algo interesante', 'es');

    expect(response).toEqual(expect.objectContaining({
      message: 'Respuesta desde Cloudflare',
      llmAttempted: true
    }));
    expect(mockOllama.generateJson).toHaveBeenCalledTimes(1);
  });
});
