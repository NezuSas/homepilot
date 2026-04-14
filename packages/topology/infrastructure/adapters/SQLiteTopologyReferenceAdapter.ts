import { TopologyReferencePort } from '../../../devices/application/ports/TopologyReferencePort';
import { HomeRepository } from '../../domain/repositories/HomeRepository';
import { RoomRepository } from '../../domain/repositories/RoomRepository';

export class SQLiteTopologyReferenceAdapter implements TopologyReferencePort {
  constructor(
    private readonly homeRepository: HomeRepository,
    private readonly roomRepository: RoomRepository
  ) {}

  public async validateHomeExists(homeId: string): Promise<void> {
    const home = await this.homeRepository.findHomeById(homeId);
    if (!home) throw new Error('HOME_NOT_FOUND');
  }

  public async validateHomeOwnership(homeId: string, userId: string): Promise<void> {
    // Basic existence for now, can be extended with ownership logic if needed
    const home = await this.homeRepository.findHomeById(homeId);
    if (!home) throw new Error('HOME_NOT_FOUND');
  }

  public async validateRoomBelongsToHome(roomId: string, expectedHomeId: string): Promise<void> {
    const room = await this.roomRepository.findRoomById(roomId);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    if (room.homeId !== expectedHomeId) throw new Error('ROOM_HOME_MISMATCH');
  }
}
