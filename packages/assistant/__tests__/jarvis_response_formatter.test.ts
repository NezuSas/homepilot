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

    expect(message).toBe('Por supuesto, Oscar. He apagado la cortina principal.');
  });

  it('uses a neutral courtesy fallback when userName is not present', () => {
    const style: JarvisResponseStyle = {
      status: 'success',
      action: 'turn_on',
      target: 'Luz Estudio'
    };

    const message = JarvisResponseFormatter.format(style, { variantIndex: 1 });

    expect(message).toBe('Listo, Señor. la luz de estudio queda encendida.');
  });

  it('formats mass action security blocks without claiming execution', () => {
    const message = JarvisResponseFormatter.format({
      status: 'security_blocked',
      reason: 'mass_action_requires_confirmation',
      userName: 'Oscar'
    });

    expect(message).toContain('detenido la orden');
    expect(message).toContain('Oscar');
    expect(message).toContain('confirmación');
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

  it('formats a desk light command with a more residential assistant tone', () => {
    const message = JarvisResponseFormatter.format({
      status: 'success',
      action: 'turn_on',
      target: 'Luz escritorio',
      userName: 'Oscar'
    });

    expect(message).toBe('Por supuesto, Oscar. He encendido la luz del escritorio.');
  });
  it('formats every supported action with target grammar and deterministic variants', () => {
    expect(JarvisResponseFormatter.format({ status: 'success', action: 'open', target: 'Cortina Sala', userName: 'Ana' }, { variantIndex: 1 })).toBe('Listo, Ana. la cortina sala queda abierta.');
    expect(JarvisResponseFormatter.format({ status: 'success', action: 'close', target: 'Cortina Sala', userName: 'Ana' }, { variantIndex: 2 })).toBe('De inmediato, Ana. la cortina sala está cerrada.');
    expect(JarvisResponseFormatter.format({ status: 'success', action: 'toggle', target: 'Luz Cocina', userName: 'Ana' })).toContain('la luz de cocina');
    expect(JarvisResponseFormatter.format({ status: 'success', action: 'stop', target: 'Cortina Sala', userName: 'Ana' }, { variantIndex: 1 })).toContain('detenida');
    expect(JarvisResponseFormatter.format({ status: 'success', action: 'set_position', target: 'Cortina Sala', userName: 'Ana' }, { variantIndex: 1 })).toContain('ajustada');
  });

  it('uses safe fallback messages for missing targets, unknown actions, and every non-success status', () => {
    expect(JarvisResponseFormatter.format({ status: 'success', action: 'unknown', userName: '  ' })).toContain('Señor');
    expect(JarvisResponseFormatter.format({ status: 'failed', target: 'Luz Patio', reason: 'device_offline', userName: 'Oscar' })).toContain('no responde en la red local');
    expect(JarvisResponseFormatter.format({ status: 'failed', target: 'Luz Patio', userName: 'Oscar' })).toContain('no aceptó la orden');
    expect(JarvisResponseFormatter.format({ status: 'security_blocked', userName: 'Oscar' })).toContain('Acción contenida');
    expect(JarvisResponseFormatter.format({ status: 'clarification', suggestions: ['Sala', 'Cocina'], userName: 'Oscar' })).toContain('Sala o Cocina');
    expect(JarvisResponseFormatter.format({ status: 'clarification', userName: 'Oscar' })).toContain('Necesito una precisión');
    expect(JarvisResponseFormatter.format({ status: 'info', userName: 'Oscar' })).toContain('la casa');
  });
});