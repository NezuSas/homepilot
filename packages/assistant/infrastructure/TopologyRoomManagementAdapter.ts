import { createRoomUseCase, type CreateRoomUseCaseDependencies } from '../../topology/application/createRoomUseCase';
import type { Room } from '../../topology/domain/types';
import type { AssistantRoomManagementPort } from '../application/ports/AssistantRoomManagementPort';

/**
 * Bridges a confirmed assistant request to the existing Topology room-creation
 * use case. The adapter resolves the caller's installed home instead of
 * accepting a client-controlled home identifier.
 */
export class TopologyRoomManagementAdapter implements AssistantRoomManagementPort {
  constructor(private readonly dependencies: CreateRoomUseCaseDependencies) {}

  async createRoom(input: {
    readonly userId: string;
    readonly name: string;
    readonly correlationId: string;
  }): Promise<Room> {
    const homes = await this.dependencies.homeRepository.findHomesByUserId(input.userId);
    const home = homes[0];

    if (!home) {
      throw new Error('ASSISTANT_HOME_NOT_FOUND');
    }

    return createRoomUseCase(
      input.name,
      home.id,
      input.userId,
      input.correlationId,
      this.dependencies
    );
  }
}
