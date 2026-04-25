/// <reference types="jest" />
import { executeAssistantPrompt, AssistantConfirmationRequiredError } from '../assistantApi';
import { apiFetch } from '../apiClient';

jest.mock('../apiClient');
jest.mock('../../config', () => ({
  API_BASE_URL: 'http://localhost:3000'
}));

describe('assistantApi', () => {
  const mockApiFetch = apiFetch as jest.Mock;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('executeAssistantPrompt throws AssistantConfirmationRequiredError on valid 409 preview', async () => {
    mockApiFetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: 'CONFIRMATION_REQUIRED',
        preview: {
          prompt: 'apaga todo',
          intentType: 'command',
          requiresConfirmation: true,
          summary: 'Comandos globales requieren confirmación.'
        }
      })
    });

    await expect(executeAssistantPrompt('apaga todo')).rejects.toThrow(AssistantConfirmationRequiredError);
  });

  it('executeAssistantPrompt throws normal Error if 409 preview is malformed', async () => {
    mockApiFetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: 'CONFIRMATION_REQUIRED',
        preview: {
          prompt: 'apaga todo',
          // intentType is missing -> invalid
          requiresConfirmation: true,
          summary: 'Comandos globales requieren confirmación.'
        }
      })
    });

    await expect(executeAssistantPrompt('apaga todo')).rejects.toThrow(Error);
    await expect(executeAssistantPrompt('apaga todo')).rejects.not.toThrow(AssistantConfirmationRequiredError);
  });

  it('executeAssistantPrompt throws normal Error on 500', async () => {
    mockApiFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        error: { message: 'Internal Server Error' }
      })
    });

    await expect(executeAssistantPrompt('haz algo')).rejects.toThrow('Internal Server Error');
  });

  it('executeAssistantPrompt returns data on success', async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        sceneId: 'test',
        status: 'success',
        actions: []
      })
    });

    const result = await executeAssistantPrompt('prende luz');
    expect(result.status).toBe('success');
  });
});
