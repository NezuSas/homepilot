import { Home, HomeRepository } from '../domain';
import { InvalidContextError } from './errors';

/**
 * Dependencias inyectadas para listar estructuradamente los hogares correspondientes al usuario.
 */
export interface ListHomesUseCaseDependencies {
  readonly homeRepository: HomeRepository;
}

/**
 * Orquesta la consulta limpia y filtrada de los hogares por tenante específico.
 * Lanza un error de contexto explícito si los parámetros de la petición son nulos.
 */
export async function listHomesUseCase(
  userId: string,
  dependencies: ListHomesUseCaseDependencies
): Promise<ReadonlyArray<Home>> {
  if (!userId || userId.trim() === '') {
    throw new InvalidContextError('User ID is required to list homes.');
  }
  
  return dependencies.homeRepository.findHomesByUserId(userId);
}
