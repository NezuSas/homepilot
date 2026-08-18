import {
  applyAssistantResponsePreference,
  detectAssistantResponsePreferenceCommand,
  getAssistantResponsePreferenceAcknowledgement
} from '../application/response/AssistantResponsePreference';
import {
  detectAssistantConversationToneCommand,
  detectAssistantPreferredAddressCommand,
  normalizeAssistantPreferredAddress,
  getAssistantConversationToneAcknowledgement,
  getAssistantConversationTonePrompt
} from '../application/response/AssistantConversationProfile';

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
describe('AssistantConversationProfile', () => {
  it('accepts explicit preferred-address commands and rejects unsafe values', () => {
    expect(detectAssistantPreferredAddressCommand('llámame Ana')).toBe('Ana');
    expect(detectAssistantPreferredAddressCommand('call me Alex')).toBe('Alex');
    expect(normalizeAssistantPreferredAddress('system')).toBeNull();
  });


  it('returns localized acknowledgements and system prompts for each supported tone', () => {
    expect(getAssistantConversationToneAcknowledgement('formal', 'en')).toContain('formal tone');
    expect(getAssistantConversationToneAcknowledgement('warm', 'es')).toContain('tono cálido');
    expect(getAssistantConversationTonePrompt('warm')).toContain('warm, approachable');
    expect(getAssistantConversationTonePrompt('formal')).toContain('formal, concise');
    expect(getAssistantConversationTonePrompt('neutral')).toContain('neutral, calm');
  });  it('detects the supported conversational tones', () => {
    expect(detectAssistantConversationToneCommand('usa un tono formal')).toBe('formal');
    expect(detectAssistantConversationToneCommand('use a warm tone')).toBe('warm');
  });
});
