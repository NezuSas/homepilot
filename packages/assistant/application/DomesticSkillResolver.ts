import { Device } from '../../devices/domain/types';
import { Room } from '../../topology/domain/types';
import { Scene } from '../../devices/domain/Scene';
import { AssistantMemoryEntity } from './ports/AssistantMemoryPort';
import { PermissionGate } from './PermissionGate';
import { ScopeFilter } from './ScopeFilter';
import { normalizeAssistantPrompt } from './AssistantPromptNormalizer';

export type DomesticSkill = 'home_insight' | 'room_comfort' | 'night_options' | 'scene_discovery' | 'scene_inventory';

export interface DomesticSkillContext {
  room?: Room;
  entities: AssistantMemoryEntity[];
}

export interface DomesticSkillResult {
  skill: DomesticSkill;
  message: string;
  context: DomesticSkillContext;
}

interface ResolvedRoom {
  kind: 'resolved';
  room: Room;
}

interface MissingRoom {
  kind: 'missing';
}

interface AmbiguousRoom {
  kind: 'ambiguous';
  rooms: Room[];
}

type RoomResolution = ResolvedRoom | MissingRoom | AmbiguousRoom;

/**
 * Resolves bounded, non-executing household skills from authorized HomePilot
 * data. It deliberately does not call an LLM: this path provides quick,
 * factual help when a user expresses a domestic goal rather than a direct
 * device command.
 */
export class DomesticSkillResolver {
  private readonly scopeFilter = new ScopeFilter();

  constructor(private readonly permissionGate: PermissionGate) {}

  public async resolve(
    prompt: string,
    userId: string,
    language: 'es' | 'en'
  ): Promise<DomesticSkillResult | null> {
    const normalized = normalizeAssistantPrompt(prompt);
    const skill = this.resolveSkill(normalized);
    if (!skill) return null;

    const [devices, rooms, scenes] = await Promise.all([
      this.permissionGate.getAuthorizedDevices(userId),
      this.permissionGate.getAuthorizedRooms(userId),
      this.permissionGate.getAuthorizedScenes(userId)
    ]);

    switch (skill) {
      case 'home_insight':
        return this.buildHomeInsight(devices, language);
      case 'room_comfort':
        return this.buildRoomComfort(normalized, devices, rooms, scenes, language);
      case 'night_options':
        return this.buildNightOptions(devices, rooms, scenes, language);
      case 'scene_inventory':
        return this.buildSceneInventory(scenes, language);
      case 'scene_discovery':
        return this.buildSceneDiscovery(normalized, scenes, language);
    }

    return null;
  }

  private resolveSkill(normalized: string): DomesticSkill | null {
    if (this.isHomeInsightRequest(normalized)) return 'home_insight';
    if (this.isRoomComfortRequest(normalized)) return 'room_comfort';
    if (this.isNightOptionsRequest(normalized)) return 'night_options';
    if (this.isSceneInventoryRequest(normalized)) return 'scene_inventory';
    if (this.isSceneDiscoveryRequest(normalized)) return 'scene_discovery';

    return null;
  }

  private isHomeInsightRequest(normalized: string): boolean {
    return [
      'dime algo interesante sobre mi casa',
      'cuentame algo interesante sobre mi casa',
      'cuentame algo de mi casa',
      'que hay interesante en mi casa',
      'tell me something interesting about my home',
      'tell me something about my home',
      'what is interesting about my home'
    ].some((phrase) => normalized.includes(phrase));
  }

  private isRoomComfortRequest(normalized: string): boolean {
    const comfortTerms = ['acogedor', 'acogedora', 'comodo', 'comoda', 'relajado', 'relajada', 'relajante', 'tranquilo', 'tranquila', 'agradable', 'cozy', 'comfortable', 'relaxing', 'calm'];
    const activityTerms = ['pelicula', 'cine', 'movie', 'cinema'];
    const homeTerms = ['sala', 'salon', 'cuarto', 'habitacion', 'room', 'living', 'bedroom', 'estancia'];
    return (comfortTerms.some((term) => normalized.includes(term)) || activityTerms.some((term) => normalized.includes(term)))
      && (homeTerms.some((term) => normalized.includes(term)) || normalized.includes('ambiente'));
  }

  private isNightOptionsRequest(normalized: string): boolean {
    return [
      'preparar la casa para dormir',
      'preparame la casa para dormir',
      'preparar mi casa para dormir',
      'que puedo hacer para preparar la casa para dormir',
      'que opciones tengo para la noche',
      'que puedo hacer esta noche en casa',
      'prepare the house for sleep',
      'prepare my home for sleep',
      'what can i do tonight at home',
      'what are my options for tonight'
    ].some((phrase) => normalized.includes(phrase));
  }

