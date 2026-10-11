import { DateTime } from 'luxon';
import { Scene } from '../../../devices/domain/Scene';
import { Device } from '../../../devices/domain/types';
import { Room } from '../../../topology/domain/types';
import { getAssistantResponseText } from '../response/AssistantResponseCatalog';
import { formatNaturalSpanishTime, getSpanishDayPeriod } from '../NaturalDateTimeFormatter';
import type { AssistantConversationResponse } from './conversationTypes';
import { formatTimerRemaining } from './draftRequestParsing';
import { ConversationCollaborator } from './ConversationCollaborator';

/** Informational answers about the home: capabilities, summary, attention, activity, time and listings. */
export class HomeInfoHandler extends ConversationCollaborator {
  public async handleCapabilitiesGuide(userId: string, language: string): Promise<AssistantConversationResponse> {
    const [devices, rooms, scenes, automations, aliases] = await Promise.all([
      this.deps.permissionGate.getAuthorizedDevices(userId),
      this.deps.permissionGate.getAuthorizedRooms(userId),
      this.deps.permissionGate.getAuthorizedScenes(userId),
      this.deps.permissionGate.getAuthorizedAutomations(userId),
      this.deps.memoryService.getAliases(userId)
    ]);

    const controllableDevices = devices.filter((device: Device) => (
      this.deps.scopeFilter.isControllableDevice(device, 'turn_on') ||
      this.deps.scopeFilter.isControllableDevice(device, 'turn_off') ||
      this.deps.scopeFilter.isControllableDevice(device, 'toggle')
    ));
    const roomNames = rooms.slice(0, 5).map((room: Room) => room.name);
    const sceneNames = scenes.slice(0, 5).map((scene: Scene) => scene.name);
    const aliasNames = Object.keys(aliases).slice(0, 5);

    const esLines = [
      "Soy HomePilot, tu operador residencial local. Estoy para ayudarte a consultar, controlar y organizar la casa con órdenes naturales.",
      "",
      "Puedes pedirme:",
      "• Estado general: \"qué está encendido\", \"qué luces están encendidas\", \"cómo está la casa\".",
      "• Control por estancia: \"apaga la luz de la sala\", \"enciende el escritorio\", \"cierra la cortina del cuarto master\".",
      "• Acciones masivas seguras: \"apaga todo\", \"apaga todas las luces\", \"cierra todas las cortinas\". Te pediré confirmación cuando corresponda.",
      "• Escenas: \"activa escena cine\", \"apaga cuarto master\", \"crea una escena para apagar la sala\".",
      "• Automatizaciones: \"qué automatizaciones tengo\", \"desactiva la rutina de noche\", \"por qué no se ejecutó\".",
      "• Alias y lenguaje personal: \"llama mi cuarto a Cuarto Master\", \"qué aliases tengo\", \"elimina el alias mi cuarto\".",
      "• Seguimiento: \"la primera\", \"esa\", \"sí\", \"no\", \"dame detalles\", \"reintenta la última acción\".",
      "• Voz: puedes invocarme con el activador local, interrumpirme mientras hablo y dictar una nueva orden.",
      "",
      "Límites:",
      "• No soy un buscador general ni respondo temas fuera del hogar.",
      "• Solo puedo operar dispositivos, estancias, escenas, automatizaciones y alias registrados en HomePilot.",
      "• Si una orden es ambigua o masiva, te pediré elegir o confirmar antes de ejecutar."
    ];

    const enLines = [
      "I am HomePilot, your local residential operator. I help you inspect, control, and organize the home with natural commands.",
      "",
      "You can ask me:",
      "• General status: \"what is on\", \"what lights are on\", \"how is the house\".",
      "• Room control: \"turn off the living room light\", \"turn on the desk\", \"close the master bedroom curtain\".",
      "• Safe bulk actions: \"turn everything off\", \"turn off all lights\", \"close all curtains\". I will ask for confirmation when needed.",
      "• Scenes: \"activate cinema scene\", \"turn off master bedroom\", \"create a scene to turn off the living room\".",
      "• Automations: \"what automations do I have\", \"disable night routine\", \"why did it not run\".",
      "• Aliases and personal language: \"call master my room\", \"what aliases do I have\", \"delete my room alias\".",
      "• Follow-ups: \"the first one\", \"that one\", \"yes\", \"no\", \"show details\", \"retry the last action\".",
      "• Voice: you can wake me locally, interrupt me while I am speaking, and dictate a new command.",
      "",
      "Limits:",
      "• I am not a general search assistant and I avoid topics outside the home.",
      "• I can only operate devices, rooms, scenes, automations, and aliases registered in HomePilot.",
      "• If a command is ambiguous or bulk-level, I will ask you to choose or confirm before executing."
    ];

    const lines = language === 'en' ? enLines : esLines;
    const inventoryLabel = language === 'en' ? "Current HomePilot context:" : "Contexto actual de HomePilot:";
    const roomsLabel = language === 'en' ? "rooms" : "estancias";
    const devicesLabel = language === 'en' ? "controllable devices" : "dispositivos controlables";
    const scenesLabel = language === 'en' ? "scenes" : "escenas";
    const automationsLabel = language === 'en' ? "automations" : "automatizaciones";
    const aliasesLabel = language === 'en' ? "aliases" : "aliases";
    const examplesLabel = language === 'en' ? "Examples available now" : "Ejemplos disponibles ahora";
    const noneLabel = language === 'en' ? "none yet" : "ninguno todavía";

    lines.push(
      "",
      `${inventoryLabel} ${rooms.length} ${roomsLabel}, ${controllableDevices.length} ${devicesLabel}, ${scenes.length} ${scenesLabel}, ${automations.length} ${automationsLabel}, ${Object.keys(aliases).length} ${aliasesLabel}.`
    );

    const examples: string[] = [];
    if (roomNames.length > 0) examples.push(`${roomsLabel}: ${roomNames.join(', ')}`);
    if (sceneNames.length > 0) examples.push(`${scenesLabel}: ${sceneNames.join(', ')}`);
    if (aliasNames.length > 0) examples.push(`${aliasesLabel}: ${aliasNames.join(', ')}`);

    lines.push(`${examplesLabel}: ${examples.length > 0 ? examples.join(' | ') : noneLabel}.`);

    return {
      type: 'answer',
      message: lines.join('\n')
    };
  }

