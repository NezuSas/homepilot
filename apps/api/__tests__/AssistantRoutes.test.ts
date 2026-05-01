import { AssistantRoutes } from '../routes/AssistantRoutes';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';

describe('AssistantRoutes', () => {
  let routes: AssistantRoutes;
  let mockReq: Partial<HomePilotRequest>;
  let mockRes: Partial<http.ServerResponse>;
  let mockContainer: Partial<BootstrapContainer>;
  let mockAssistantConversationService: any;
  let mockAuthGuard: any;

  beforeEach(() => {
    mockAssistantConversationService = {
      converse: jest.fn().mockResolvedValue({ type: 'answer', message: 'Hello' })
    };
    mockAuthGuard = {
      protect: jest.fn().mockResolvedValue(true)
    };
    mockContainer = {
      services: {
        assistantConversationService: mockAssistantConversationService
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
});
