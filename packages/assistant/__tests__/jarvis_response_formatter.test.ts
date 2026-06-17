import { JarvisResponseFormatter, JarvisResponseStyle } from '../application/response/JarvisResponseFormatter';

describe('JarvisResponseFormatter', () => {
  it('formats deterministic success responses with the provided user name', () => {
    const style: JarvisResponseStyle = {
      status: 'success',
      action: 'turn_off',
      target: 'Cortina Principal',
      userName: 'Oscar'
    };

    const message = JarvisResponseFormatter.format(style, { variantIndex: 0 });

    expect(message).toBe('Hecho, Oscar. Cortina Principal ha sido apagado.');
  });

  it('uses a neutral courtesy fallback when userName is not present', () => {
    const style: JarvisResponseStyle = {
      status: 'success',
      action: 'turn_on',
      target: 'Luz Estudio'
    };

    const message = JarvisResponseFormatter.format(style, { variantIndex: 1 });

    expect(message).toBe('Listo, Señor. Luz Estudio ahora está encendido.');
  });

  it('formats mass action security blocks without claiming execution', () => {
    const message = JarvisResponseFormatter.format({
      status: 'security_blocked',
      reason: 'mass_action_requires_confirmation',
      userName: 'Oscar'
    });

    expect(message).toContain('bloqueado preventivamente');
    expect(message).toContain('Oscar');
    expect(message).toContain('confirme');
  });

  it('formats not found responses with known suggestions only', () => {
    const message = JarvisResponseFormatter.format({
      status: 'not_found',
      searched: 'territorio',
      suggestions: ['Sala'],
      userName: 'Oscar'
    });

    expect(message).toContain('"territorio"');
    expect(message).toContain('Sala');
    expect(message).toContain('Oscar');
  });
});
