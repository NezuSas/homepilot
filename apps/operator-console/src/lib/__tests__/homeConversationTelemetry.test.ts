/// <reference types="jest" />
import { recordHomeConversationTelemetry } from '../homeConversationTelemetry';

describe('homeConversationTelemetry', () => {
  it('emits structured telemetry without throwing', () => {
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    recordHomeConversationTelemetry('global_wake_processed', {
      elapsedMs: 120,
      responseType: 'answer'
    });

    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('[HOME_CONVERSATION_TELEMETRY]'));
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('"elapsedMs":120'));

    infoSpy.mockRestore();
  });
});
