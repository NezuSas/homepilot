import { Home } from '../types';

/**
 * Puerto de Salida (Outbound Port) que abstrae el almacenamiento de entidades Home.
 * La capa de Aplicación (Casos de Uso) utiliza esta abstracción para persistir
 * y recuperar datos sin acoplarse a tecnologías específicas (DB).
 */
export interface HomeRepository {
  /**
   * Persiste un nuevo objeto Home o actualiza uno existente.
   * Las excepciones lógicas se manejan en etapas previas; cualquier error aquí
   * corresponde a fallos transaccionales o de infraestructura (E.g I/O Error).
   */
  saveHome(home: Home): Promise<void>;

  /**
   * Recupera todos los hogares que pertenezcan explícitamente a un usuario.
   */
  findHomesByUserId(userId: string): Promise<ReadonlyArray<Home>>;

  /**
   * Intenta localizar un hogar por su identificador único.
   * Retorna null si el ID no existe en la capa de persistencia.
   */
  findHomeById(homeId: string): Promise<Home | null>;
}
