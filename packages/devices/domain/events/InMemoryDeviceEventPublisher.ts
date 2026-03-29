import { DeviceEventPublisher } from './DeviceEventPublisher';
import { DeviceDomainEvent } from './types';

/**
 * Adaptador de publicación en memoria para pruebas e inyección local (Zero-DB).
 */
export class InMemoryDeviceEventPublisher implements DeviceEventPublisher {
  private events: DeviceDomainEvent[] = [];

  /**
   * Registra el evento de dominio.
   * Aplica un Object.freeze compuesto: congela explícitamente el Payload anidado y luego la cascara superior del evento. (Inmutabilidad Simple Clara).
   */
  async publish(event: DeviceDomainEvent): Promise<void> {
    const frozenPayload = Object.freeze({ ...event.payload }) as typeof event.payload;
    const frozenEvent = Object.freeze({ 
      ...event, 
      payload: frozenPayload 
    }) as DeviceDomainEvent;
    
    this.events.push(frozenEvent);
  }

  /**
   * Retorna el historial emitido encapsulado estrictamente como interfaz de sólo lectura estática.
   */
  getEvents(): ReadonlyArray<DeviceDomainEvent> {
    return this.events;
  }

  /**
   * Purga el buffer persistido aislando los ciclos de pruebas unitarias o transacciones integradas.
   */
  clear(): void {
    this.events = [];
  }
}
