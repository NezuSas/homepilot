import { asksForSecondsDelay } from '../application/conversation/unsupportedQualifiers';
import { getAssistantResponseText } from '../application/response/AssistantResponseCatalog';

describe('asksForSecondsDelay', () => {
  it.each([
    'apaga sala 3 en 5 segundos',
    'enciende la luz de la cocina dentro de 10 segundos',
    'cierra la cortina en 30 segs',
    'turn off the lamp in 20 seconds',
    'open the curtain after 5 seconds',
  ])('flags "%s" because the delay would be dropped silently', (prompt) => {
    expect(asksForSecondsDelay(prompt)).toBe(true);
  });

  it.each([
    'apaga sala 3 en 5 minutos',
    'enciende la luz en media hora',
    'apaga sala 3',
    'cuantos segundos tiene un minuto',
    'que paso hace 5 segundos',
  ])('lets "%s" through', (prompt) => {
    expect(asksForSecondsDelay(prompt)).toBe(false);
  });
});

describe('seconds delay answer', () => {
  it('says nothing was run and offers a supported alternative in both languages', () => {
    expect(getAssistantResponseText('command.seconds_delay_unsupported', 'es', {})).toContain('No ejecuté nada');
    expect(getAssistantResponseText('command.seconds_delay_unsupported', 'en', {})).toContain("didn't run anything");
  });
});
