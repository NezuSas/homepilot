export interface FailureInsight {
  userMessage: string;
  technicalMessage: string;
  severity: "info" | "warning" | "critical";
  suggestedAction: string;
}

export class FailureInsightService {
  /**
   * Interprets a technical error and returns a human-readable FailureInsight.
   * Uses predefined mappings for common errors to improve UX.
   */
  public static interpretExecutionError(error: string, context?: Record<string, unknown>): FailureInsight {
    const errLower = error.toLowerCase();

    // 1. Home Assistant connection issues
    if (errLower.includes('ha_service_call_failed') || errLower.includes('home assistant no configurada')) {
      return {
        userMessage: 'No se pudo conectar con Home Assistant.',
        technicalMessage: error,
        severity: 'critical',
        suggestedAction: 'Verifica que Home Assistant esté encendido, accesible en la red y que el token siga siendo válido.'
      };
    }

    // 2. Timeout issues
    if (errLower.includes('timeout') || errLower.includes('timed out') || errLower.includes('aborterror')) {
      return {
        userMessage: 'El dispositivo no respondió a tiempo.',
        technicalMessage: error,
        severity: 'warning',
        suggestedAction: 'Revisa si el dispositivo tiene energía, buena conexión de red o si está fuera de alcance.'
      };
    }

    // 3. Device not found issues
    if (errLower.includes('not found') || errLower.includes('dispositivo no encontrado')) {
      return {
        userMessage: 'El dispositivo ya no está disponible.',
        technicalMessage: error,
        severity: 'critical',
        suggestedAction: 'Revisa si fue eliminado, renombrado o si perdió la conexión con la integración.'
      };
    }

    // 4. Capability / Not supported issues
    if (errLower.includes('no soportado') || errLower.includes('capability')) {
      return {
        userMessage: 'Este dispositivo no soporta la acción solicitada.',
        technicalMessage: error,
        severity: 'warning',
        suggestedAction: 'Verifica el tipo de dispositivo, sus capacidades o la acción configurada.'
      };
    }

    // 5. Fallback for unknown errors
    return {
      userMessage: 'La acción falló por un error no reconocido.',
      technicalMessage: error,
      severity: 'warning',
      suggestedAction: 'Revisa el detalle técnico o intenta ejecutar nuevamente.'
    };
  }
}
