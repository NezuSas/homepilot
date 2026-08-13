import { Home, HomeRepository } from '../domain';
import { NotFoundError, ForbiddenError } from './errors';

/**
 * Verifica que un hogar sea el hogar único de la instalación Edge. La sesión
 * ya fue autenticada por el perímetro; se falla cerrada si el id no coincide.
 */
export async function validateHomeOwnership(
  homeId: string,
  userId: string,
  homeRepository: HomeRepository
): Promise<Home> {
  const homes = await homeRepository.findHomesByUserId(userId);
  const home = homes[0];

  if (!home) throw new NotFoundError('Home', homeId);
  if (home.id !== homeId) throw new ForbiddenError();

  return home;
}