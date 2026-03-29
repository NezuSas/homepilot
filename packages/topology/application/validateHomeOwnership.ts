import { Home, HomeRepository } from '../domain';
import { NotFoundError, ForbiddenError } from './errors';

/**
 * Función pura de aplicación para validar centralmente la propiedad 
 * (ownership) de un usuario sobre un Hogar.
 * 
 * @param homeId ID del hogar a verificar para la transacción.
 * @param userId ID del usuario activo emitido en la petición original.
 * @param homeRepository Puerto inyectado para consulta en persistencia.
 * @returns La entidad Home inmutable recuperada si la autorización es exitosa.
 * @throws NotFoundError Si el hogar referenciado no existe localmente (404-bound).
 * @throws ForbiddenError Si el hogar existe pero no es propiedad del usuario (403-bound).
 */
export async function validateHomeOwnership(
  homeId: string,
  userId: string,
  homeRepository: HomeRepository
): Promise<Home> {
  const home = await homeRepository.findHomeById(homeId);
  
  if (!home) {
    throw new NotFoundError('Home', homeId);
  }

  if (home.ownerId !== userId) {
    throw new ForbiddenError();
  }

  return home;
}
