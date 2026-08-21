import { AssistantRoutes } from '../routes/AssistantRoutes';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { AssistantSpeechToTextUnavailableError, AssistantSpeechToTextValidationError } from '../../../packages/assistant/application/AssistantSpeechToTextService';
import { AssistantTextToSpeechUnavailableError, AssistantTextToSpeechValidationError } from '../../../packages/assistant/application/AssistantTextToSpeechService';
import { SingleHomeInstallationError } from '../../../packages/topology/domain/errors';

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
        assistantService: { getSummary: jest.fn().mockResolvedValue({ totalOpen: 0, bySeverity: {}, byType: {} }) },
        assistantConversationService: mockAssistantConversationService,
        assistantTextToSpeechService: mockAssistantTextToSpeechService,
        assistantSpeechToTextService: mockAssistantSpeechToTextService,
        assistantActionService: { handleAction: jest.fn().mockResolvedValue(undefined) }
      } as any,
      guards: {
        authGuard: mockAuthGuard
      } as any,
      repositories: {
        homeRepository: { findHomesByUserId: jest.fn().mockResolvedValue([{ id: 'home-1' }]) },
        deviceRepository: { findAllByHomeId: jest.fn().mockResolvedValue([{ name: 'Dicroicos Trabajo' }]) },
        roomRepository: {
          findRoomById: jest.fn().mockResolvedValue({ id: 'r1', homeId: 'home-1' }),
          findRoomsByHomeId: jest.fn().mockResolvedValue([{ name: 'Cuarto Master' }])
        }
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

  it('returns a stable authorization error when the home scope cannot be loaded', async () => {
    (mockContainer.repositories as any).homeRepository.findHomesByUserId.mockRejectedValue(new Error('home store unavailable'));

    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/summary', 'GET', mockContainer as BootstrapContainer);

    expect(mockRes.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'application/json' });
    expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('ASSISTANT_AUTHORIZATION_ERROR'));
  });

  it('contains planner status failures behind the assistant error contract', async () => {
    (mockContainer.services as any).assistantPlannerV2ShadowService = {
      getStatus: jest.fn().mockImplementation(() => { throw new Error('planner unavailable'); }),
    };

    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/shadow/status', 'GET', mockContainer as BootstrapContainer);

    expect(mockRes.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'application/json' });
    expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('ASSISTANT_ERROR'));
  });
  it('GET /api/v1/assistant/summary returns an explicit installation error when legacy homes are duplicated', async () => {
    (mockContainer.repositories as any).homeRepository.findHomesByUserId.mockRejectedValue(new SingleHomeInstallationError());

    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/summary', 'GET', mockContainer as BootstrapContainer);

    expect(mockRes.writeHead).toHaveBeenCalledWith(409, { 'Content-Type': 'application/json' });
    expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('SINGLE_HOME_INSTALLATION'));
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

  it('uses the selected English locale for TTS instead of the browser default', async () => {
    (mockReq as any).headers = { 'accept-language': 'en-US,en;q=0.9' };
    (mockReq as any)._fastifyParsedBody = JSON.stringify({ text: 'Home ready' });

    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/tts', 'POST', mockContainer as BootstrapContainer);

    expect(mockAssistantTextToSpeechService.synthesize).toHaveBeenCalledWith({
      text: 'Home ready',
      language: 'en'
    });
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
      language: 'es',
      contextTerms: ['Dicroicos Trabajo', 'Cuarto Master']
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
  it('returns only findings from the authenticated user homes', async () => {
    const findings = [{ id: 'finding-1', title: 'Duplicate device name' }];
    (mockContainer.services as any).assistantService.listOpen = jest.fn().mockResolvedValue(findings);

    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/findings', 'GET', mockContainer as BootstrapContainer);

    expect((mockContainer.services as any).assistantService.listOpen).toHaveBeenCalledWith(['home-1']);
    expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify(findings));
  });

  it('scans every authorized home and returns a successful manual scan response', async () => {
    (mockContainer.repositories as any).homeRepository.findHomesByUserId.mockResolvedValue([{ id: 'home-1' }, { id: 'home-2' }]);
    (mockContainer.services as any).assistantService.scan = jest.fn().mockResolvedValue(undefined);

    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/scan', 'POST', mockContainer as BootstrapContainer);

    expect((mockContainer.services as any).assistantService.scan).toHaveBeenCalledWith('home-1', 'manual_trigger');
    expect((mockContainer.services as any).assistantService.scan).toHaveBeenCalledWith('home-2', 'manual_trigger');
    expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ success: true }));
  });

  it('rejects incomplete assistant actions before invoking the action service', async () => {
    (mockReq as any)._fastifyParsedBody = JSON.stringify({ findingId: 'finding-1' });

    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/actions', 'POST', mockContainer as BootstrapContainer);

    expect((mockContainer.services as any).assistantActionService.handleAction).not.toHaveBeenCalled();
    expect(mockRes.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' });
  });

  it('returns validation feedback when conversation input is empty', async () => {
    (mockReq as any)._fastifyParsedBody = JSON.stringify({});

    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/converse', 'POST', mockContainer as BootstrapContainer);

    expect(mockAssistantConversationService.converse).not.toHaveBeenCalled();
    expect(mockRes.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' });
  });
  it('returns false for paths outside the assistant namespace without checking the session', async () => {
    const handled = await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/devices', 'GET', mockContainer as BootstrapContainer);

    expect(handled).toBe(false);
    expect(mockAuthGuard.protect).not.toHaveBeenCalled();
  });

  it('stops protected assistant routes when the session guard rejects the request', async () => {
    mockAuthGuard.protect.mockResolvedValue(false);

    const handled = await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/summary', 'GET', mockContainer as BootstrapContainer);

    expect(handled).toBe(true);
    expect((mockContainer.services as any).assistantService.getSummary).not.toHaveBeenCalled();
  });

  it('returns planner shadow status only to administrators', async () => {
    (mockContainer.services as any).assistantPlannerV2ShadowService = { getStatus: jest.fn().mockReturnValue({ enabled: true }) };

    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/shadow/status', 'GET', mockContainer as BootstrapContainer);

    expect((mockContainer.services as any).assistantPlannerV2ShadowService.getStatus).toHaveBeenCalledTimes(1);
    expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ enabled: true }));
  });

  it('does not expose shadow metrics when the required role is denied', async () => {
    mockAuthGuard.requireRole.mockReturnValue(false);
    (mockContainer.services as any).assistantPlannerV2ShadowService = { getMetrics: jest.fn() };

    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/shadow/metrics', 'GET', mockContainer as BootstrapContainer);

    expect((mockContainer.services as any).assistantPlannerV2ShadowService.getMetrics).not.toHaveBeenCalled();
  });

  it('dismisses and resolves findings only inside the authenticated homes', async () => {
    (mockContainer.services as any).assistantService.dismiss = jest.fn().mockResolvedValue(undefined);
    (mockContainer.services as any).assistantService.resolve = jest.fn().mockResolvedValue(undefined);

    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/findings/finding-1/dismiss', 'POST', mockContainer as BootstrapContainer);
    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/findings/finding-2/resolve', 'POST', mockContainer as BootstrapContainer);

    expect((mockContainer.services as any).assistantService.dismiss).toHaveBeenCalledWith('finding-1', ['home-1']);
    expect((mockContainer.services as any).assistantService.resolve).toHaveBeenCalledWith('finding-2', ['home-1']);
  });

  it('returns a safe scan error when a manual scan fails', async () => {
    (mockContainer.services as any).assistantService.scan = jest.fn().mockRejectedValue(new Error('scanner offline'));

    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/scan', 'POST', mockContainer as BootstrapContainer);

    expect(mockRes.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'application/json' });
    expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('ASSISTANT_SCAN_ERROR'));
  });

  it('executes a complete assistant action with session identity and a supplied correlation id', async () => {
    (mockReq as any)._fastifyParsedBody = JSON.stringify({ findingId: 'finding-1', actionType: 'apply', payload: { mode: 'safe' } });
    (mockReq as any).headers = { 'x-correlation-id': 'corr-1' };

    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/actions', 'POST', mockContainer as BootstrapContainer);

    expect((mockContainer.services as any).assistantActionService.handleAction).toHaveBeenCalledWith(
      'finding-1', 'apply', { mode: 'safe' }, 'u1', 'corr-1', ['home-1']
    );
    expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ success: true }));
  });

  it('uses English for conversation and sanitizes the returned response', async () => {
    (mockReq as any).headers = { 'accept-language': 'en-US' };
    mockAssistantConversationService.converse.mockResolvedValue({ type: 'answer', message: '<script>alert(1)</script>Hello' });
    (mockReq as any)._fastifyParsedBody = JSON.stringify({ prompt: 'hello' });

    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/converse', 'POST', mockContainer as BootstrapContainer);

    expect(mockAssistantConversationService.converse).toHaveBeenCalledWith(expect.objectContaining({ prompt: 'hello' }), 'en');
    expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ type: 'answer', message: '<script>alert(1)</script>Hello' }));
  });

  it('maps typed TTS and STT validation and availability failures to their public status codes', async () => {
    mockAssistantTextToSpeechService.synthesize.mockRejectedValueOnce(new AssistantTextToSpeechValidationError('text is required'));
    (mockReq as any)._fastifyParsedBody = JSON.stringify({ text: '' });
    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/tts', 'POST', mockContainer as BootstrapContainer);
    expect(mockRes.writeHead).toHaveBeenLastCalledWith(400, { 'Content-Type': 'application/json' });

    mockAssistantTextToSpeechService.synthesize.mockRejectedValueOnce(new AssistantTextToSpeechUnavailableError('offline'));
    (mockReq as any)._fastifyParsedBody = JSON.stringify({ text: 'hola' });
    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/tts', 'POST', mockContainer as BootstrapContainer);
    expect(mockRes.writeHead).toHaveBeenLastCalledWith(409, { 'Content-Type': 'application/json' });

    mockAssistantSpeechToTextService.transcribe.mockRejectedValueOnce(new AssistantSpeechToTextValidationError('audio required'));
    (mockReq as any)._fastifyParsedBody = JSON.stringify({});
    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/stt', 'POST', mockContainer as BootstrapContainer);
    expect(mockRes.writeHead).toHaveBeenLastCalledWith(400, { 'Content-Type': 'application/json' });
  });

  it('returns a 404 contract for unknown assistant paths', async () => {
    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/unknown', 'GET', mockContainer as BootstrapContainer);

    expect(mockRes.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' });
    expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('NOT_FOUND'));
  });
  it('maps scoped finding failures and generic summary failures to their public contracts', async () => {
    (mockContainer.services as any).assistantService.getSummary = jest.fn()
      .mockRejectedValueOnce(new Error('ASSISTANT_FINDING_FORBIDDEN'))
      .mockRejectedValueOnce(new Error('summary backend unavailable'));

    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/summary', 'GET', mockContainer as BootstrapContainer);
    expect(mockRes.writeHead).toHaveBeenLastCalledWith(403, { 'Content-Type': 'application/json' });
    expect(mockRes.end).toHaveBeenLastCalledWith(expect.not.stringContaining('ASSISTANT_FINDING_FORBIDDEN'));

    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/summary', 'GET', mockContainer as BootstrapContainer);
    expect(mockRes.writeHead).toHaveBeenLastCalledWith(500, { 'Content-Type': 'application/json' });
    expect(mockRes.end).toHaveBeenLastCalledWith(expect.stringContaining('summary backend unavailable'));
  });

  it('returns shadow metrics to an administrator and maps local STT unavailability', async () => {
    (mockContainer.services as any).assistantPlannerV2ShadowService = { getMetrics: jest.fn().mockReturnValue({ total: 3 }) };
    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/shadow/metrics', 'GET', mockContainer as BootstrapContainer);
    expect(mockRes.end).toHaveBeenLastCalledWith(JSON.stringify({ total: 3 }));

    mockAssistantSpeechToTextService.transcribe.mockRejectedValueOnce(new AssistantSpeechToTextUnavailableError('whisper offline'));
    (mockReq as any)._fastifyParsedBody = JSON.stringify({ audioBase64: 'YWJj', audioContentType: 'audio/webm' });
    await routes.handle(mockReq as HomePilotRequest, mockRes as http.ServerResponse, '/api/v1/assistant/stt', 'POST', mockContainer as BootstrapContainer);

    expect(mockRes.writeHead).toHaveBeenLastCalledWith(409, { 'Content-Type': 'application/json' });
    expect(mockRes.end).toHaveBeenLastCalledWith(expect.stringContaining('STT_UNAVAILABLE'));
  });
});

