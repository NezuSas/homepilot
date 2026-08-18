import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { RoomRepository } from '../../topology/domain/repositories/RoomRepository';
import type { AssistantMemoryPort, AssistantMemoryState } from './ports/AssistantMemoryPort';
import type { AssistantConversationResponse } from './AssistantConversationService';
import { normalizeAssistantPrompt } from './AssistantPromptNormalizer';

/**
 * Encapsula el ciclo de vida de aliases conversacionales. No ejecuta comandos
 * ni interpreta intenciones: solo resuelve nombres aprendidos por usuario.
 */
export class AssistantAliasManagementService {
  constructor(
    private readonly memoryService: AssistantMemoryPort,
    private readonly deviceRepository: DeviceRepository,
    private readonly roomRepository: RoomRepository
  ) {}
  public isAliasCreation(normalized: string): boolean {
    // Patrones explícitos ES
    if (normalized.includes('cuando diga') && (normalized.includes('me refiero a') || normalized.includes('entiende'))) return true;
    if (normalized.includes('guarda') && normalized.includes('como alias')) return true;
    if (normalized.includes('crea alias')) return true;
    if (normalized.includes('llama ') && normalized.includes(' a ')) return true;

    const questionWords = ['que', 'qué', 'cual', 'cuál', 'como', 'cómo', 'donde', 'dónde', 'quien', 'quién'];
    const isQuestion = questionWords.some(w => normalized.startsWith(w + ' ')) || normalized.includes('?');
    if (normalized.includes(' es ') && !isQuestion) return true;

    // Patrones explícitos EN
    if (normalized.includes('when i say') && normalized.includes('i mean')) return true;
    if (normalized.includes('save') && normalized.includes('as alias')) return true;
    if (normalized.includes('create alias')) return true;
    if (normalized.includes('call ') && !normalized.includes('call me')) return true;
    if (normalized.includes(' means ')) return true;

    return false;
  }

  public async handleAliasCreation(normalized: string, userId: string, language: string): Promise<AssistantConversationResponse> {
    // 1. "cuando diga X me refiero a Y" / "when i say X i mean Y"
    const match1 = normalized.match(/(?:cuando diga|when i say) (.+) (?:me refiero a|i mean) (.+)/i);
    if (match1) {
      return await this.tryCreateAlias(userId, match1[1].trim(), match1[2].trim(), language);
    }

    // 2. "llama X a Y" (ES) / "call X to Y" or "call X as Y" (EN)
    const match2 = normalized.match(/(?:llama|call) (.+?) (?:a|to|as) (.+)/i);
    if (match2) {
      return await this.tryCreateAlias(userId, match2[1].trim(), match2[2].trim(), language);
    }

    // 3. "X es Y" / "X means Y"
    const match3 = normalized.match(/(.+) (?:es|means) (.+)/i);
    if (match3) {
      return await this.tryCreateAlias(userId, match3[1].trim(), match3[2].trim(), language);
    }

    // 4. Fallback for "call X Y" (EN)
    if (language === 'en') {
      const match4 = normalized.match(/call (.+?) (.+)/i);
      if (match4) {
        return await this.tryCreateAlias(userId, match4[2].trim(), match4[1].trim(), language);
      }
    }

    return {
      type: 'answer',
      message: language === 'en'
        ? "I couldn't understand the alias you want to create."
        : "No pude entender el alias que quieres crear."
    };
  }

  public async tryCreateAlias(userId: string, alias: string, targetName: string, language: string): Promise<AssistantConversationResponse> {
    const [devices, rooms] = await Promise.all([
      this.deviceRepository.findAll(),
      this.roomRepository.findAll()
    ]);

    // --- COLLISION GUARD ---
    const normAlias = normalizeAssistantPrompt(alias);
    const existingRoom = rooms.find(r => normalizeAssistantPrompt(r.name) === normAlias);
    if (existingRoom) {
      console.info(`[ASSISTANT_USER_ALIAS_COLLISION] ${JSON.stringify({ userId, collisionType: 'room' })}`);
      return {
        type: 'answer',
        message: language === 'en'
          ? `A room or device named '${existingRoom.name}' already exists. Use another alias to avoid confusion.`
          : `Ya existe una estancia o dispositivo llamado '${existingRoom.name}'. Usa otro alias para evitar confusiones.`
      };
    }
    const existingDevice = devices.find(d => normalizeAssistantPrompt(d.name) === normAlias);
    if (existingDevice) {
      console.info(`[ASSISTANT_USER_ALIAS_COLLISION] ${JSON.stringify({ userId, collisionType: 'device' })}`);
      return {
        type: 'answer',
        message: language === 'en'
          ? `A room or device named '${existingDevice.name}' already exists. Use another alias to avoid confusion.`
          : `Ya existe una estancia o dispositivo llamado '${existingDevice.name}'. Usa otro alias para evitar confusiones.`
      };
    }

    // Check if target is a room
    const targetRoom = rooms.find(r => normalizeAssistantPrompt(r.name) === normalizeAssistantPrompt(targetName));
    if (targetRoom) {
      await this.memoryService.setAlias(userId, alias, targetRoom.id);
      console.info(`[ASSISTANT_USER_ALIAS_CREATED] ${JSON.stringify({ userId, targetId: targetRoom.id, type: 'room' })}`);
      return {
        type: 'answer',
        message: language === 'en'
          ? `Perfect, now '${alias}' refers to ${targetRoom.name}.`
          : `Perfecto, ahora '${alias}' se refiere a ${targetRoom.name}.`
      };
    }

    // Check if target is a device
    const targetDevice = devices.find(d => normalizeAssistantPrompt(d.name) === normalizeAssistantPrompt(targetName));
    if (targetDevice) {
      await this.memoryService.setAlias(userId, alias, targetDevice.id);
      console.info(`[ASSISTANT_USER_ALIAS_CREATED] ${JSON.stringify({ userId, targetId: targetDevice.id, type: 'device' })}`);
      return {
        type: 'answer',
        message: language === 'en'
          ? `Perfect, now '${alias}' refers to ${targetDevice.name}.`
          : `Perfecto, ahora '${alias}' se refiere a ${targetDevice.name}.`
      };
    }

    console.warn(`[ASSISTANT_USER_ALIAS_INVALID] ${JSON.stringify({ userId, reason: 'target_not_found' })}`);
    return {
      type: 'answer',
      message: language === 'en'
        ? `I couldn't find a device or room named '${targetName}'.`
        : `No pude encontrar un dispositivo o estancia llamado '${targetName}'.`
    };
  }

