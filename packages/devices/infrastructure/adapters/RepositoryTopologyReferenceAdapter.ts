import { ForbiddenOwnershipError, TopologyResourceNotFoundError } from '../../application/errors';
import type { TopologyReferencePort } from '../../application/ports/TopologyReferencePort';
import type { HomeRepository } from '../../../topology/domain/repositories/HomeRepository';
import type { RoomRepository } from '../../../topology/domain/repositories/RoomRepository';

/**
 * Adaptador de infraestructura que resuelve las referencias de Topología
 * requeridas por los casos de uso de Devices.
 */
export class RepositoryTopologyReferenceAdapter implements TopologyReferencePort {
  constructor(
    private readonly homeRepository: HomeRepository,
    private readonly roomRepository: RoomRepository,
  ) {}

  async validateHomeExists(homeId: string): Promise<void> {
    const home = await this.homeRepository.findHomeById(homeId);
    if (!home) throw new TopologyResourceNotFoundError('Home', homeId);
  }

  async validateHomeOwnership(homeId: string, userId: string): Promise<void> {
    const home = await this.homeRepository.findHomeById(homeId);
    if (!home) throw new TopologyResourceNotFoundError('Home', homeId);
    if (home.ownerId !== userId) {
      throw new ForbiddenOwnershipError(`Forbidden access to home ${homeId}`);
    }
  }

  async validateRoomBelongsToHome(roomId: string, expectedHomeId: string): Promise<void> {
    const room = await this.roomRepository.findRoomById(roomId);
    if (!room) throw new TopologyResourceNotFoundError('Room', roomId);
    if (room.homeId !== expectedHomeId) {
      throw new ForbiddenOwnershipError(`Room ${roomId} does not belong to home ${expectedHomeId}`);
    }
  }
}