import { EventEmitter } from 'events';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { isHomeChatEnabled } from '../../../packages/shared/config/getInstallationProfile';
import { AssistantRoutes } from '../routes/AssistantRoutes';
import { SystemRoutes } from '../routes/SystemRoutes';

class MockResponse extends EventEmitter {
  public readonly writeHead = jest.fn().mockReturnThis();
  public readonly end = jest.fn().mockReturnThis();
  public setHeader(): this { return this; }
}

function createRequest(url: string, body: unknown = { prompt: 'enciende la sala' }): HomePilotRequest {
  const request = new EventEmitter() as HomePilotRequest;
  request.url = url;
  request.headers = { host: 'localhost' };
  request.socket = { remoteAddress: '127.0.0.1' } as HomePilotRequest['socket'];
  request.user = { id: 'user-1', username: 'ana', role: 'parent', displayName: null, avatarDataUri: null };
  request._fastifyParsedBody = JSON.stringify(body);
  return request;
}

function createContainer() {
  const converse = jest.fn().mockResolvedValue({ type: 'answer', message: 'Hola' });
  const synthesize = jest.fn().mockResolvedValue({ provider: 'piper', audioContentType: 'audio/wav', audioBase64: 'YWJj' });
  const transcribe = jest.fn().mockResolvedValue({ provider: 'whisper-local', transcript: 'hola' });
  const container = {
    guards: { authGuard: { protect: jest.fn().mockResolvedValue(true), requireRole: jest.fn().mockReturnValue(true) } },
    services: {
      assistantConversationService: { converse },
      assistantTextToSpeechService: { synthesize },
      assistantSpeechToTextService: { transcribe },
    },
    repositories: {
      homeRepository: { findHomesByUserId: jest.fn().mockResolvedValue([{ id: 'home-1' }]) },
      deviceRepository: { findAllByHomeId: jest.fn().mockResolvedValue([]) },
      roomRepository: { findRoomsByHomeId: jest.fn().mockResolvedValue([]), findRoomById: jest.fn() },
    },
  } as unknown as BootstrapContainer;
  return { container, converse, synthesize, transcribe };
}

describe('Feature: installer option "Conversar con mi casa"', () => {
  const previous = process.env.HOMEPILOT_HOME_CHAT_ENABLED;
  afterEach(() => {
    if (previous === undefined) delete process.env.HOMEPILOT_HOME_CHAT_ENABLED; else process.env.HOMEPILOT_HOME_CHAT_ENABLED = previous;
  });

  it('is on unless the installer turned it off', () => {
    expect(isHomeChatEnabled(undefined)).toBe(true);
    expect(isHomeChatEnabled('true')).toBe(true);
    expect(isHomeChatEnabled('')).toBe(true);
    expect(isHomeChatEnabled('false')).toBe(false);
  });

  it.each(['/api/v1/assistant/converse', '/api/v1/assistant/tts', '/api/v1/assistant/stt'])(
    'answers 403 FEATURE_DISABLED on %s and reaches no service when it is off',
    async (path) => {
      process.env.HOMEPILOT_HOME_CHAT_ENABLED = 'false';
      const { container, converse, synthesize, transcribe } = createContainer();
      const response = new MockResponse();

      await new AssistantRoutes().handle(createRequest(path), response as unknown as http.ServerResponse, path, 'POST', container);

      expect(response.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
      expect(response.end).toHaveBeenCalledWith(expect.stringContaining('FEATURE_DISABLED'));
      expect(converse).not.toHaveBeenCalled();
      expect(synthesize).not.toHaveBeenCalled();
      expect(transcribe).not.toHaveBeenCalled();
    },
  );

  it('keeps answering when it is on', async () => {
    delete process.env.HOMEPILOT_HOME_CHAT_ENABLED;
    const { container, converse } = createContainer();
    const response = new MockResponse();

    await new AssistantRoutes().handle(createRequest('/api/v1/assistant/converse'), response as unknown as http.ServerResponse, '/api/v1/assistant/converse', 'POST', container);

    expect(converse).toHaveBeenCalledTimes(1);
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });

  it('tells every signed-in user which options the installer enabled', async () => {
    process.env.HOMEPILOT_HOME_CHAT_ENABLED = 'false';
    const { container } = createContainer();
    const response = new MockResponse();

    await new SystemRoutes().handle(createRequest('/api/v1/system/features', {}), response as unknown as http.ServerResponse, '/api/v1/system/features', 'GET', container);

    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(JSON.stringify({ homeChat: false }));
  });

  it('does not reveal the options without a session', async () => {
    const { container } = createContainer();
    (container.guards.authGuard.protect as jest.Mock).mockResolvedValue(false);
    const response = new MockResponse();

    await new SystemRoutes().handle(createRequest('/api/v1/system/features', {}), response as unknown as http.ServerResponse, '/api/v1/system/features', 'GET', container);

    expect(response.end).not.toHaveBeenCalledWith(expect.stringContaining('homeChat'));
  });
});