  // --- ALIAS MANAGEMENT HANDLERS ---
  public isAliasListQuery(normalized: string): boolean {
    const listTriggersES = ['qué aliases tengo', 'que aliases tengo', 'qué nombres has aprendido', 'que nombres has aprendido', 'lista mis aliases', 'muestra mis aliases'];
    const listTriggersEN = ['what aliases do i have', 'list my aliases', 'show my aliases', 'what names have you learned'];
    return listTriggersES.some(t => normalized.includes(t)) || listTriggersEN.some(t => normalized.includes(t));
  }

  public async handleAliasList(userId: string, language: string): Promise<AssistantConversationResponse> {
    const aliases = await this.memoryService.getAliases(userId);
    const aliasKeys = Object.keys(aliases);

    if (aliasKeys.length === 0) {
      console.info(`[ASSISTANT_USER_ALIAS_LIST] ${JSON.stringify({ userId, count: 0 })}`);
      return {
        type: 'answer',
        message: language === 'en' ? "You haven't created any aliases yet." : "Aún no has creado aliases."
      };
    }

    const [devices, rooms] = await Promise.all([
      this.deviceRepository.findAll(),
      this.roomRepository.findAll()
    ]);

    const lines: string[] = [];
    for (const alias of aliasKeys) {
      const targetId = aliases[alias];
      let targetName = null;
      const room = rooms.find(r => r.id === targetId);
      if (room) {
        targetName = room.name;
      } else {
        const device = devices.find(d => d.id === targetId);
        if (device) targetName = device.name;
      }

      if (targetName) {
        lines.push(`• ${alias} → ${targetName}`);
      } else {
        console.warn(`[ASSISTANT_USER_ALIAS_INVALID] ${JSON.stringify({ userId, targetId, reason: 'entity_not_found' })}`);
        lines.push(language === 'en' ? `• ${alias} → target not found` : `• ${alias} → objetivo no encontrado`);
      }
    }

    console.info(`[ASSISTANT_USER_ALIAS_LIST] ${JSON.stringify({ userId, count: lines.length })}`);
    const prefix = language === 'en' ? "These are the names I've learned:\n" : "Estos son los nombres que he aprendido:\n";
    return {
      type: 'answer',
      message: prefix + lines.join('\n')
    };
  }

  public extractAliasMeaningQuery(normalized: string): string | null {
    const matchES = normalized.match(/(?:qué significa|que significa|a qué se refiere|a que se refiere) (.+)/i);
    if (matchES) return matchES[1].trim();

    const matchEN = normalized.match(/(?:what does) (.+?) (?:mean|refer to)/i);
    if (matchEN) return matchEN[1].trim();

    return null;
  }

  public findBestAliasMatch(input: string, aliases: Record<string, string>): {
    alias: string;
    targetId: string;
    status: 'resolved' | 'not_found' | 'ambiguous';
    candidates?: string[];
  } {
    const normInput = normalizeAssistantPrompt(input);
    let longestMatchLen = -1;
    let matches: Array<{ norm: string; original: string; targetId: string }> = [];

    for (const [alias, targetId] of Object.entries(aliases)) {
      const normAlias = normalizeAssistantPrompt(alias);
      if (normInput === normAlias || normInput.includes(normAlias)) {
        matches.push({ norm: normAlias, original: alias, targetId });
        if (normAlias.length > longestMatchLen) {
          longestMatchLen = normAlias.length;
        }
      }
    }

    if (matches.length === 0) {
      return { alias: '', targetId: '', status: 'not_found' };
    }

    const bestMatches = matches.filter(m => m.norm.length === longestMatchLen);

    if (bestMatches.length === 1) {
      return { alias: bestMatches[0].original, targetId: bestMatches[0].targetId, status: 'resolved' };
    }

    return {
      alias: '',
      targetId: '',
      status: 'ambiguous',
      candidates: bestMatches.map(m => m.original)
    };
  }