  public async handleHomeSummary(language: string, userId: string): Promise<AssistantConversationResponse> {
    const devices = await this.deps.permissionGate.getAuthorizedDevices(userId);
    const active = devices.filter(device => device.lastKnownState?.on === true || device.lastKnownState?.state === 'on').length;
    const unavailable = devices.filter(device => !this.deps.scopeFilter.isDeviceAvailable(device)).length;

    if (language === 'en') {
      return {
        type: 'answer',
        message: devices.length === 0
          ? 'The residence is stable, but no devices are registered yet.'
          : `The residence is stable. ${active} of ${devices.length} devices are active${unavailable > 0 ? `, and ${unavailable} require attention` : ', with none requiring attention'}.`
      };
    }

    return {
      type: 'answer',
      message: devices.length === 0
        ? 'La casa está estable, aunque todavía no hay dispositivos registrados.'
        : `La casa está estable. Hay ${active} de ${devices.length} dispositivos activos${unavailable > 0 ? ` y ${unavailable} requieren atención` : ' y ninguno requiere atención'}.`
    };
  }

  public async handleAttentionQuery(language: string, userId: string): Promise<AssistantConversationResponse> {
    const unavailable = (await this.deps.permissionGate.getAuthorizedDevices(userId))
      .filter(device => !this.deps.scopeFilter.isDeviceAvailable(device));

    if (unavailable.length === 0) {
      return {
        type: 'answer',
        message: language === 'en'
          ? 'No devices require attention right now.'
          : 'No hay dispositivos que requieran atención en este momento.'
      };
    }

    const preview = unavailable.slice(0, 5).map(device => device.name).join(', ');
    const remaining = unavailable.length - 5;
    const suffix = remaining > 0
      ? (language === 'en' ? ', and ' + remaining + ' more.' : ' y ' + remaining + ' más.')
      : '.';

    return {
      type: 'answer',
      message: language === 'en'
        ? unavailable.length + ' devices require attention: ' + preview + suffix
        : unavailable.length + ' dispositivos requieren atención: ' + preview + suffix
    };
  }

  public async handleRecentActivity(language: string): Promise<AssistantConversationResponse> {
    const records = await this.deps.executionRecordRepository.findRecent(5);
    if (records.length === 0) {
      return {
        type: 'answer',
        message: language === 'en'
          ? 'There are no recent residential executions to report.'
          : 'No tengo ejecuciones residenciales recientes que reportar.'
      };
    }

    const latest = records[0];
    const description = latest.summary || `${latest.sourceType} ${latest.sourceId}`;
    return {
      type: 'answer',
      message: language === 'en'
        ? `The latest execution was ${description}, with status ${latest.status}.`
        : `La ejecución más reciente fue ${description}, con estado ${latest.status}.`
    };
  }

