import { AssistantQuickResponseService } from '../application/AssistantQuickResponseService';

describe('AssistantQuickResponseService', () => {
  it('formats a Spanish greeting with residential tone and user name', () => {
    const response = AssistantQuickResponseService.format('greeting', 'es', 'Oscar');

    expect(response.type).toBe('answer');
    expect(response.message).toContain('Oscar');
    expect(response.message).toContain('La casa está atenta');
  });

  it('formats wellness without pretending to execute an action', () => {
    const response = AssistantQuickResponseService.format('wellness', 'es');

    expect(response.type).toBe('answer');
    expect(response.message).toContain('Operando con normalidad');
    expect(response.message).not.toContain('he encendido');
  });
});
