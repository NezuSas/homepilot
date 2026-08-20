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
    expect(callArg).toContain(`${'a'.repeat(160)}…`);
    expect(callArg).not.toContain('a'.repeat(161));
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
    expect(mockOllama.generateJson).toHaveBeenCalledWith(expect.any(String), { timeoutMs: 2500, numPredict: 24 });
  });

  it('should return fallback when Ollama returns malformed object', async () => {
    mockOllama.generateJson.mockResolvedValue({ wrong_key: 'oops' });
    
    const response = await service.handle('hola', 'es');
    
    expect(response.type).toBe('answer');
    expect(response.message).toContain('No estoy seguro');
  });

  it('should return fallback when Ollama returns empty text', async () => {
    mockOllama.generateJson.mockResolvedValue({ text: '  ' });
    
    const response = await service.handle('hola', 'es');
    
    expect(response.type).toBe('answer');
    expect(response.message).toContain('No estoy seguro');
  });

  it('should return English fallback when language is en', async () => {
    mockOllama.generateJson.mockResolvedValue(null);
    
    const response = await service.handle('hi', 'en');
    
    expect(response.type).toBe('answer');
    expect(response.message).toContain('I’m not sure');
  });

  it('should return fallback when OLLAMA_ENABLED is false', async () => {
    process.env.OLLAMA_ENABLED = 'false';
    
    const response = await service.handle('hola', 'es');
    
    expect(response.type).toBe('answer');
    expect(response.message).toContain('No estoy seguro');
    expect(mockOllama.generateJson).not.toHaveBeenCalled();
  });
});
