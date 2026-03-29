/**
 * Interfaces y contratos agnósticos compartidos inter-módulos.
 * Provee inyección de dependencias puras (como Generación de IDs y Reloj de sistema)
 * evitando el acoplamiento a Node.js en las capas de negocio de todos los Bounded Contexts.
 */

export interface IdGenerator {
  generate(): string;
}

export interface Clock {
  now(): string;
}
