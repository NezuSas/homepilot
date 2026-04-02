import { Room } from '../types';

/**
 * Puerto de Salida (Outbound Port) que abstrae el almacenamiento de entidades Room.
 * Usado por los Casos de Uso para interactuar con la infraestructura
 * subyacente de forma puramente agnóstica.
 */
export interface RoomRepository {
  /**
   * Persiste una habitación nueva en la persistencia configurada.
   */
  saveRoom(room: Room): Promise<void>;

  /**
   * Retorna una lista inmutable de todas las habitaciones adscritas a un hogar específico.
   */
  findRoomsByHomeId(homeId: string): Promise<ReadonlyArray<Room>>;

  /**
   * Busca una habitación específica por su identificador único.
   * Retorna null si no existe.
   */
  findRoomById(roomId: string): Promise<Room | null>;
}
