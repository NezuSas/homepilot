import { normalizeAssistantPrompt } from '../application/AssistantPromptNormalizer';

describe('normalizeAssistantPrompt', () => {
  it('normalizes common short Spanish phrasing without requiring punctuation', () => {
    expect(normalizeAssistantPrompt('Q hora es')).toBe('que hora es');
    expect(normalizeAssistantPrompt('prepara la casa pa dormir')).toBe('prepara la casa para dormir');
  });

  it('preserves the existing polite-wrapper normalization for natural requests', () => {
    expect(normalizeAssistantPrompt('HomePilot, porfa que luces están encendidas?')).toBe('que luces estan encendidas');
  });

  it('normalizes common speech-recognition variants for curtain commands', () => {
    expect(normalizeAssistantPrompt('sierra cortina cuarto master')).toBe('cierra cortina cuarto master');
    expect(normalizeAssistantPrompt('sierras las cortinas del cuarto master')).toBe('cierra las cortina del cuarto master');
  });
});