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

  public static format(input: JarvisResponseStyle, options?: FormatterOptions): string {
    const name = input.userName?.trim() || 'Señor';
    const idx = options?.variantIndex;

    switch (input.status) {
      case 'success': {
        const verbs: Record<string, string> = {
          turn_on: 'encendido',
          turn_off: 'apagado',
          open: 'abierto',
          close: 'cerrado',
          toggle: 'ajustado',
          stop: 'detenido',
          set_position: 'ajustado'
        };
        const actionVerb = input.action && verbs[input.action] ? verbs[input.action] : 'completado';
        const target = input.target || 'el dispositivo solicitado';
        return this.getTemplate([
          `Hecho, ${name}. ${target} ha sido ${actionVerb}.`,
          `Listo, ${name}. ${target} ahora está ${actionVerb}.`
        ], idx);
      }

      case 'not_found': {
        const searched = input.searched || 'ese objetivo';
        const suggestionsText = input.suggestions && input.suggestions.length > 0
          ? ` ¿Quizás se refiere a ${input.suggestions.slice(0, 3).join(' o ')}?`
          : ' ¿Desea indicarme la estancia correcta?';
        return `No tengo registrado ningún dispositivo o estancia con el nombre "${searched}", ${name}.${suggestionsText}`;
      }

      case 'failed': {
        const target = input.target || 'el dispositivo solicitado';
        const errorReason = input.reason === 'device_offline'
          ? 'no responde en la red local'
          : 'ha reportado un error interno';
        return `Lo lamento, ${name}. ${target} ${errorReason}. No he podido completar la acción.`;
      }

      case 'security_blocked':
        return input.reason === 'mass_action_requires_confirmation'
          ? `He bloqueado preventivamente una acción masiva, ${name}. Necesito que me confirme explícitamente si desea proceder.`
          : `Acción cancelada, ${name}. El sistema de seguridad de HomePilot ha restringido este comando.`;

      case 'clarification':
        if (input.suggestions && input.suggestions.length > 0) {
          return `He encontrado múltiples coincidencias, ${name}. ¿Se refiere a ${input.suggestions.join(' o ')}?`;
        }
        return `¿Podría ser más específico, ${name}? No estoy seguro de qué dispositivo desea controlar.`;

      case 'info':
        return `Entendido, ${name}. Actualmente el estado de ${input.target || 'la casa'} es el siguiente.`;

      default:
        return `Sistema listo, ${name}.`;
    }
  }
}
