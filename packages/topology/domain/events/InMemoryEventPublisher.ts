import { TopologyDomainEvent } from './types';
import { TopologyEventPublisher } from './TopologyEventPublisher';

/**
 * Implementación en memoria del publicador de eventos.
 * Diseñada exclusivamente para pruebas unitarias (Testing) garantizando
 * aislamiento estricto al listado cerrado de eventos válidos del sistema.
 */
export class InMemoryEventPublisher implements TopologyEventPublisher {
  private readonly publishedEvents: TopologyDomainEvent[] = [];

  /**
   * Guarda el evento cerrado validando su inmutabilidad sincrónica.
   */
  async publish(event: TopologyDomainEvent): Promise<void> {
    // Congelamos el clon shallow para garantizar aserciones inmutables
    this.publishedEvents.push(Object.freeze({ ...event }));
    return Promise.resolve();
  }

  /**
   * Consulta limpia de todos los eventos publicados.
   * Útil para contrastar payloads emitidos post-transacción.
   * 
   * @returns Un array explícito de eventos topológicos.
   */
  getEvents(): ReadonlyArray<TopologyDomainEvent> {
    return this.publishedEvents;
  }

  /**
   * Limpia el registro interno de eventos publicados.
   */
  clear(): void {
    this.publishedEvents.length = 0;
  }
}
