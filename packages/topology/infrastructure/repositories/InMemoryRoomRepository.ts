import { Room } from '../../domain/types';
import { RoomRepository } from '../../domain/repositories/RoomRepository';

/**
 * Adaptador de Infraestructura: Almacenamiento efímero en memoria para Room.
 * Implementa el Puerto de Salida aislando las pruebas de bases de datos reales.
 */
export class InMemoryRoomRepository implements RoomRepository {
  private readonly store: Map<string, Room> = new Map();

  async saveRoom(room: Room): Promise<void> {
    this.store.set(room.id, Object.freeze({ ...room }));
    return Promise.resolve();
  }

  async findRoomsByHomeId(homeId: string): Promise<ReadonlyArray<Room>> {
    const results: Room[] = [];
    for (const room of this.store.values()) {
      if (room.homeId === homeId) {
        results.push(room);
      }
    }
    return Promise.resolve(Object.freeze(results));
  }

  async findRoomById(roomId: string): Promise<Room | null> {
    const room = this.store.get(roomId);
    return Promise.resolve(room ? Object.freeze({ ...room }) : null);
  }

  /**
   * Limpia el estado interno de la memoria temporal.
   */
  clear(): void {
    this.store.clear();
  }
}