  private isSceneInventoryRequest(normalized: string): boolean {
    return [
      'que escenas hay',
      'cuales escenas hay',
      'que escenas tengo',
      'cuales escenas tengo',
      'escenas disponibles',
      'what scenes are available',
      'which scenes are available',
      'what scenes do i have',
      'list scenes'
    ].some((phrase) => normalized.includes(phrase));
  }

  private isSceneDiscoveryRequest(normalized: string): boolean {
    if (/\b(activa|activar|activate|run|ejecuta|ejecutar)\b/.test(normalized)) {
      return false;
    }

    const sceneTerms = ['escena', 'scene', 'pelicula', 'película', 'cine', 'movie'];
    return sceneTerms.some((term) => normalized.includes(term));
  }

  private buildHomeInsight(devices: Device[], language: 'es' | 'en'): DomesticSkillResult {
    const available = devices.filter((device) => this.scopeFilter.isDeviceAvailable(device));
    const active = available.filter((device) => this.isActive(device));
    const unavailable = devices.filter((device) => !this.scopeFilter.isDeviceAvailable(device));
    const lights = available.filter((device) => this.scopeFilter.isLightEntity(device));

    const availableLabel = available.length === 1 ? 'device' : 'devices';
    const activeLabel = active.length === 1 ? 'device' : 'devices';
    const spanishAvailableLabel = available.length === 1 ? 'dispositivo' : 'dispositivos';
    const spanishActiveLabel = active.length === 1 ? 'dispositivo activo' : 'dispositivos activos';
    const message = language === 'en'
      ? `Your home currently has ${available.length} available ${availableLabel}, ${active.length} active ${activeLabel}${unavailable.length > 0 ? `, and ${unavailable.length} requiring attention` : ''}. ${lights.length > 0 ? `${lights.length} ${lights.length === 1 ? 'is a light' : 'are lights'} you can control.` : ''}`.trim()
      : `Tu casa tiene actualmente ${available.length} ${spanishAvailableLabel} disponible${available.length === 1 ? '' : 's'} y ${active.length} ${spanishActiveLabel}${unavailable.length > 0 ? ` y ${unavailable.length} que requieren atención` : ''}. ${lights.length > 0 ? `${lights.length} ${lights.length === 1 ? 'es una luz que puedes controlar' : 'son luces que puedes controlar'}.` : ''}`.trim();

    return {
      skill: 'home_insight',
      message,
      context: { entities: [] }
    };
  }

  private buildRoomComfort(
    normalized: string,
    devices: Device[],
    rooms: Room[],
    scenes: Scene[],
    language: 'es' | 'en'
  ): DomesticSkillResult {
    const resolution = this.resolveRoom(normalized, rooms);
    if (resolution.kind === 'missing') {
      return {
        skill: 'room_comfort',
        message: language === 'en'
          ? 'Which room would you like to make more comfortable?'
          : '¿Qué estancia quieres hacer más cómoda?',
        context: { entities: [] }
      };
    }

    if (resolution.kind === 'ambiguous') {
      const names = resolution.rooms.map((room) => room.name).join(', ');
      return {
        skill: 'room_comfort',
        message: language === 'en'
          ? `I found several rooms that could match: ${names}. Which one do you mean?`
          : `Encontré varias estancias que podrían coincidir: ${names}. ¿Cuál quieres usar?`,
        context: { entities: [] }
      };
    }

    const roomDevices = devices.filter((device) => device.roomId === resolution.room.id && this.scopeFilter.isDeviceAvailable(device));
    const lights = roomDevices.filter((device) => this.scopeFilter.isLightEntity(device) && this.scopeFilter.isControllableDevice(device, 'turn_on'));
    const covers = roomDevices.filter((device) => this.isControllableCover(device));
    const roomScenes = scenes.filter((scene) => scene.roomId === resolution.room.id);
    const activityTerms = this.sceneTermsForPrompt(normalized);
    const activityScenes = roomScenes.filter((scene) => activityTerms.some((term) => normalizeAssistantPrompt(scene.name).includes(term)));
    const comfortScenes = roomScenes.filter((scene) => this.isComfortScene(scene));
    const recommendedScenes = activityScenes.length > 0
      ? activityScenes
      : comfortScenes.length > 0 ? comfortScenes : roomScenes;

    const parts: string[] = [];
    if (recommendedScenes.length > 0) {
      parts.push(language === 'en'
        ? `Available scenes: ${this.listNames(recommendedScenes)}.`
        : `Escenas disponibles: ${this.listNames(recommendedScenes)}.`);
    }
    if (lights.length > 0) {
      parts.push(language === 'en'
        ? `Controllable lights: ${this.listNames(lights)}.`
        : `Luces controlables: ${this.listNames(lights)}.`);
    }
    if (covers.length > 0) {
      parts.push(language === 'en'
        ? `Controllable covers: ${this.listNames(covers)}.`
        : `Cortinas o persianas controlables: ${this.listNames(covers)}.`);
    }

    const message = parts.length > 0
      ? (language === 'en'
        ? `To make ${resolution.room.name} more comfortable, these options are available:\n${parts.map((part) => `• ${part}`).join('\n')}`
        : `Para crear un ambiente más cómodo en ${resolution.room.name}, tienes estas opciones:\n${parts.map((part) => `• ${part}`).join('\n')}`)
      : (language === 'en'
        ? `I did not find controllable lights, covers, or scenes in ${resolution.room.name} to recommend yet.`
        : `Todavía no encontré luces, cortinas o escenas controlables en ${resolution.room.name} para recomendar.`);

    return {
      skill: 'room_comfort',
      message,
      context: {
        room: resolution.room,
        entities: [...recommendedScenes, ...lights, ...covers].slice(0, 8).map((entity) => this.toMemoryEntity(entity, resolution.room))
      }
    };
  }

