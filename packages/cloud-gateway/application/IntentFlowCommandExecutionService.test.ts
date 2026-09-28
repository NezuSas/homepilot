import { CommandTokenCache } from './CommandTokenCache';
import { IntentFlowCommandExecutionService } from './IntentFlowCommandExecutionService';
import { IntentFlowCommandError } from '../infrastructure/IntentFlowCommandClient';

describe('IntentFlowCommandExecutionService', () => {
  it('refreshes a cached token after 401 and retries only once', async () => {
    const source = { requestCommandToken: jest.fn()
      .mockResolvedValueOnce({ token: 'old', expiresIn: 120 })
      .mockResolvedValueOnce({ token: 'new', expiresIn: 120 }) };
    const tokens = new CommandTokenCache(source, () => 0);
    await tokens.getToken();
    const client = { execute: jest.fn()
      .mockRejectedValueOnce(new IntentFlowCommandError('INTENTFLOW_COMMAND_UNAUTHORIZED'))
      .mockResolvedValueOnce(undefined) };
    await new IntentFlowCommandExecutionService({ tokens, client }).execute(5, 'go_home');
    expect(client.execute.mock.calls).toEqual([[5, 'go_home', 'old'], [5, 'go_home', 'new']]);
    expect(source.requestCommandToken).toHaveBeenCalledTimes(2);
  });

  it('does not retry 401 from a newly fetched token and invalidates it', async () => {
    const source = { requestCommandToken: jest.fn().mockResolvedValue({ token: 'token', expiresIn: 120 }) };
    const tokens = new CommandTokenCache(source, () => 0);
    const client = { execute: jest.fn().mockRejectedValue(new IntentFlowCommandError('INTENTFLOW_COMMAND_UNAUTHORIZED')) };
    const service = new IntentFlowCommandExecutionService({ tokens, client });
    await expect(service.execute(5, 'go_home')).rejects.toMatchObject({ code: 'INTENTFLOW_COMMAND_UNAUTHORIZED' });
    expect(client.execute).toHaveBeenCalledTimes(1);
    await expect(service.execute(5, 'go_home')).rejects.toMatchObject({ code: 'INTENTFLOW_COMMAND_UNAUTHORIZED' });
    expect(client.execute).toHaveBeenCalledTimes(2);
    expect(source.requestCommandToken).toHaveBeenCalledTimes(2);
  });

  it('stops after a second 401 during the one allowed cached-token retry', async () => {
    const source = { requestCommandToken: jest.fn()
      .mockResolvedValueOnce({ token: 'old', expiresIn: 120 })
      .mockResolvedValueOnce({ token: 'new', expiresIn: 120 }) };
    const tokens = new CommandTokenCache(source, () => 0);
    await tokens.getToken();
    const client = { execute: jest.fn().mockRejectedValue(new IntentFlowCommandError('INTENTFLOW_COMMAND_UNAUTHORIZED')) };
    await expect(new IntentFlowCommandExecutionService({ tokens, client }).execute(5, 'go_home'))
      .rejects.toMatchObject({ code: 'INTENTFLOW_COMMAND_UNAUTHORIZED' });
    expect(client.execute).toHaveBeenCalledTimes(2);
    expect(source.requestCommandToken).toHaveBeenCalledTimes(2);
  });

  it.each(['INTENTFLOW_COMMAND_DEVICE_UNAVAILABLE', 'INTENTFLOW_COMMAND_FORBIDDEN', 'INTENTFLOW_COMMAND_CONFIRMATION_REQUIRED',
    'INTENTFLOW_COMMAND_EXECUTION_FAILED'] as const)('never retries functional failure %s', async (code) => {
    const source = { requestCommandToken: jest.fn().mockResolvedValue({ token: 'cached', expiresIn: 120 }) };
    const tokens = new CommandTokenCache(source, () => 0);
    await tokens.getToken();
    const client = { execute: jest.fn().mockRejectedValue(new IntentFlowCommandError(code)) };
    await expect(new IntentFlowCommandExecutionService({ tokens, client }).execute(5, 'go_home'))
      .rejects.toMatchObject({ code });
    expect(client.execute).toHaveBeenCalledTimes(1);
    expect(source.requestCommandToken).toHaveBeenCalledTimes(1);
  });
});
