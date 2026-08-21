import type { Room } from '../../../topology/domain/types';

export interface AssistantRoomManagementPort {
  createRoom(input: {
    readonly userId: string;
    readonly name: string;
    readonly correlationId: string;
  }): Promise<Room>;
  renameRoom(input: {
    readonly userId: string;
    readonly roomId: string;
    readonly name: string;
    readonly correlationId: string;
  }): Promise<Room>;
  deleteRoom(input: {
    readonly userId: string;
    readonly roomId: string;
  }): Promise<{
    readonly room: Room;
    readonly unassignedDevices: number;
  }>;
}