import {
  applyAssistantResponsePreference,
  detectAssistantResponsePreferenceCommand,
  getAssistantResponsePreferenceAcknowledgement
} from '../application/response/AssistantResponsePreference';

describe('AssistantResponsePreference', () => {
  it('detects explicit response-style requests in Spanish and English', () => {
    expect(detectAssistantResponsePreferenceCommand('respóndeme breve, por favor')).toBe('concise');
    expect(detectAssistantResponsePreferenceCommand('give me more detail')).toBe('detailed');
    expect(detectAssistantResponsePreferenceCommand('respuesta normal')).toBe('standard');
  });

  it('keeps preference acknowledgements in the selected language', () => {
    expect(getAssistantResponsePreferenceAcknowledgement('concise', 'es')).toBe(
      'Entendido. Responderé de forma breve.'
    );
    expect(getAssistantResponsePreferenceAcknowledgement('detailed', 'en')).toBe(
      'Understood. I will include more detail when useful.'
    );
  });

  it('only composes informational responses after their content is known', () => {
    expect(
      applyAssistantResponsePreference(
        'Luces encendidas. Hay dos activas.',
        'concise',
        'es'
      )
    ).toBe('Luces encendidas.');
    expect(
      applyAssistantResponsePreference(
        'There are two lights on.',
        'detailed',
        'en'
      )
    ).toBe('There are two lights on. I can expand on any part if useful.');
  });
});