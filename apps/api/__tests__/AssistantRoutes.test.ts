import { AssistantRoutes } from '../routes/AssistantRoutes';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { AssistantSpeechToTextUnavailableError } from '../../../packages/assistant/application/AssistantSpeechToTextService';

describe('Feature: Local assistant speech transport', () => {
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
      protect: jest.fn().mockResolvedValue(true),
      requireRole: jest.fn().mockReturnValue(true)
    };
    mockContainer = {
      services: {
        assistantConversationService: mockAssistantConversationService,
        assistantTextToSpeechService: mockAssistantTextToSpeechService,
        assistantSpeechToTextService: mockAssistantSpeechToTextService
      } as any,
      guards: {
        authGuard: mockAuthGuard
      } as any,
      repositories: {
        homeRepository: { findHomesByUserId: jest.fn().mockResolvedValue([{ id: 'home-1' }]) },
        roomRepository: { findRoomById: jest.fn().mockResolvedValue({ id: 'r1', homeId: 'home-1' }) }
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

  it('POST /api/v1/assistant/converse binds identity and confirmation to the authenticated session', async () => {
    (mockReq as any)._fastifyParsedBody = JSON.stringify({
      prompt: 'apaga todo',
      userId: 'another-user',
      confirmed: true,
      selectedOptionId: 'confirm',
      pendingAction: { targetId: 'another-device', command: 'turn_off', originalPrompt: 'apaga todo' },
      userName: 'another-user'
    });

    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/converse', 'POST', mockContainer as BootstrapContainer);

    expect(mockAssistantConversationService.converse).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        userName: 'Test User',
        confirmed: false,
        selectedOptionId: 'confirm'
      }),
      'es'
    );
    const forwardedRequest = mockAssistantConversationService.converse.mock.calls[0][0];
    expect(forwardedRequest).not.toHaveProperty('pendingAction');
  });
  it('POST /api/v1/assistant/converse returns 403 without exposing authorization internals', async () => {
    mockAssistantConversationService.converse.mockRejectedValue(new Error('ASSISTANT_HOME_FORBIDDEN'));
    (mockReq as any)._fastifyParsedBody = JSON.stringify({ prompt: 'prende la luz' });

    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/converse', 'POST', mockContainer as BootstrapContainer);

    expect(mockRes.writeHead).toHaveBeenCalledWith(403, { 'Content-Type': 'application/json' });
    expect(mockRes.end).toHaveBeenCalledWith(expect.not.stringContaining('ASSISTANT_HOME_FORBIDDEN'));
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

  it('POST /api/v1/assistant/converse rejects a source room outside the authenticated home', async () => {
    (mockContainer.repositories as any).roomRepository.findRoomById.mockResolvedValue({ id: 'external-room', homeId: 'other-home' });
    (mockReq as any)._fastifyParsedBody = JSON.stringify({ prompt: 'prende la luz', sourceRoomId: 'external-room' });

    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/converse', 'POST', mockContainer as BootstrapContainer);

    expect(mockRes.writeHead).toHaveBeenCalledWith(403, { 'Content-Type': 'application/json' });
    expect(mockAssistantConversationService.converse).not.toHaveBeenCalled();
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

  it('Scenario: Given a local TTS request When Piper produces audio Then the route returns the audio payload', async () => {
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

  it('Scenario: Given local recorded audio When Whisper transcribes it Then the route returns the normalized transcript', async () => {
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

  it('Scenario: Given local speech is unavailable When audio is submitted Then the route returns a safe recoverable error', async () => {
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
