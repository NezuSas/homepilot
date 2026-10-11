import { DeviceRepository } from '../../../devices/domain/repositories/DeviceRepository';
import { RoomRepository } from '../../../topology/domain/repositories/RoomRepository';
import { HomeRepository } from '../../../topology/domain/repositories/HomeRepository';
import { Device } from '../../../devices/domain/types';
import { Room } from '../../../topology/domain/types';

/** Inventario de dispositivos y cuartos al que un usuario tiene acceso. */
export interface AuthorizedScope {
  getAuthorizedDevices(userId?: string): Promise<Device[]>;
  getAuthorizedRooms(userId?: string): Promise<Room[]>;
}

/** Resuelve el inventario por hogar mediante los puertos de repositorio inyectados. */
export class RepositoryAuthorizedScope implements AuthorizedScope {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly roomRepository: RoomRepository,
    private readonly homeRepository?: HomeRepository
  ) {}

  /** Home-scoped device list. Falls back to the unrestricted list only when no homeRepository is configured. */
  public async getAuthorizedDevices(userId?: string): Promise<Device[]> {
    if (!this.homeRepository || !userId) return Array.from(await this.deviceRepository.findAll());
    const homes = await this.homeRepository.findHomesByUserId(userId);
    if (homes.length === 0) return [];
    const perHome = await Promise.all(homes.map((home) => this.deviceRepository.findAllByHomeId(home.id)));
    return perHome.flatMap((devices) => Array.from(devices));
  }

  /** Home-scoped room list. Same fallback rule as getAuthorizedDevices. */
  public async getAuthorizedRooms(userId?: string): Promise<Room[]> {
    if (!this.homeRepository || !userId) return Array.from(await this.roomRepository.findAll());
    const homes = await this.homeRepository.findHomesByUserId(userId);
    if (homes.length === 0) return [];
    const perHome = await Promise.all(homes.map((home) => this.roomRepository.findRoomsByHomeId(home.id)));
    return perHome.flatMap((rooms) => Array.from(rooms));
  }
}
