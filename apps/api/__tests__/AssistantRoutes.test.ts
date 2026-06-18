import { AssistantRoutes } from '../routes/AssistantRoutes';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { AssistantSpeechToTextUnavailableError } from '../../../packages/assistant/application/AssistantSpeechToTextService';

describe('AssistantRoutes', () => {
  let routes: AssistantRoutes;
  let mockReq: Partial<HomePilotRequest>;
  let mockRes: Partial<http.ServerResponse>;
  let mockContainer: Partial<BootstrapContainer>;
  let mockAssistantConversationService: any;
  let mockAssistantTextToSpeechService: any;
  let mockAssistantSpeechToTextService: any;
  let mockAuthGuard: any;

  beforeEach(() => {
    mockAssistantConversationService = {
      converse: jest.fn().mockResolvedValue({ type: 'answer', message: 'Hello' })
    };
    mockAssistantTextToSpeechService = {
      synthesize: jest.fn().mockResolvedValue({
        provider: 'piper',
        audioContentType: 'audio/wav',
        audioBase64: 'YWJj'
      })
    };
    mockAssistantSpeechToTextService = {
      transcribe: jest.fn().mockResolvedValue({
        provider: 'whisper-local',
        transcript: 'enciende la sala'
      })
    };
    mockAuthGuard = {
      protect: jest.fn().mockResolvedValue(true)
    };
    mockContainer = {
      services: {
        assistantConversationService: mockAssistantConversationService,
        assistantTextToSpeechService: mockAssistantTextToSpeechService,
        assistantSpeechToTextService: mockAssistantSpeechToTextService
      } as any,
      guards: {
        authGuard: mockAuthGuard
      } as any
    };
    routes = new AssistantRoutes();
    mockRes = {
      writeHead: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis()
    };
    mockReq = {
      user: { id: 'u1', username: 'testuser', role: 'admin' as any, displayName: 'Test User', avatarDataUri: null },
      headers: { 'accept-language': 'es' }
    };
  });

  it('POST /api/v1/assistant/converse passes sourceRoomId to service', async () => {
    const body = { prompt: 'prende la luz', sourceRoomId: 'r1' };
    (mockReq as any)._fastifyParsedBody = JSON.stringify(body);
    
    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/converse', 'POST', mockContainer as BootstrapContainer);

    expect(mockAssistantConversationService.converse).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'prende la luz',
        sourceRoomId: 'r1'
      }),
      'es'
    );
  });

  it('POST /api/v1/assistant/converse handles request without sourceRoomId', async () => {
    const body = { prompt: 'prende la luz' };
    (mockReq as any)._fastifyParsedBody = JSON.stringify(body);
    
    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/converse', 'POST', mockContainer as BootstrapContainer);

    expect(mockAssistantConversationService.converse).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'prende la luz'
      }),
      'es'
    );
  });

  it('POST /api/v1/assistant/converse logs [ASSISTANT_CONTEXT_SOURCE] when sourceRoomId is present', async () => {
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
    const body = { prompt: 'prende la luz', sourceRoomId: 'r1' };
    (mockReq as any)._fastifyParsedBody = JSON.stringify(body);
    
    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/converse', 'POST', mockContainer as BootstrapContainer);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[ASSISTANT_CONTEXT_SOURCE]'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"sourceRoomId":"r1"'));
    
    consoleSpy.mockRestore();
  });

  it('POST /api/v1/assistant/tts returns professional speech audio', async () => {
    (mockReq as any)._fastifyParsedBody = JSON.stringify({ text: 'Hola casa' });

    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/tts', 'POST', mockContainer as BootstrapContainer);

    expect(mockAssistantTextToSpeechService.synthesize).toHaveBeenCalledWith({
      text: 'Hola casa',
      language: 'es'
    });
    expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
    expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({
      provider: 'piper',
      audioContentType: 'audio/wav',
      audioBase64: 'YWJj'
    }));
  });

  it('POST /api/v1/assistant/stt returns local speech transcript', async () => {
    (mockReq as any)._fastifyParsedBody = JSON.stringify({
      audioBase64: 'YWJj',
      audioContentType: 'audio/webm'
    });

    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/stt', 'POST', mockContainer as BootstrapContainer);

    expect(mockAssistantSpeechToTextService.transcribe).toHaveBeenCalledWith({
      audioBase64: 'YWJj',
      audioContentType: 'audio/webm',
      language: 'es'
    });
    expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
    expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({
      provider: 'whisper-local',
      transcript: 'enciende la sala'
    }));
  });

  it('POST /api/v1/assistant/stt returns a safe error when local speech is unavailable', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    mockAssistantSpeechToTextService.transcribe.mockRejectedValue(
      new AssistantSpeechToTextUnavailableError('fetch failed')
    );
    (mockReq as any)._fastifyParsedBody = JSON.stringify({
      audioBase64: 'YWJj',
      audioContentType: 'audio/webm'
    });

    try {
      await routes.handle(
        mockReq as HomePilotRequest,
        mockRes as http.ServerResponse,
        '/api/v1/assistant/stt',
        'POST',
        mockContainer as BootstrapContainer
      );
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }

    expect(mockRes.writeHead).toHaveBeenCalledWith(409, { 'Content-Type': 'application/json' });
    expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('La transcripción de voz local no está disponible.'));
  });
});
