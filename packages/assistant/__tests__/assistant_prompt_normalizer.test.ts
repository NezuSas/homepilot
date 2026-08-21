import { normalizeAssistantPrompt } from '../application/AssistantPromptNormalizer';

describe('normalizeAssistantPrompt', () => {
  it('normalizes common short Spanish phrasing without requiring punctuation', () => {
    expect(normalizeAssistantPrompt('Q hora es')).toBe('que hora es');
    expect(normalizeAssistantPrompt('prepara la casa pa dormir')).toBe('prepara la casa para dormir');
  });

  it('preserves the existing polite-wrapper normalization for natural requests', () => {
    expect(normalizeAssistantPrompt('HomePilot, porfa que luces están encendidas?')).toBe('que luces estan encendidas');
  });
});