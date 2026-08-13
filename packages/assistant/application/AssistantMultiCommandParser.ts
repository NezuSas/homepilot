import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { RoomRepository } from '../../topology/domain/repositories/RoomRepository';
import { HomeRepository } from '../../topology/domain/repositories/HomeRepository';
import { Intent, AssistantMultiCommandResult, MultiCommandAction } from './ports/IntentInterpreterPort';
import { Device } from '../../devices/domain/types';
import { validateDeviceCommand } from '../../devices/domain/CommandCapabilityValidator';
import { DeviceCommandV1, isValidCommand } from '../../devices/domain/commands';
import { Room } from '../../topology/domain/types';
import { ScopeFilter } from './ScopeFilter';
import { normalizeText, correctAgainstVocabulary, buildVocabulary } from './textMatching';

const VERB_PATTERN = /^(apaga|apagar|prende|prender|enciende|encender|activa|activar|desactiva|desactivar)\b/;
const BULK_WORDS = new Set(['todo', 'todos', 'todas']);
const ARTICLE_WORDS = new Set(['los', 'las', 'el', 'la', 'de', 'del', 'un', 'una', 'unos', 'unas']);
const LIGHT_SYNONYMS_REGEX = /\b(luz|luces|foco|focos|lampara|lamparas)\b/;
/** Splits an exclusion/exception clause into individual terms: "X, Y y Z" -> ["X","Y","Z"]. */
const EXCEPTION_SPLIT_REGEX = /\s*,\s*|\s+(?:y|e)\s+/;
/**
 * "apaga CATEGORIA de/en (la zona|el area|la estancia|...)? NOMBRE" — generalizes the
 * deterministic room-bulk fast-path's fixed keyword list ("todo"/"todas las luces") to
 * an arbitrary category word (e.g. "dicroicos"), since new device categories appear per
 * household and can never be fully hardcoded in advance.
 */
const ZONE_CATEGORY_REGEX = /^(apaga|apagar|prende|prender|enciende|encender|activa|activar|desactiva|desactivar)\s+(.+?)\s+(?:de|en)\s+(?:la\s+zona\s+|el\s+area\s+|la\s+estancia\s+|la\s+habitacion\s+|el\s+cuarto\s+|del\s+|de\s+la\s+|de\s+|la\s+|el\s+)?(.+)$/i;

