/**
 * Lógica funcional para la gestión de estados de dispositivos inteligentes (V1).
 * Implementa comparaciones deterministas limitadas a objetos planos por contrato.
 */

/**
 * Compara si dos estados son estructuralmente idénticos para evitar re-emisiones de eventos
 * y escrituras innecesarias en base de datos.
 * 
 * REGLA V1: Solo soporta objetos planos de un nivel.
 */
export function isStateIdentical(
  oldState: Record<string, unknown> | null,
  newState: Record<string, unknown> | null
): boolean {
  // 1. Manejo de nulidad base
  if (oldState === newState) return true;
  if (!oldState || !newState) return false;

  const oldKeys = Object.keys(oldState);
  const newKeys = Object.keys(newState);

  // 2. Diferencia en cardinalidad de atributos
  if (oldKeys.length !== newKeys.length) return false;

  // 3. Comparación de valores para objetos planos (estricta)
  for (const key of oldKeys) {
    if (oldState[key] !== newState[key]) {
      return false;
    }
  }

  return true;
}
