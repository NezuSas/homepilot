/**
 * Interfaz que representa un hogar (contenedor lógico principal).
 * Garantiza el aislamiento transaccional del usuario (ownerId).
 */
export interface Home {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly entityVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Interfaz que representa una habitación física o lógica dentro de un hogar.
 * No contiene ownerId directo; su propiedad se delega validando el homeId padre.
 */
export interface Room {
  readonly id: string;
  readonly homeId: string;
  readonly name: string;
  readonly entityVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Dependencias externas inyectadas requeridas por las factorías del dominio
 * para mantener la pureza y aislar la generación de identificadores.
 */
export interface IdGenerator {
  generate(): string;
}

/**
 * Dependencias externas inyectadas requeridas por las factorías del dominio
 * para aislar la generación de tiempos (timestamps).
 */
export interface Clock {
  now(): string;
}
