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
      build: jest.fn().mockResolvedValue('{"devices":[]}')
    });
    service = new AssistantSmallTalkService(mockOllama, mockContextBuilder);
  });

  it('should call contextBuilder and include Context in the prompt', async () => {
    mockOllama.generateJson.mockResolvedValue({ text: 'Hello from Ollama' });
    
    await service.handle('dime algo interesante', 'es');
    
    expect(mockContextBuilder.build).toHaveBeenCalled();
    const callArg = mockOllama.generateJson.mock.calls[0][0];
    expect(callArg).toContain('Context:');
    expect(callArg).toContain('{"devices":[]}');
  });

  it('should pass userId to contextBuilder if provided', async () => {
    mockOllama.generateJson.mockResolvedValue({ text: 'Hello' });
    
    await service.handle('hola', 'es', 'Oscar', 'user-123');
    
    expect(mockContextBuilder.build).toHaveBeenCalledWith('user-123');
  });

  it('should include userName in the prompt if provided', async () => {
    mockOllama.generateJson.mockResolvedValue({ text: 'Hello from Ollama' });
    
    await service.handle('hola', 'es', 'Oscar');
    
    const callArg = mockOllama.generateJson.mock.calls[0][0];
    expect(callArg).toContain('You are talking to Oscar.');
    expect(callArg).toContain('Mention the user by name (Oscar) at most once');
  });

  it('should return answer when Ollama returns valid JSON', async () => {
    mockOllama.generateJson.mockResolvedValue({ text: 'Hello from Ollama' });
    
    const response = await service.handle('hola', 'es');
    
    expect(response.type).toBe('answer');
    expect(response.message).toBe('Hello from Ollama');
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
