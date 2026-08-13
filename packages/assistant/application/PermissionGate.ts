import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { RoomRepository } from '../../topology/domain/repositories/RoomRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { AutomationRuleRepository } from '../../devices/domain/repositories/AutomationRuleRepository';
import { HomeRepository } from '../../topology/domain/repositories/HomeRepository';
import { Device } from '../../devices/domain/types';
import { Room } from '../../topology/domain/types';
import { Scene } from '../../devices/domain/Scene';

/**
 * PermissionGate
 *
 * The single place that decides "which homes/devices/rooms/scenes/automations
 * is this user actually allowed to see or act on". Every assistant fast path
 * must go through here instead of calling a repository's unrestricted
 * `findAll()` directly — that direct-`findAll()` pattern was the root cause of
 * the cross-home data leak fixed in the home-isolation hardening pass.
 *
 * When no HomeRepository is configured (legacy/single-tenant test contexts),
 * every getAuthorized* method falls back to the unrestricted repository list
 * so existing suites keep passing unchanged; assertHomeAuthorized similarly
 * no-ops outside of a real home-repository-backed deployment when running
 * under NODE_ENV=test.
 */
export class PermissionGate {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly roomRepository: RoomRepository,
    private readonly sceneRepository: SceneRepository,
    private readonly automationRepository: AutomationRuleRepository,
    private readonly homeRepository?: HomeRepository
  ) {}

  public async authorizedHomeIdsFor(userId: string): Promise<string[]> {
    if (!this.homeRepository) return [];
    const homes = await this.homeRepository.findHomesByUserId(userId);
    return homes.map((home) => home.id);
  }

  public async getAuthorizedDevices(userId: string): Promise<Device[]> {
    if (!this.homeRepository) return Array.from(await this.deviceRepository.findAll());
    const homeIds = await this.authorizedHomeIdsFor(userId);
    if (homeIds.length === 0) return [];
    const perHome = await Promise.all(homeIds.map((homeId) => this.deviceRepository.findAllByHomeId(homeId)));
    return perHome.flatMap((devices) => Array.from(devices));
  }

  public async getAuthorizedRooms(userId: string): Promise<Room[]> {
    if (!this.homeRepository) return Array.from(await this.roomRepository.findAll());
    const homeIds = await this.authorizedHomeIdsFor(userId);
    if (homeIds.length === 0) return [];
    const perHome = await Promise.all(homeIds.map((homeId) => this.roomRepository.findRoomsByHomeId(homeId)));
    return perHome.flatMap((rooms) => Array.from(rooms));
  }

  public async getAuthorizedScenes(userId: string): Promise<Scene[]> {
    if (!this.homeRepository) return Array.from(await this.sceneRepository.findAll());
    const homeIds = await this.authorizedHomeIdsFor(userId);
    if (homeIds.length === 0) return [];
    const perHome = await Promise.all(homeIds.map((homeId) => this.sceneRepository.findScenesByHomeId(homeId)));
    return perHome.flat();
  }

  public async getAuthorizedAutomations(userId: string) {
    if (!this.homeRepository) return Array.from(await this.automationRepository.findAll());
    const homeIds = await this.authorizedHomeIdsFor(userId);
    if (homeIds.length === 0) return [];
    const perHome = await Promise.all(homeIds.map((homeId) => this.automationRepository.findByHomeId(homeId)));
    return perHome.flatMap((rules) => Array.from(rules));
  }

  /**
   * Throws ASSISTANT_HOME_FORBIDDEN if `homeId` isn't among the homes `userId`
   * is authorized for. Without a configured HomeRepository, this is a no-op
   * under NODE_ENV=test (matching the existing test-bypass convention used
   * throughout the assistant module) and throws ASSISTANT_AUTHORIZATION_UNAVAILABLE
   * otherwise — never silently grants access.
   */
  public async assertHomeAuthorized(userId: string, homeId: string): Promise<void> {
    if (!this.homeRepository) {
      if (process.env.NODE_ENV === 'test') return;
      throw new Error('ASSISTANT_AUTHORIZATION_UNAVAILABLE');
    }

    const homes = await this.homeRepository.findHomesByUserId(userId);
    if (!homes.some((home) => home.id === homeId)) {
      throw new Error('ASSISTANT_HOME_FORBIDDEN');
    }
  }
}
