import type { Room } from '../../../topology/domain/types';

export interface AssistantRoomManagementPort {
  createRoom(input: {
    readonly userId: string;
    readonly name: string;
    readonly correlationId: string;
  }): Promise<Room>;
}
