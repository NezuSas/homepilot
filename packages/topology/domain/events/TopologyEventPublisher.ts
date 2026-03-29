import { TopologyDomainEvent } from './types';

/**
 * Puerto de salida (Outbound Port) para la publicación de eventos del dominio.
 * Desacopla la orquestación central de cualquier Message Broker real instanciado,
 * delegando únicamente subconjuntos admitidos (TopologyDomainEvent).
 */
export interface TopologyEventPublisher {
  /**
   * Publica un evento de dominio cerrado de manera asíncrona.
   * 
   * @param event El evento inmutable acotado tipificado.
   */
  publish(event: TopologyDomainEvent): Promise<void>;
}
