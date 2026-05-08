import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { RoomRepository } from '../../topology/domain/repositories/RoomRepository';
import { Intent, AssistantMultiCommandResult, MultiCommandAction } from './ports/IntentInterpreterPort';
import { Device } from '../../devices/domain/types';
import { validateDeviceCommand } from '../../devices/domain/CommandCapabilityValidator';
import { DeviceCommandV1, isValidCommand } from '../../devices/domain/commands';
import { Room } from '../../topology/domain/types';

export class AssistantMultiCommandParser {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly roomRepository: RoomRepository
  ) {}

  public async parse(prompt: string): Promise<AssistantMultiCommandResult | null> {
    const normalized = this.normalizePrompt(prompt);

    // Conectores que dividen oraciones de comandos
    const connectors = [' y ', ' tambien ', ' ademas ', ' pero ', ' and ', ' also ', ' but '];
    const exclusions = [' menos ', ' excepto ', ' salvo ', ' except ', ' except for ', ' minus '];

    const hasConnector = connectors.some(c => normalized.includes(c));
    const hasExclusion = exclusions.some(e => normalized.includes(e));

    if (!hasConnector && !hasExclusion) {
      return null; // Not a multi-command
    }

    if (hasExclusion && !hasConnector) {
      return await this.parseExclusion(prompt, normalized, exclusions);
    }

    if (hasConnector) {
      return await this.parseCompound(prompt, normalized, connectors);
    }

    return null;
  }

  private async parseExclusion(originalPrompt: string, normalized: string, exclusions: string[]): Promise<AssistantMultiCommandResult> {
    // A exclusion is like "apaga todo menos X"
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

    const firstPart = normalized.substring(0, splitPoint).trim();
    const secondPart = normalized.substring(splitPoint + usedExclusion.length).trim();

    if (!firstPart.includes('todo')) {
      // V1: only support "todo menos X"
      return { type: 'failure', message: 'La exclusión solo soporta comandos globales como "todo menos X"' };
    }

    const command = this.inferCommandFromSegment(firstPart);
    if (!command) {
      return { type: 'failure', message: 'No se pudo entender la acción principal ("apaga" o "prende").' };
    }

    // Resolve secondPart as a room or device to EXCLUDE
    const allDevices = await this.deviceRepository.findAll();
    const allRooms = await this.roomRepository.findAll();

    let excludedRoomId: string | null = null;
    let excludedDeviceId: string | null = null;

    // Try room match
    const roomMatch = allRooms.find(r => this.normalizePrompt(r.name).includes(secondPart) || secondPart.includes(this.normalizePrompt(r.name)));
    if (roomMatch) {
      excludedRoomId = roomMatch.id;
    } else {
      // Try device match
      const exactDevices = allDevices.filter(d => this.normalizePrompt(d.name) === secondPart || secondPart.includes(this.normalizePrompt(d.name)));
      if (exactDevices.length === 1) {
        excludedDeviceId = exactDevices[0].id;
      } else if (exactDevices.length > 1) {
        return { 
          type: 'clarificationRequired', 
          options: exactDevices.map(d => ({ id: d.id, label: d.name, kind: 'device' })),
          originalSegment: secondPart
        };
      } else {
        return { type: 'failure', message: `No pude encontrar qué significa "${secondPart}".` };
      }
    }

    const actions: MultiCommandAction[] = [];
    for (const d of allDevices) {
      if (!this.isControllableDevice(d, command)) continue;

      if (excludedRoomId && d.roomId === excludedRoomId) continue;
      if (excludedDeviceId && d.id === excludedDeviceId) continue;

      actions.push({
        deviceId: d.id,
        command,
        targetName: d.name
      });
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

  private async parseCompound(originalPrompt: string, normalized: string, connectors: string[]): Promise<AssistantMultiCommandResult> {
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
    
    const allDevices = await this.deviceRepository.findAll();
    const allRooms = await this.roomRepository.findAll();

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
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[¿?¡!.,]/g, "")        // Remove punctuation
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
