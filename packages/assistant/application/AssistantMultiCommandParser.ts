import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { RoomRepository } from '../../topology/domain/repositories/RoomRepository';
import { HomeRepository } from '../../topology/domain/repositories/HomeRepository';
import { AssistantMultiCommandResult } from './ports/IntentInterpreterPort';
import { Device } from '../../devices/domain/types';
import { DeviceCommandV1 } from '../../devices/domain/commands';
import { Room } from '../../topology/domain/types';
import { ScopeFilter } from './ScopeFilter';
import { AuthorizedScope, RepositoryAuthorizedScope } from './multicommand/AuthorizedScope';
import { parseCompound } from './multicommand/compoundParsing';
import { parseExclusion } from './multicommand/exclusionParsing';
import { parseZoneCategoryCommand } from './multicommand/zoneCategoryParsing';
import { resolveTargets } from './multicommand/targetResolution';
import {
  COMMAND_CONNECTORS,
  EXCLUSION_WORDS,
  categoryMatchesDeviceName,
  extractCategoryWord,
  inferCommandFromSegment,
  isControllableDevice,
  normalizePrompt,
} from './multicommand/textRules';

/**
 * Orquesta el parseo determinista de comandos múltiples: elige entre exclusión,
 * compuesto o categoría por zona. Las reglas viven en ./multicommand.
 */
export class AssistantMultiCommandParser {
  private readonly scopeFilter = new ScopeFilter();
  private readonly scope: AuthorizedScope;

  constructor(
    deviceRepository: DeviceRepository,
    roomRepository: RoomRepository,
    homeRepository?: HomeRepository
  ) {
    this.scope = new RepositoryAuthorizedScope(deviceRepository, roomRepository, homeRepository);
  }

  public async parse(prompt: string, userId?: string): Promise<AssistantMultiCommandResult | null> {
    const normalized = this.normalizePrompt(prompt);

    // Conectores que dividen oraciones de comandos
    const connectors = COMMAND_CONNECTORS;
    const exclusions = EXCLUSION_WORDS;

    // Exclusion takes priority over connector splitting: "todas las luces menos X y Z"
    // contains both " y " (between the excluded items) and " menos " — checking the
    // connector first would silently split on " y " and lose the exclusion entirely.
    const hasExclusion = exclusions.some(e => normalized.includes(e));
    if (hasExclusion) {
      return await parseExclusion(prompt, normalized, exclusions, this.scope, this.scopeFilter, userId);
    }

    const hasConnector = connectors.some(c => normalized.includes(c));
    if (hasConnector) {
      return await this.parseCompound(prompt, normalized, connectors, userId);
    }

    return await parseZoneCategoryCommand(prompt, normalized, this.scope, this.scopeFilter, userId);
  }

  // ─── Delegates to the pure rules (kept as members for existing callers/tests) ──

  protected getAuthorizedDevices(userId?: string): Promise<Device[]> {
    return this.scope.getAuthorizedDevices(userId);
  }

  protected getAuthorizedRooms(userId?: string): Promise<Room[]> {
    return this.scope.getAuthorizedRooms(userId);
  }

  protected parseCompound(originalPrompt: string, normalized: string, connectors: string[], userId?: string): Promise<AssistantMultiCommandResult> {
    return parseCompound(originalPrompt, normalized, connectors, this.scope, userId);
  }

  protected resolveTargets(segment: string, allDevices: readonly Device[], allRooms: readonly Room[]): ReturnType<typeof resolveTargets> {
    return resolveTargets(segment, allDevices, allRooms);
  }

  protected extractCategoryWord(basePartWithVerb: string): string {
    return extractCategoryWord(basePartWithVerb);
  }

  protected categoryMatchesDeviceName(category: string, deviceName: string): boolean {
    return categoryMatchesDeviceName(category, deviceName);
  }

  protected inferCommandFromSegment(segment: string): DeviceCommandV1 | null {
    return inferCommandFromSegment(segment);
  }

  protected normalizePrompt(prompt: string): string {
    return normalizePrompt(prompt);
  }

  protected isControllableDevice(device: Device, command: string): boolean {
    return isControllableDevice(device, command);
  }
}
