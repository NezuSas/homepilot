import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { RoomRepository } from '../../topology/domain/repositories/RoomRepository';
import { HomeRepository } from '../../topology/domain/repositories/HomeRepository';
import { AssistantMultiCommandResult } from './ports/IntentInterpreterPort';
import { ScopeFilter } from './ScopeFilter';
import { AuthorizedScope, RepositoryAuthorizedScope } from './multicommand/AuthorizedScope';
import { parseCompound } from './multicommand/compoundParsing';
import { parseExclusion } from './multicommand/exclusionParsing';
import { parseZoneCategoryCommand } from './multicommand/zoneCategoryParsing';
import {
  COMMAND_CONNECTORS,
  EXCLUSION_WORDS,
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
    const normalized = normalizePrompt(prompt);

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
      return await parseCompound(prompt, normalized, connectors, this.scope, userId);
    }

    return await parseZoneCategoryCommand(prompt, normalized, this.scope, this.scopeFilter, userId);
  }
}