describe('Feature: assistant route failure contracts', () => {
  const createResponse = () => ({ writeHead: jest.fn().mockReturnThis(), end: jest.fn().mockReturnThis(), setHeader: jest.fn().mockReturnThis() }) as unknown as http.ServerResponse;
  const createRequest = (body?: unknown) => ({
    user: { id: 'user-1', username: 'Oscar', role: 'admin', displayName: null, avatarDataUri: null },
    headers: {},
    _fastifyParsedBody: JSON.stringify(body ?? {}),
  }) as unknown as HomePilotRequest;
  const createContainer = () => ({
    guards: { authGuard: { protect: jest.fn().mockResolvedValue(true), requireRole: jest.fn().mockReturnValue(true) } },
    repositories: { homeRepository: { findHomesByUserId: jest.fn().mockResolvedValue([{ id: 'home-1' }]) } },
    services: {
      assistantService: { listOpen: jest.fn().mockRejectedValue(new Error('store unavailable')), getSummary: jest.fn().mockRejectedValue(new Error('summary unavailable')) },
      assistantPlannerV2ShadowService: { getMetrics: jest.fn().mockReturnValue({ decisions: 3 }) },
      assistantActionService: { handleAction: jest.fn().mockRejectedValue(new Error('action unavailable')) },
      assistantTextToSpeechService: { synthesize: jest.fn().mockRejectedValue(new Error('provider error')) },
      assistantSpeechToTextService: { transcribe: jest.fn().mockRejectedValue(new AssistantSpeechToTextUnavailableError('offline')) },
    },
  }) as unknown as BootstrapContainer;

  it('maps summary and finding store failures without exposing unhandled route errors', async () => {
    const routes = new AssistantRoutes();
    const container = createContainer();
    const summaryResponse = createResponse();
    await routes.handle(createRequest(), summaryResponse, '/api/v1/assistant/summary', 'GET', container);
    expect(summaryResponse.end).toHaveBeenCalledWith(expect.stringContaining('ASSISTANT_ERROR'));

    const findingsResponse = createResponse();
    await routes.handle(createRequest(), findingsResponse, '/api/v1/assistant/findings', 'GET', container);
    expect(findingsResponse.end).toHaveBeenCalledWith(expect.stringContaining('ASSISTANT_ERROR'));
  });

  it('returns shadow metrics and maps action, TTS, and STT availability failures to stable contracts', async () => {
    const routes = new AssistantRoutes();
    const container = createContainer();
    const metricsResponse = createResponse();
    await routes.handle(createRequest(), metricsResponse, '/api/v1/assistant/shadow/metrics', 'GET', container);
    expect(metricsResponse.end).toHaveBeenCalledWith(JSON.stringify({ decisions: 3 }));

    const actionResponse = createResponse();
    await routes.handle(createRequest({ findingId: 'finding-1', actionType: 'apply' }), actionResponse, '/api/v1/assistant/actions', 'POST', container);
    expect(actionResponse.end).toHaveBeenCalledWith(expect.stringContaining('ASSISTANT_ACTION_ERROR'));

    const ttsResponse = createResponse();
    await routes.handle(createRequest({ text: 'hola' }), ttsResponse, '/api/v1/assistant/tts', 'POST', container);
    expect(ttsResponse.end).toHaveBeenCalledWith(expect.stringContaining('ASSISTANT_TTS_ERROR'));

    const sttResponse = createResponse();
    await routes.handle(createRequest({ audioBase64: 'abc', audioContentType: 'audio/webm' }), sttResponse, '/api/v1/assistant/stt', 'POST', container);
    expect(sttResponse.end).toHaveBeenCalledWith(expect.stringContaining('STT_UNAVAILABLE'));
  });
});