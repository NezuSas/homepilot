/**
 * Estado mínimo de Home Assistant que necesita la reconciliación local.
 * El contrato pertenece a la aplicación para que no dependa del cliente HTTP.
 */
export interface HomeAssistantReconciliationState {
  readonly entity_id: string;
  readonly state: string | null;
  readonly attributes: Record<string, unknown>;
}

/** Puerto de salida para consultar el estado completo de Home Assistant. */
export interface HomeAssistantStateReader {
  getAllStates(): Promise<readonly HomeAssistantReconciliationState[]>;
}