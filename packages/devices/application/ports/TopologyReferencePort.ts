/**
 * Interfaz de inyección perimetral (Hexagonal Port) para comunicarse con el
 * Bounded Context de Topología sin acoplar dependencias directas de módulos físicos.
 */
export interface TopologyReferencePort {
  /**
   * Valida estáticamente si un hogar existe en la base de datos maestra.
   * Utilizado por integraciones M2M donde el ownership de usuario no aplica en la ingesta.
   * Lanza un error asíncrono (NotFound) si el hogar no es rastreable.
   */
  validateHomeExists(homeId: string): Promise<void>;

  /**
   * Valida si un hogar existe y pertenece explícitamente al usuario emisor.
   * Lanza un error asíncrono en caso de fallo nulo o violación de pertenencia (Forbidden).
   */
  validateHomeOwnership(homeId: string, userId: string): Promise<void>;

  /**
   * Valida si una habitación específica existe, asegurando rigurosamente que
   * esté formalmente contenida dentro del hogar matriz dictado por `expectedHomeId`.
   * Lanza un error asíncrono en caso de orfandad o cruces ilegales entre hogares.
   */
  validateRoomBelongsToHome(roomId: string, expectedHomeId: string): Promise<void>;
}
