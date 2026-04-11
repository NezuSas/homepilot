import { DateTime } from 'luxon';

/**
 * Utilidades de tiempo para manejar conversiones de zona horaria de forma determinista.
 */
export const TimeUtils = {
  /**
   * Convierte una hora local (HH:mm) en una zona horaria específica a su equivalente en UTC (HH:mm).
   * La conversión se basa en el día actual para manejar correctamente el horario de verano (DST).
   */
  convertLocalToUTC(timeLocal: string, timezone: string): string {
    const [hours, minutes] = timeLocal.split(':').map(Number);
    
    // 1. Tomar el momento actual en la zona horaria del usuario
    const localDateTime = DateTime.now().setZone(timezone).set({
      hour: hours,
      minute: minutes,
      second: 0,
      millisecond: 0
    });

    if (!localDateTime.isValid) {
      throw new Error(`Hora o zona horaria inválida: ${timeLocal} (${timezone})`);
    }

    // 2. Convertir a UTC y extraer la hora
    const utcDateTime = localDateTime.toUTC();
    
    return utcDateTime.toFormat('HH:mm');
  },

  /**
   * Detecta la zona horaria local del entorno de ejecución (Navegador).
   */
  detectBrowserTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }
};