export class AssistantMultiCommandParser {
  private readonly scopeFilter = new ScopeFilter();

  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly roomRepository: RoomRepository,
    private readonly homeRepository?: HomeRepository
  ) {}

  /** Home-scoped device list. Falls back to the unrestricted list only when no homeRepository is configured. */
  private async getAuthorizedDevices(userId?: string): Promise<Device[]> {
    if (!this.homeRepository || !userId) return Array.from(await this.deviceRepository.findAll());
    const homes = await this.homeRepository.findHomesByUserId(userId);
    if (homes.length === 0) return [];
    const perHome = await Promise.all(homes.map((home) => this.deviceRepository.findAllByHomeId(home.id)));
    return perHome.flatMap((devices) => Array.from(devices));
  }

  /** Home-scoped room list. Same fallback rule as getAuthorizedDevices. */
  private async getAuthorizedRooms(userId?: string): Promise<Room[]> {
    if (!this.homeRepository || !userId) return Array.from(await this.roomRepository.findAll());
    const homes = await this.homeRepository.findHomesByUserId(userId);
    if (homes.length === 0) return [];
    const perHome = await Promise.all(homes.map((home) => this.roomRepository.findRoomsByHomeId(home.id)));
    return perHome.flatMap((rooms) => Array.from(rooms));
  }

  public async parse(prompt: string, userId?: string): Promise<AssistantMultiCommandResult | null> {
    const normalized = this.normalizePrompt(prompt);

    // Conectores que dividen oraciones de comandos
    const connectors = [' y ', ' tambien ', ' ademas ', ' pero ', ' and ', ' also ', ' but '];
    const exclusions = [' menos ', ' excepto ', ' salvo ', ' except ', ' except for ', ' minus '];

    // Exclusion takes priority over connector splitting: "todas las luces menos X y Z"
    // contains both " y " (between the excluded items) and " menos " — checking the
    // connector first would silently split on " y " and lose the exclusion entirely.
    const hasExclusion = exclusions.some(e => normalized.includes(e));
    if (hasExclusion) {
      return await this.parseExclusion(prompt, normalized, exclusions, userId);
    }

    const hasConnector = connectors.some(c => normalized.includes(c));
    if (hasConnector) {
      return await this.parseCompound(prompt, normalized, connectors, userId);
    }

    return await this.tryParseZoneCategoryCommand(prompt, normalized, userId);
  }

  /**
   * Handles "apaga todo/todas las luces/CATEGORIA menos X[, Y y Z]" — a bulk or
   * category-scoped command with one or more excluded devices/rooms/sub-categories.
   * Never partially applies: an exception term that can't be resolved fails the
   * whole command rather than silently being ignored.
   */
  private async parseExclusion(originalPrompt: string, normalized: string, exclusions: string[], userId?: string): Promise<AssistantMultiCommandResult> {
    let splitPoint = -1;
    let usedExclusion = '';

    for (const ex of exclusions) {
      const idx = normalized.indexOf(ex);
      if (idx !== -1) {
        splitPoint = idx;
        usedExclusion = ex;
        break;
      }
    }

    if (splitPoint === -1) return { type: 'failure', message: 'No exclusion found' };

    // Commas only matter as delimiters within the exception list; the base part
    // never needs them (and a stray trailing comma would corrupt category detection).
    const basePart = normalized.substring(0, splitPoint).replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    const exceptionsPart = normalized.substring(splitPoint + usedExclusion.length).trim();

    const command = this.inferCommandFromSegment(basePart);
    if (!command) {
      return { type: 'failure', message: 'No se pudo entender la acción principal ("apaga" o "prende").' };
    }

    const allDevices = await this.getAuthorizedDevices(userId);
    const allRooms = await this.getAuthorizedRooms(userId);

    // Determine the base scope: bare "todo"/"todos" -> every controllable device;
    // a recognized light synonym -> lights only; anything else is treated as a free
    // category word (e.g. "dicroicos") matched generically against real device
    // names/vocabulary in this home, never a hardcoded list.
    const baseCategory = this.extractCategoryWord(basePart);
    const isLightsOnly = LIGHT_SYNONYMS_REGEX.test(basePart);

    let baseScopeDevices: Device[];
    if (!baseCategory || BULK_WORDS.has(baseCategory)) {
      baseScopeDevices = allDevices.filter(d => this.scopeFilter.isControllableForBulk(d, command, 'all'));
    } else if (isLightsOnly) {
      baseScopeDevices = allDevices.filter(d => this.scopeFilter.isControllableForBulk(d, command, 'lights'));
    } else {
      const vocabulary = buildVocabulary(allDevices.map(d => d.name));
      const correctedCategory = correctAgainstVocabulary(baseCategory, vocabulary);
      baseScopeDevices = allDevices.filter(d =>
        this.scopeFilter.isControllableForBulk(d, command, 'all') &&
        this.categoryMatchesDeviceName(correctedCategory, d.name)
      );
    }

    if (baseScopeDevices.length === 0) {
      return { type: 'failure', message: `No encontré "${baseCategory || 'todo'}" para ejecutar esa acción.` };
    }

    // Resolve each exception term (room, device, or category) into excluded device IDs.
    const exceptionTerms = exceptionsPart.split(EXCEPTION_SPLIT_REGEX).map(s => s.trim()).filter(Boolean);
    if (exceptionTerms.length === 0) {
      return { type: 'failure', message: `No pude encontrar qué significa "${exceptionsPart}".` };
    }

    const vocabulary = buildVocabulary([...allDevices.map(d => d.name), ...allRooms.map(r => r.name)]);
    const excludedDeviceIds = new Set<string>();

    for (const term of exceptionTerms) {
      const corrected = correctAgainstVocabulary(term, vocabulary);

      const roomMatch = allRooms.find(r => {
        const roomName = normalizeText(r.name);
        return roomName.includes(corrected) || corrected.includes(roomName);
      });
      if (roomMatch) {
        for (const d of allDevices) if (d.roomId === roomMatch.id) excludedDeviceIds.add(d.id);
        continue;
      }

      // Compare both the raw phrase and an article/preposition-stripped version:
      // "la luz de cocina" must match a device literally named "Luz de Cocina"
      // (raw substring) as well as one named just "Luz Cocina" (stripped tokens),
      // since real installs rarely keep filler words in device names.
      const strippedCorrected = this.stripArticlesAndBulkWords(corrected);
      const deviceMatches = allDevices.filter(d => {
        const deviceName = normalizeText(d.name);
        const strippedDeviceName = this.stripArticlesAndBulkWords(deviceName);
        return deviceName === corrected || deviceName.includes(corrected) || corrected.includes(deviceName) ||
          strippedDeviceName === strippedCorrected || strippedDeviceName.includes(strippedCorrected) || strippedCorrected.includes(strippedDeviceName) ||
          this.categoryMatchesDeviceName(corrected, d.name);
      });
      if (deviceMatches.length > 0) {
        for (const d of deviceMatches) excludedDeviceIds.add(d.id);
        continue;
      }

      // An exception term we can't identify must abort the whole command rather
      // than be silently dropped — otherwise "menos X" could turn into "todo"
      // if X fails to resolve, which is the opposite of what was asked.
      return { type: 'failure', message: `No pude encontrar qué significa "${term}".` };
    }

    const actions: MultiCommandAction[] = [];
    for (const d of baseScopeDevices) {
      if (excludedDeviceIds.has(d.id)) continue;
      actions.push({ deviceId: d.id, command, targetName: d.name });
    }

    if (actions.length === 0) {
      return { type: 'failure', message: 'No se encontraron dispositivos para ejecutar esa acción.' };
    }

    return {
      type: 'success',
      intent: {
        type: 'multi_command',
        prompt: originalPrompt,
        actions,
        requiresConfirmation: true
      }
    };
  }

  /**
   * Handles "apaga CATEGORIA de/en [la zona/el area/...] NOMBRE" — a category
   * scoped to a room, generalizing beyond the deterministic room-bulk fast-path's
   * fixed keyword list. Returns null (never a failure) whenever the prompt isn't
   * confidently a zone/category command, so unrelated prompts fall through
   * untouched to whatever handles them next.
   */
  private async tryParseZoneCategoryCommand(originalPrompt: string, normalized: string, userId?: string): Promise<AssistantMultiCommandResult | null> {
    const match = normalized.match(ZONE_CATEGORY_REGEX);
    if (!match) return null;

    const command = this.inferCommandFromSegment(match[1]);
    if (!command) return null;

    const categoryPhrase = match[2].trim();
    const roomPhrase = match[3].trim();
    if (!roomPhrase) return null;

    const category = this.stripArticlesAndBulkWords(categoryPhrase);
    // A bare "todo"/"todas las luces" + room is already the deterministic room-bulk
    // fast-path's job — don't duplicate it here, only generalize beyond it.
    if (!category || BULK_WORDS.has(category) || category.length < 3) return null;

    const allRooms = await this.getAuthorizedRooms(userId);
    const roomMatch = allRooms.find(r => {
      const roomName = normalizeText(r.name);
      return roomPhrase.includes(roomName) || roomName.includes(roomPhrase);
    });
    if (!roomMatch) return null;

    const allDevices = await this.getAuthorizedDevices(userId);
    const isLightsOnly = LIGHT_SYNONYMS_REGEX.test(categoryPhrase);
    const vocabulary = buildVocabulary(allDevices.map(d => d.name));
    const correctedCategory = correctAgainstVocabulary(category, vocabulary);

    const matchingDevices = allDevices.filter(d => {
      if (d.roomId !== roomMatch.id) return false;
      if (isLightsOnly) return this.scopeFilter.isControllableForBulk(d, command, 'lights');
      return this.scopeFilter.isControllableForBulk(d, command, 'all') && this.categoryMatchesDeviceName(correctedCategory, d.name);
    });

    if (matchingDevices.length === 0) {
      return { type: 'failure', message: `No encontré "${category}" en "${roomMatch.name}".` };
    }

    return {
      type: 'success',
      intent: {
        type: 'multi_command',
        prompt: originalPrompt,
        actions: matchingDevices.map(d => ({ deviceId: d.id, command, targetName: d.name })),
        requiresConfirmation: true
      }
    };
  }

  /** Strips the leading verb and returns the remaining bare category word(s). */
  private extractCategoryWord(basePartWithVerb: string): string {
    const rest = basePartWithVerb.replace(VERB_PATTERN, '').trim();
    const stripped = this.stripArticlesAndBulkWords(rest);
    if (!stripped) return rest.split(/\s+/).some(t => BULK_WORDS.has(t)) ? 'todo' : '';
    return stripped;
  }

  private stripArticlesAndBulkWords(phrase: string): string {
    return phrase
      .split(/\s+/)
      .filter(t => t && !ARTICLE_WORDS.has(t) && !BULK_WORDS.has(t))
      .join(' ');
  }

  /**
   * Substring match with basic Spanish singular/plural tolerance (dicroico/dicroicos,
   * foco/focos) — the common case for a category word that doesn't exactly match a
   * device name's grammatical number.
   */
  private categoryMatchesDeviceName(category: string, deviceName: string): boolean {
    if (!category) return false;
    const name = normalizeText(deviceName);
    if (name.includes(category)) return true;
    const singular = category.endsWith('s') ? category.slice(0, -1) : null;
    if (singular && singular.length >= 3 && name.includes(singular)) return true;
    const plural = !category.endsWith('s') ? `${category}s` : null;
    if (plural && name.includes(plural)) return true;
    return false;
  }

  private async parseCompound(originalPrompt: string, normalized: string, connectors: string[], userId?: string): Promise<AssistantMultiCommandResult> {
    // Convert "A y B y C" to array
    let text = normalized;
    const segments: string[] = [];

    // Simple naive split by the first connector found
    // A better approach splits by all connectors, but let's replace all connectors with a single token first
    const TOKEN = '|||';
    for (const c of connectors) {
      text = text.split(c).join(TOKEN);
    }

    const parts = text.split(TOKEN).map(s => s.trim()).filter(s => s.length > 0);

    if (parts.length < 2) {
      return { type: 'failure', message: 'No se encontraron múltiples acciones claras.' };
    }

    const actions: MultiCommandAction[] = [];
    let currentCommand: DeviceCommandV1 | null = null;

    const allDevices = await this.getAuthorizedDevices(userId);
    const allRooms = await this.getAuthorizedRooms(userId);

    for (const segment of parts) {
      const explicitCommand = this.inferCommandFromSegment(segment);
      if (explicitCommand) {
        currentCommand = explicitCommand;
      }

      if (!currentCommand) {
        return { type: 'failure', message: `No entendí qué hacer con: "${segment}"` };
      }

      // Resolve targets in segment
      const targetMatches = await this.resolveTargets(segment, allDevices, allRooms);

      if (targetMatches.type === 'clarificationRequired') {
        return targetMatches;
      }

      if (targetMatches.type === 'failure') {
        return targetMatches;
      }

      if (targetMatches.type === 'match') {
        const devices = targetMatches.devices.filter((d: Device) => this.isControllableDevice(d, currentCommand!));
        if (devices.length === 0) {
          return { type: 'failure', message: `No encontré dispositivos controlables para: "${segment}"` };
        }

        for (const d of devices) {
          actions.push({
            deviceId: d.id,
            command: currentCommand!,
            targetName: d.name
          });
        }
      }
    }

    return {
      type: 'success',
      intent: {
        type: 'multi_command',
        prompt: originalPrompt,
        actions,
        requiresConfirmation: true
      }
    };
  }

  private async resolveTargets(segment: string, allDevices: readonly Device[], allRooms: readonly Room[]): Promise<{ type: 'match', devices: Device[] } | AssistantMultiCommandResult> {
    // 1. Check for explicit bulk intent in segment — only then allow room-wide expansion.
    // Single-target phrases like "luz sala" or "cocina" must NOT silently expand to all room devices.
    const hasBulkKeyword = /\b(todo|todas\s+las\s+luces|todas|everything|all\s+lights|all)\b/i.test(segment);

    // 2. Try Room Match
    const roomMatch = allRooms.find(r => segment.includes(this.normalizePrompt(r.name)));
    if (roomMatch) {
      if (hasBulkKeyword) {
        // Explicit bulk: expand all controllable devices in room
        const roomDevices = allDevices.filter(d => d.roomId === roomMatch.id);
        if (roomDevices.length > 0) return { type: 'match', devices: [...roomDevices] };
      } else {
        // Singular reference to a room: must clarify — never auto-expand
        const roomDevices = allDevices.filter(d => d.roomId === roomMatch.id);
        if (roomDevices.length === 0) {
          return { type: 'failure', message: `No encontré dispositivos en "${roomMatch.name}".` };
        }
        return {
          type: 'clarificationRequired',
          options: roomDevices.map(d => ({ id: d.id, label: d.name, kind: 'device' as const })),
          originalSegment: segment
        };
      }
    }

    // 3. Score-based device matching (like single commands)
    const scored = allDevices.map(d => {
      const name = this.normalizePrompt(d.name);
      let score = 0;

      if (name === segment) score = 100;
      else if (segment.includes(name)) score = 50;
      else if (name.split(' ').some(token => segment.includes(token))) score = 10;

      return { device: d, score };
    }).filter(item => item.score > 0);

    scored.sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
      const topScore = scored[0].score;
      const bestMatches = scored.filter(item => item.score === topScore).map(item => item.device);

      if (bestMatches.length === 1) {
        return { type: 'match', devices: [...bestMatches] };
      } else {
        return {
          type: 'clarificationRequired',
          options: bestMatches.map(d => ({ id: d.id, label: d.name, kind: 'device' as const })),
          originalSegment: segment
        };
      }
    }

    return { type: 'failure', message: `No pude encontrar qué controlar en: "${segment}"` };
  }

  private inferCommandFromSegment(segment: string): DeviceCommandV1 | null {
    const offKeywords = ['apaga', 'apagar', 'apagado', 'desactivar', 'off'];
    const onKeywords = ['prende', 'enciende', 'encender', 'encendido', 'activar', 'on'];

    const isOff = offKeywords.some(kw => {
      if (kw.length <= 3) {
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        return regex.test(segment);
      }
      return segment.includes(kw);
    });

    const isOn = onKeywords.some(kw => {
      if (kw.length <= 3) {
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        return regex.test(segment);
      }
      return segment.includes(kw);
    });

    if (isOff && !isOn) return 'turn_off';
    if (isOn && !isOff) return 'turn_on';

    return null;
  }

  private normalizePrompt(prompt: string): string {
    return prompt
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // Remove accents
      .replace(/[¿?¡!.]/g, "")         // Remove punctuation (commas handled next — they delimit exclusion lists)
      .replace(/,/g, " , ")            // Isolate commas so they never stick to a word token
      .replace(/\s+/g, " ")            // Normalize spaces
      .trim();
  }

  private isControllableDevice(device: Device, command: string): boolean {
    const rawState = device.lastKnownState;
    if (rawState && typeof rawState['state'] === 'string' && rawState['state'] === 'unavailable') return false;

    const type = device.type.toLowerCase();
    const name = device.name.toLowerCase();

    if (type === 'sensor' || type === 'binary_sensor') return false;
    if (name.includes('sensor') && !name.includes('luz') && !name.includes('foco')) return false;

    const TURN_TYPES = ['light', 'switch', 'outlet', 'dimmer'];
    if (TURN_TYPES.includes(type) && ['turn_on', 'turn_off', 'toggle'].includes(command)) return true;

    const controllableNames = ['luz', 'foco', 'lampara', 'interruptor', 'enchufe', 'tomacorriente', 'apagador'];
    if (controllableNames.some(kw => name.includes(kw))) return true;

    if (!isValidCommand(command)) return false;

    const validation = validateDeviceCommand(device, { name: command, params: {} });
    return validation.valid;
  }
}