  private buildNightOptions(
    devices: Device[],
    rooms: Room[],
    scenes: Scene[],
    language: 'es' | 'en'
  ): DomesticSkillResult {
    const activeLights = devices.filter((device) => this.scopeFilter.isDeviceAvailable(device) && this.scopeFilter.isLightEntity(device) && this.isActive(device));
    const covers = devices.filter((device) => this.scopeFilter.isDeviceAvailable(device) && this.isControllableCover(device));
    const nightScenes = scenes.filter((scene) => this.isNightScene(scene));
    const parts: string[] = [];

    if (nightScenes.length > 0) {
      parts.push(language === 'en'
        ? `Available night scenes: ${this.listNames(nightScenes)}.`
        : `Escenas nocturnas disponibles: ${this.listNames(nightScenes)}.`);
    }
    if (activeLights.length > 0) {
      parts.push(language === 'en'
        ? `Lights currently on: ${this.listNames(activeLights)}.`
        : `Luces encendidas actualmente: ${this.listNames(activeLights)}.`);
    }
    if (covers.length > 0) {
      const coverRoomNames = new Map(rooms.map((room) => [room.id, room.name]));
      const labels = covers.map((cover) => cover.roomId ? `${cover.name} (${coverRoomNames.get(cover.roomId) ?? ''})`.trim() : cover.name);
      parts.push(language === 'en'
        ? `Controllable covers: ${this.listLabels(labels)}.`
        : `Cortinas o persianas controlables: ${this.listLabels(labels)}.`);
    }

    const message = parts.length > 0
      ? (language === 'en'
        ? `When you are ready for the night, I can help with:\n${parts.map((part) => `• ${part}`).join('\n')}`
        : `Cuando quieras preparar la casa para la noche, puedo ayudarte con:\n${parts.map((part) => `• ${part}`).join('\n')}`)
      : (language === 'en'
        ? 'I did not find a night scene, active light, or controllable cover to prepare right now.'
        : 'No encontré una escena nocturna, luz encendida o cortina controlable para preparar en este momento.');

    return {
      skill: 'night_options',
      message,
      context: { entities: [...nightScenes, ...activeLights, ...covers].slice(0, 8).map((entity) => this.toMemoryEntity(entity)) }
    };
  }

