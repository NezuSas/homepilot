import { AssistantSmallTalkService } from '../application/AssistantSmallTalkService';

describe('AssistantSmallTalkService', () => {
  let service: AssistantSmallTalkService;

  beforeEach(() => {
    service = new AssistantSmallTalkService();
  });

  it('answers a personal sleep question with the deterministic local responder', async () => {
    const response = await service.handle('a que hora debo dormir', 'es');

    expect(response).toEqual({
      type: 'answer',
      message: expect.stringContaining('No puedo recomendar una hora personal para dormir')
    });
  });

  it('returns a local home-focused answer for a greeting', async () => {
    const response = await service.handle('hola', 'es');

    expect(response.type).toBe('answer');
    expect(response.message).toContain('Puedo ayudarte a revisar la casa');
  });
});
