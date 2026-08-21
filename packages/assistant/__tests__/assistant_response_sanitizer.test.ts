import { sanitizeAssistantResponse } from '../application/AssistantResponseSanitizer';

describe('sanitizeAssistantResponse', () => {
  it('removes emojis and keeps a concise answer', () => {
    const response = sanitizeAssistantResponse('Listo ✅. Apagué la luz. Todo quedó correcto. Información extra. Quinta frase innecesaria.');

    expect(response).toBe('Listo. Apagué la luz. Todo quedó correcto. Información extra.');
    expect(response).not.toContain('✅');
  });

  it('preserves operational response rows', () => {
    const response = sanitizeAssistantResponse('Oscar, Así está Cuarto Master ahora:\n• Encendidos (1): Dicroicos Trabajo.\n• Apagados (6): Dicroicos Cama, Led Cama y 4 más.');

    expect(response).toBe('Oscar, Así está Cuarto Master ahora:\n• Encendidos (1): Dicroicos Trabajo.\n• Apagados (6): Dicroicos Cama, Led Cama y 4 más.');
  });

  it('limits excessively long responses without splitting the final word', () => {
    const response = sanitizeAssistantResponse(`Resultado: ${'operación '.repeat(80)}`);

    expect(response.length).toBeLessThanOrEqual(420);
    expect(response.endsWith('…')).toBe(true);
  });
});
