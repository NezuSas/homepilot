import { createRoomUseCase, type CreateRoomUseCaseDependencies } from '../../topology/application/createRoomUseCase';
import { deleteRoomUseCase } from '../../topology/application/deleteRoomUseCase';
import { renameRoomUseCase } from '../../topology/application/renameRoomUseCase';
import type { Room } from '../../topology/domain/types';
import type { AssistantRoomManagementPort } from '../application/ports/AssistantRoomManagementPort';

/**
 * Bridges confirmed assistant room requests to authorized Topology use cases.
 * It never accepts a browser-controlled home identifier.
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

    return createRoomUseCase(input.name, home.id, input.userId, input.correlationId, this.dependencies);
  }

  async renameRoom(input: {
    readonly userId: string;
    readonly roomId: string;
    readonly name: string;
    readonly correlationId: string;
  }): Promise<Room> {
    return renameRoomUseCase(input.roomId, input.name, input.userId, input.correlationId, this.dependencies);
  }

  async deleteRoom(input: {
    readonly userId: string;
    readonly roomId: string;
  }): Promise<{ readonly room: Room; readonly unassignedDevices: number }> {
    return deleteRoomUseCase(input.roomId, input.userId, this.dependencies);
  }
}