import { Home, IdGenerator, Clock } from './types';
import { InvalidHomeNameError, InvalidUserIdError } from './errors';

/**
 * Dependencias requeridas para fabricar un Home, inyectadas para 
 * mantener el desacoplamiento de librerías nativas (ej. NodeJS crypto o Date global).
 */
export interface CreateHomeDependencies {
  readonly idGenerator: IdGenerator;
  readonly clock: Clock;
}

/**
 * Función de fábrica pura para inicializar entidades Home inmutables.
 * No muta estado externo, no interactúa con bases de datos ni lógicas acopladas.
 * 
 * @param name Nombre designado para el hogar.
 * @param userId Identificador del usuario creador (se convierte en ownerId).
 * @param dependencies Generadores de puridad temporal e ID encapsulados.
 * @returns Un objeto Home nuevo, inmutable y totalmente inicializado.
 */
export function createHome(
  name: string,
  userId: string,
  dependencies: CreateHomeDependencies
): Home {
  if (!name || name.trim() === '') {
    throw new InvalidHomeNameError();
  }

  if (!userId || userId.trim() === '') {
    throw new InvalidUserIdError();
  }

  const timestamp = dependencies.clock.now();

  return Object.freeze({
    id: dependencies.idGenerator.generate(),
    ownerId: userId.trim(),
    name: name.trim(),
    entityVersion: 1, // Versión inicial
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}
