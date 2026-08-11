/** Puerto de consulta de usuarios requerido por el estado de primera configuración. */
export interface SystemSetupUserRepository {
  count(): Promise<number>;
}