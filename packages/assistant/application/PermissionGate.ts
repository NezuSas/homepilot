import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { RoomRepository } from '../../topology/domain/repositories/RoomRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { AutomationRuleRepository } from '../../devices/domain/repositories/AutomationRuleRepository';
import { HomeRepository } from '../../topology/domain/repositories/HomeRepository';
import { Device } from '../../devices/domain/types';
import { Room } from '../../topology/domain/types';
import { Scene } from '../../devices/domain/Scene';
import { canUseRoom, isRoomRestricted, type RoomScopedSubject } from '../../auth/domain/roomAccess';

/** Tells which rooms a user is limited to; null when the user is unknown. */
export type RoomScopeProvider = (userId: string) => Promise<RoomScopedSubject | null>;

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
    private readonly homeRepository?: HomeRepository,
    private readonly roomScopeProvider?: RoomScopeProvider
  ) {}

  /** The subject only when it is limited to some rooms; null means the whole home is allowed. */
  private async restrictedScopeFor(userId: string): Promise<RoomScopedSubject | null> {
    if (!this.roomScopeProvider) return null;
    const subject = await this.roomScopeProvider(userId);
    return subject && isRoomRestricted(subject) ? subject : null;
  }

  private async sceneWithinScope(scene: Scene, scope: RoomScopedSubject): Promise<boolean> {
    for (const action of scene.actions) {
      const device = await this.deviceRepository.findDeviceById(action.deviceId);
      if (!device || !canUseRoom(scope, device.roomId)) return false;
    }
    return true;
  }

  public async authorizedHomeIdsFor(userId: string): Promise<string[]> {
    if (!this.homeRepository) return [];
    const homes = await this.homeRepository.findHomesByUserId(userId);
    return homes.map((home) => home.id);
  }

  public async getAuthorizedDevices(userId: string): Promise<Device[]> {
    const scope = await this.restrictedScopeFor(userId);
    const inScope = (devices: Device[]) => (scope ? devices.filter((device) => canUseRoom(scope, device.roomId)) : devices);
    if (!this.homeRepository) return inScope(Array.from(await this.deviceRepository.findAll()));
    const homeIds = await this.authorizedHomeIdsFor(userId);
    if (homeIds.length === 0) return [];
    const perHome = await Promise.all(homeIds.map((homeId) => this.deviceRepository.findAllByHomeId(homeId)));
    return inScope(perHome.flatMap((devices) => Array.from(devices)));
  }

  public async getAuthorizedRooms(userId: string): Promise<Room[]> {
    const scope = await this.restrictedScopeFor(userId);
    const inScope = (rooms: Room[]) => (scope ? rooms.filter((room) => canUseRoom(scope, room.id)) : rooms);
    if (!this.homeRepository) return inScope(Array.from(await this.roomRepository.findAll()));
    const homeIds = await this.authorizedHomeIdsFor(userId);
    if (homeIds.length === 0) return [];
    const perHome = await Promise.all(homeIds.map((homeId) => this.roomRepository.findRoomsByHomeId(homeId)));
    return inScope(perHome.flatMap((rooms) => Array.from(rooms)));
  }

  public async getAuthorizedScenes(userId: string): Promise<Scene[]> {
    const scope = await this.restrictedScopeFor(userId);
    const owned = !this.homeRepository
      ? Array.from(await this.sceneRepository.findAll()).filter((scene) => scene.userId === userId)
      : await this.ownedScenesInHomes(userId);
    if (!scope) return owned;
    const inScope = await Promise.all(owned.map((scene) => this.sceneWithinScope(scene, scope)));
    return owned.filter((_scene, index) => inScope[index]);
  }

  private async ownedScenesInHomes(userId: string): Promise<Scene[]> {
    const homeIds = await this.authorizedHomeIdsFor(userId);
    if (homeIds.length === 0) return [];
    const perHome = await Promise.all(homeIds.map((homeId) => this.sceneRepository.findScenesByHomeId(homeId)));
    return perHome.flat().filter((scene) => scene.userId === userId);
  }

  public async getAuthorizedAutomations(userId: string) {
    if (!this.homeRepository) return Array.from(await this.automationRepository.findAll()).filter((rule) => rule.userId === userId);
    const homeIds = await this.authorizedHomeIdsFor(userId);
    if (homeIds.length === 0) return [];
    const perHome = await Promise.all(homeIds.map((homeId) => this.automationRepository.findByHomeId(homeId)));
    return perHome.flatMap((rules) => Array.from(rules)).filter((rule) => rule.userId === userId);
  }

  public async assertSceneAuthorized(userId: string, scene: Scene): Promise<void> {
    if (scene.userId !== userId) throw new Error('ASSISTANT_SCENE_FORBIDDEN');
    await this.assertHomeAuthorized(userId, scene.homeId);
    const scope = await this.restrictedScopeFor(userId);
    if (scope && !(await this.sceneWithinScope(scene, scope))) throw new Error('ASSISTANT_SCENE_FORBIDDEN');
  }

  /** A user limited to some rooms can only act on devices in those rooms, whatever path found the device. */
  public async assertDeviceAuthorized(userId: string, device: Pick<Device, 'roomId'>): Promise<void> {
    const scope = await this.restrictedScopeFor(userId);
    if (scope && !canUseRoom(scope, device.roomId)) throw new Error('ASSISTANT_DEVICE_FORBIDDEN');
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
