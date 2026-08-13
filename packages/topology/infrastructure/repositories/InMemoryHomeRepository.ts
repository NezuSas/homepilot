import { Home } from '../../domain/types';
import { HomeRepository } from '../../domain/repositories/HomeRepository';
import { SingleHomeInstallationError } from '../../domain/errors';

/**
 * Adaptador de Infraestructura: Almacenamiento efímero en memoria para Home.
 * Implementa el Puerto de Salida HomeRepository, diseñado para pruebas
 * unitarias garantizando un entorno determinista.
 */
export class InMemoryHomeRepository implements HomeRepository {
  // Diccionario interno mutable, oculto a los consumidores de esta clase
  private readonly store: Map<string, Home> = new Map();

  async saveHome(home: Home): Promise<void> {
    // Congelamos el clon (shallow freeze) para evitar mutaciones directas compartidas
    this.store.set(home.id, Object.freeze({ ...home }));
    return Promise.resolve();
  }

  async findHomesByUserId(userId: string): Promise<ReadonlyArray<Home>> {
    void userId;
    const homes = Array.from(this.store.values());
    if (homes.length > 1) throw new SingleHomeInstallationError();
    return Promise.resolve(Object.freeze(homes));
  }

  async findHomeById(homeId: string): Promise<Home | null> {
    const home = this.store.get(homeId);
    if (!home) {
      return Promise.resolve(null);
    }
    return Promise.resolve(home);
  }

  async findAll(): Promise<ReadonlyArray<Home>> {
    return Promise.resolve(Object.freeze(Array.from(this.store.values())));
  }

  /**
   * Limpia la base de datos temporal (utilidad técnica para teardown de Unit Tests).
   */
  clear(): void {
    this.store.clear();
  }
}