  private buildSceneInventory(scenes: Scene[], language: 'es' | 'en'): DomesticSkillResult {
    const listedScenes = scenes.slice(0, 8);
    const suffix = scenes.length > listedScenes.length
      ? (language === 'en' ? `\n• And ${scenes.length - listedScenes.length} more.` : `\n• Y ${scenes.length - listedScenes.length} más.`)
      : '';
    const message = scenes.length === 0
      ? (language === 'en' ? 'There are no available scenes in your home yet.' : 'Todavía no hay escenas disponibles en tu casa.')
      : `${language === 'en' ? 'These scenes are available in your home:' : 'Estas escenas están disponibles en tu casa:'}\n${listedScenes.map((scene) => `• ${scene.name}`).join('\n')}${suffix}`;

    return {
      skill: 'scene_inventory',
      message,
      context: { entities: listedScenes.map((scene) => this.toMemoryEntity(scene)) }
    };
  }
  private buildSceneDiscovery(normalized: string, scenes: Scene[], language: 'es' | 'en'): DomesticSkillResult {
    const sceneTerms = this.sceneTermsForPrompt(normalized);
    const matchingScenes = scenes.filter((scene) => sceneTerms.some((term) => normalizeAssistantPrompt(scene.name).includes(term)));
    const message = matchingScenes.length > 0
      ? (language === 'en'
        ? `I found these available scenes: ${this.listNames(matchingScenes)}.`
        : `Encontré estas escenas disponibles: ${this.listNames(matchingScenes)}.`)
      : (language === 'en'
        ? 'I did not find an available scene that matches that activity.'
        : 'No encontré una escena disponible que coincida con esa actividad.');

    return {
      skill: 'scene_discovery',
      message,
      context: { entities: matchingScenes.slice(0, 8).map((scene) => this.toMemoryEntity(scene)) }
    };
  }

  private resolveRoom(normalized: string, rooms: Room[]): RoomResolution {
    const explicitMatches = rooms.filter((room) => normalized.includes(normalizeAssistantPrompt(room.name)));
    if (explicitMatches.length === 1) return { kind: 'resolved', room: explicitMatches[0] };
    if (explicitMatches.length > 1) return { kind: 'ambiguous', rooms: explicitMatches };

    const roomTerms = this.roomTerms(normalized);
    const partialMatches = rooms.filter((room) => {
      const roomName = normalizeAssistantPrompt(room.name);
      return roomTerms.some((term) => roomName.includes(term));
    });
    if (partialMatches.length === 1) return { kind: 'resolved', room: partialMatches[0] };
    if (partialMatches.length > 1) return { kind: 'ambiguous', rooms: partialMatches };
    return { kind: 'missing' };
  }

  private roomTerms(normalized: string): string[] {
    const terms: string[] = [];
    if (/\bsala\b|\bsalon\b|\bliving room\b/.test(normalized)) terms.push('sala', 'salon', 'estar', 'living');
    if (/\bcuarto\b|\bhabitacion\b|\bbedroom\b/.test(normalized)) terms.push('cuarto', 'habitacion', 'bedroom', 'master');
    if (/\bcocina\b|\bkitchen\b/.test(normalized)) terms.push('cocina', 'kitchen');
    if (/\boficina\b|\boffice\b|\btech\b/.test(normalized)) terms.push('oficina', 'office', 'tech');
    return terms;
  }

  private sceneTermsForPrompt(normalized: string): string[] {
    if (/\bpelicula\b|\bcine\b|\bmovie\b/.test(normalized)) return ['pelicula', 'cine', 'movie'];
    if (/\brelaj/.test(normalized)) return ['relaj', 'relax'];
    if (/\btranquil|\bcalm/.test(normalized)) return ['tranquil', 'calm'];
    if (/\bnoche\b|\bdorm/.test(normalized)) return ['noche', 'dorm', 'night', 'sleep'];
    return [];
  }

  private isComfortScene(scene: Scene): boolean {
    return /cine|pelicula|movie|relaj|relax|ambiente|cozy|comfort|tranquil|calm/i.test(scene.name);
  }

  private isNightScene(scene: Scene): boolean {
    return /noche|dorm|night|sleep/i.test(scene.name);
  }

  private isControllableCover(device: Device): boolean {
    return this.scopeFilter.isControllableDevice(device, 'open') || this.scopeFilter.isControllableDevice(device, 'close');
  }

  private isActive(device: Device): boolean {
    return device.lastKnownState?.on === true || device.lastKnownState?.state === 'on' || device.lastKnownState?.power === 'on';
  }

  private toMemoryEntity(entity: Device | Scene, room?: Room): AssistantMemoryEntity {
    const isDevice = 'type' in entity;
    return {
      id: entity.id,
      name: entity.name,
      type: isDevice ? entity.type : 'scene',
      roomId: isDevice ? entity.roomId : entity.roomId,
      roomName: room?.name
    };
  }

  private listNames(entities: ReadonlyArray<{ name: string }>): string {
    return this.listLabels(entities.map((entity) => entity.name));
  }

  private listLabels(labels: string[]): string {
    const unique = Array.from(new Set(labels.filter((label) => label.length > 0)));
    const preview = unique.slice(0, 4);
    const remaining = unique.length - preview.length;
    return remaining > 0 ? `${preview.join(', ')} y ${remaining} más` : preview.join(', ');
  }
}
