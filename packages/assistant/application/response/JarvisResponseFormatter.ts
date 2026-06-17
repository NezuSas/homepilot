export type JarvisResponseStatus =
  | 'success'
  | 'failed'
  | 'not_found'
  | 'clarification'
  | 'security_blocked'
  | 'info';

export interface JarvisResponseStyle {
  status: JarvisResponseStatus;
  action?: string;
  target?: string;
  searched?: string;
  reason?: string;
  suggestions?: string[];
  userName?: string;
}

export interface FormatterOptions {
  variantIndex?: number;
}

export class JarvisResponseFormatter {
  private static getTemplate(templates: string[], index?: number): string {
    if (templates.length === 0) return '';
    if (index !== undefined) return templates[index % templates.length];
    return templates[0];
  }

  private static describeTarget(target?: string): string {
    const normalizedTarget = target?.trim();
    if (!normalizedTarget) return 'el objetivo solicitado';

    const lowerTarget = normalizedTarget.toLowerCase();
    if (lowerTarget === 'luz escritorio' || lowerTarget === 'luz del escritorio') {
      return 'la luz del escritorio';
    }

    if (lowerTarget.startsWith('luz ')) {
      const lightTarget = lowerTarget.replace(/^luz\s+/, '').trim();
      return lightTarget ? `la luz de ${lightTarget}` : 'la luz solicitada';
    }

    if (lowerTarget.startsWith('cortina ')) {
      return `la ${lowerTarget}`;
    }

    return normalizedTarget;
  }

  public static format(input: JarvisResponseStyle, options?: FormatterOptions): string {
    const name = input.userName?.trim() || 'Señor';
    const idx = options?.variantIndex;

    switch (input.status) {
      case 'success': {
        const actionCopy: Record<string, { action: string; state: string }> = {
          turn_on: { action: 'encendido', state: 'encendido' },
          turn_off: { action: 'apagado', state: 'apagado' },
          open: { action: 'abierto', state: 'abierto' },
          close: { action: 'cerrado', state: 'cerrado' },
          toggle: { action: 'ajustado', state: 'ajustado' },
          stop: { action: 'detenido', state: 'detenido' },
          set_position: { action: 'ajustado', state: 'ajustado' }
        };
        const copy = input.action && actionCopy[input.action]
          ? actionCopy[input.action]
          : { action: 'completado', state: 'bajo control' };
        const target = this.describeTarget(input.target);
        return this.getTemplate([
          `Por supuesto, ${name}. He ${copy.action} ${target}.`,
          `Listo, ${name}. ${target} queda ${copy.state}.`,
          `De inmediato, ${name}. ${target} está ${copy.state}.`
        ], idx);
      }

      case 'not_found': {
        const searched = input.searched || 'ese objetivo';
        const suggestionsText = input.suggestions && input.suggestions.length > 0
          ? ` ¿Quizás se refiere a ${input.suggestions.slice(0, 3).join(' o ')}?`
          : ' ¿Desea indicarme la estancia correcta?';
        return `No encuentro "${searched}" en el mapa de la casa, ${name}.${suggestionsText}`;
      }

      case 'failed': {
        const target = this.describeTarget(input.target);
        const errorReason = input.reason === 'device_offline'
          ? 'no responde en la red local'
          : 'no aceptó la orden';
        return `Lo lamento, ${name}. ${target} ${errorReason}. No confirmaré una acción que la casa no ejecutó.`;
      }

      case 'security_blocked':
        return input.reason === 'mass_action_requires_confirmation'
          ? `He detenido la orden por seguridad, ${name}. Es una acción amplia y necesito su confirmación antes de tocar la casa.`
          : `Acción contenida, ${name}. La seguridad residencial no permite ejecutar ese comando.`;

      case 'clarification':
        if (input.suggestions && input.suggestions.length > 0) {
          return `Tengo más de una posibilidad, ${name}. ¿Se refiere a ${input.suggestions.join(' o ')}?`;
        }
        return `Necesito una precisión más, ${name}. Dígame el dispositivo y la estancia para actuar sin margen de error.`;

      case 'info':
        return `Entendido, ${name}. Le presento el estado actual de ${input.target || 'la casa'}.`;

      default:
        return `Sistema residencial listo, ${name}.`;
    }
  }
}
