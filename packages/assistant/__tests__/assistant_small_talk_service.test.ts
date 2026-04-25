import { AssistantSmallTalkService } from '../application/AssistantSmallTalkService';
import { createMockOllamaClient } from './test_helpers';
import type { OllamaClientPort } from '../application/ports/OllamaClientPort';

describe('AssistantSmallTalkService', () => {
  let service: AssistantSmallTalkService;
  let mockOllama: jest.Mocked<OllamaClientPort>;

  beforeEach(() => {
    process.env.OLLAMA_ENABLED = 'true';
    mockOllama = createMockOllamaClient();
    service = new AssistantSmallTalkService(mockOllama);
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
