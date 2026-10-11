import { normalizeAssistantPrompt } from '../application/AssistantPromptNormalizer';

describe('normalizeAssistantPrompt', () => {
  it('normalizes common short Spanish phrasing without requiring punctuation', () => {
    expect(normalizeAssistantPrompt('Q hora es')).toBe('que hora es');
    expect(normalizeAssistantPrompt('prepara la casa pa dormir')).toBe('prepara la casa para dormir');
  });

  it('preserves the existing polite-wrapper normalization for natural requests', () => {
    expect(normalizeAssistantPrompt('HomePilot, porfa que luces están encendidas?')).toBe('que luces estan encendidas');
  });

  it('maps raise and lower to open and close only for curtains', () => {
    expect(normalizeAssistantPrompt('sube la cortina de la sala')).toBe('abre la cortina de la sala');
    expect(normalizeAssistantPrompt('baja las cortinas del cuarto master')).toBe('cierra la cortina del cuarto master');
    expect(normalizeAssistantPrompt('baja la luz de la sala')).toBe('baja la luz de la sala');
  });

  it('accepts the voseo form of enciende', () => {
    expect(normalizeAssistantPrompt('encendé la luz de la sala')).toBe('enciende la luz de la sala');
  });

  it('normalizes common speech-recognition variants for curtain commands', () => {
    expect(normalizeAssistantPrompt('sierra cortina cuarto master')).toBe('cierra cortina cuarto master');
    expect(normalizeAssistantPrompt('sierras las cortinas del cuarto master')).toBe('cierra las cortina del cuarto master');
  });
});