  public async handleAliasMeaning(userId: string, targetAlias: string, language: string): Promise<AssistantConversationResponse> {
    const aliases = await this.memoryService.getAliases(userId);

    const match = this.findBestAliasMatch(targetAlias, aliases);

    if (match.status === 'ambiguous') {
      const list = match.candidates?.join(', ') || '';
      return {
        type: 'answer',
        message: language === 'en'
          ? `I found multiple possible aliases: ${list}. Which one do you want to use?`
          : `Encontré varios aliases posibles: ${list}. ¿Cuál quieres usar?`
      };
    }

    if (match.status === 'not_found') {
      console.info(`[ASSISTANT_USER_ALIAS_MEANING] ${JSON.stringify({ userId, found: false })}`);
      return {
        type: 'answer',
        message: language === 'en' ? "I didn't find that alias." : "No encontré ese alias."
      };
    }

    const matchedKey = match.alias;
    const targetId = match.targetId;
    const [devices, rooms] = await Promise.all([
      this.deviceRepository.findAll(),
      this.roomRepository.findAll()
    ]);

    let targetName = null;
    const room = rooms.find(r => r.id === targetId);
    if (room) {
      targetName = room.name;
    } else {
      const device = devices.find(d => d.id === targetId);
      if (device) targetName = device.name;
    }

    if (!targetName) {
      console.warn(`[ASSISTANT_USER_ALIAS_INVALID] ${JSON.stringify({ userId, alias: matchedKey, targetId, reason: 'entity_not_found' })}`);
      return {
        type: 'answer',
        message: language === 'en' ? `• ${matchedKey} → target not found` : `• ${matchedKey} → objetivo no encontrado`
      };
    }

    console.info(`[ASSISTANT_USER_ALIAS_MEANING] ${JSON.stringify({ userId, found: true })}`);
    return {
      type: 'answer',
      message: language === 'en'
        ? `'${matchedKey}' refers to ${targetName}.`
        : `'${matchedKey}' se refiere a ${targetName}.`
    };
  }

  public extractAliasDeleteRequest(normalized: string): string | null {
    const matchES = normalized.match(/(?:olvida|elimina|borra alias|borra el alias) (.+)/i);
    if (matchES) return matchES[1].trim();

    const matchEN = normalized.match(/(?:forget|delete alias|remove alias) (.+)|(?:delete) (.+) (?:alias)/i);
    if (matchEN) return (matchEN[1] || matchEN[2]).trim();

    return null;
  }

  public async handleAliasDeleteRequest(userId: string, targetAlias: string, language: string, memory: AssistantMemoryState | null): Promise<AssistantConversationResponse> {
    const aliases = await this.memoryService.getAliases(userId);

    const match = this.findBestAliasMatch(targetAlias, aliases);

    if (match.status === 'ambiguous') {
      const list = match.candidates?.join(', ') || '';
      return {
        type: 'answer',
        message: language === 'en'
          ? `I found multiple possible aliases: ${list}. Which one do you want to use?`
          : `Encontré varios aliases posibles: ${list}. ¿Cuál quieres usar?`
      };
    }

    if (match.status === 'not_found') {
      console.info(`[ASSISTANT_USER_ALIAS_DELETE_NOT_FOUND] ${JSON.stringify({ userId })}`);
      return {
        type: 'answer',
        message: language === 'en' ? "I didn't find that alias." : "No encontré ese alias."
      };
    }

    const matchedKey = match.alias;
    const targetId = match.targetId;
    const [devices, rooms] = await Promise.all([
      this.deviceRepository.findAll(),
      this.roomRepository.findAll()
    ]);

    let targetName = 'Unknown';
    const room = rooms.find(r => r.id === targetId);
    if (room) targetName = room.name;
    else {
      const device = devices.find(d => d.id === targetId);
      if (device) targetName = device.name;
    }

    await this.memoryService.saveShortTermMemory(userId, {
      ...(memory || { lastQueryType: 'none', entities: [], timestamp: new Date().toISOString() }),
      pendingAliasDelete: {
        alias: matchedKey,
        targetId,
        targetName,
        timestamp: new Date().toISOString()
      }
    });

    console.info(`[ASSISTANT_USER_ALIAS_DELETE_CONFIRMATION_REQUIRED] ${JSON.stringify({ userId, targetId })}`);

    return {
      type: 'clarification',
      message: language === 'en'
        ? `Do you want me to forget the alias '${matchedKey}' for ${targetName}?`
        : `¿Quieres que olvide el alias '${matchedKey}' para ${targetName}?`,
      clarification: {
        question: language === 'en' ? 'Delete alias?' : '¿Eliminar alias?',
        options: [
          { id: 'confirm', label: language === 'en' ? 'Yes, delete' : 'Sí, eliminar', kind: 'alias_target' },
          { id: 'cancel', label: language === 'en' ? 'No, keep it' : 'No, mantener', kind: 'alias_target' }
        ]
      }
    };
  }



}