  public async handleDateTimeQuery(prompt: string, language: string): Promise<AssistantConversationResponse> {
    const timeZone = await this.deps.systemVariableService.getSystemTimezone();
    console.info(`[ASSISTANT_TIME_QUERY] ${JSON.stringify({ timeZone, language })}`);

    const now = new Date();
    const dateStr = now.toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone
    });
    const timeStr = now.toLocaleTimeString(language === 'en' ? 'en-US' : 'es-ES', {
      hour: '2-digit', minute: '2-digit', timeZone
    });

    let message = "";
    if (prompt.includes('fecha') || prompt.includes(' dia ') || prompt.startsWith('que dia') || prompt.includes(' day ') || prompt.includes('date')) {
      message = language === 'en' ? `Today is ${dateStr}. Residential schedule remains available.` : `Hoy es ${dateStr}. La agenda residencial queda disponible.`;
    } else if (language === 'es' && (prompt.includes('manana') || prompt.includes('tarde') || prompt.includes('noche') || prompt.includes('madrugada'))) {
      const hourPart = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', hourCycle: 'h23', timeZone })
        .formatToParts(now)
        .find(part => part.type === 'hour')?.value;
      const currentPeriod = getSpanishDayPeriod(Number(hourPart ?? 0));
      const requestedPeriod = prompt.includes('madrugada')
        ? 'madrugada'
        : prompt.includes('manana')
          ? 'mañana'
          : prompt.includes('tarde')
            ? 'tarde'
            : 'noche';
      message = currentPeriod === requestedPeriod
        ? `Sí. Es de ${currentPeriod}. ${formatNaturalSpanishTime(now, timeZone)}.`
        : `No. En este momento es de ${currentPeriod}. ${formatNaturalSpanishTime(now, timeZone)}.`;
    } else {
      message = language === 'en'
        ? `It is ${timeStr}. Home systems remain attentive.`
        : `${formatNaturalSpanishTime(now, timeZone)}. La casa permanece atenta.`;
    }

    return {
      type: 'answer',
      message
    };
  }

  public async handleRoomQuery(language: string, userId: string): Promise<AssistantConversationResponse> {
    const rooms = await this.deps.permissionGate.getAuthorizedRooms(userId);
    if (rooms.length === 0) {
      return {
        type: 'answer',
        message: language === 'en' ? "I don't know any rooms yet." : "Aún no conozco ninguna estancia."
      };
    }

    await this.deps.memoryService.saveShortTermMemory(userId, {
      lastQueryType: 'room_inventory',
      entities: rooms.map((room) => ({ id: room.id, name: room.name, type: 'room', roomId: room.id })),
      timestamp: new Date().toISOString()
    });
    const roomList = rooms.map((r: Room) => `• ${r.name}`).join('\n');
    return {
      type: 'answer',
      message: language === 'en'
        ? `Here are the rooms you have:\n${roomList}`
        : `Claro. Estas son las estancias que tienes:\n${roomList}`
    };
  }

  public async handleListScenes(language: string, userId: string): Promise<AssistantConversationResponse> {
    const scenes = await this.deps.permissionGate.getAuthorizedScenes(userId);
    if (scenes.length === 0) {
      return { type: 'answer', message: getAssistantResponseText('listing.scenes_empty', language, {}) };
    }
    const list = scenes.map(s => `• ${s.name}`).join('\n');
    return {
      type: 'answer',
      message: getAssistantResponseText('listing.scenes', language, { list })
    };
  }

  public async handleListTimers(language: string, userId: string): Promise<AssistantConversationResponse> {
    const now = DateTime.now();
    const timers = (await this.deps.permissionGate.getAuthorizedAutomations(userId)).flatMap((automation) => {
      if (!automation.enabled || automation.trigger.type !== 'time' || !automation.trigger.dateLocal) return [];
      const scheduledAt = DateTime.fromFormat(
        `${automation.trigger.dateLocal} ${automation.trigger.timeLocal}`,
        'yyyy-MM-dd HH:mm',
        { zone: automation.trigger.timezone }
      );
      if (!scheduledAt.isValid || scheduledAt.toMillis() <= now.toMillis()) return [];
      return [{ automation, scheduledAt }];
    });

    if (timers.length === 0) {
      return { type: 'answer', message: getAssistantResponseText('listing.timers_empty', language, {}) };
    }

    const list = timers.map(({ automation, scheduledAt }) => {
      const remaining = formatTimerRemaining(scheduledAt.diff(now, 'seconds').seconds, language);
      return language === 'en'
        ? `• ${automation.name} — ${remaining} remaining`
        : `• ${automation.name} — faltan ${remaining}`;
    }).join('\n');
    return { type: 'answer', message: getAssistantResponseText('listing.timers', language, { list }) };
  }

  public async handleListAutomations(language: string, userId: string): Promise<AssistantConversationResponse> {
    const automations = await this.deps.permissionGate.getAuthorizedAutomations(userId);
    if (automations.length === 0) {
      return { type: 'answer', message: getAssistantResponseText('listing.automations_empty', language, {}) };
    }
    const list = automations.map((automation) => getAssistantResponseText('listing.automation_status', language, { name: automation.name, enabled: automation.enabled })).join('\n');
    return {
      type: 'answer',
      message: getAssistantResponseText('listing.automations', language, { list })
    };
  }
}
