export type AssistantResponseCatalogLanguage = 'es' | 'en';

export type AssistantResponseCatalogParameters = {
  'quick.greeting': { userName?: string | null };
  'quick.wellness': Record<never, never>;
  'quick.name': Record<never, never>;
  'profile.preferred_address': { address: string };
  'profile.tone': { tone: 'neutral' | 'warm' | 'formal' };
  'preference.response_style': { preference: 'concise' | 'standard' | 'detailed' };
  'preference.detail_offer': Record<never, never>;
  'language.updated': Record<never, never>;
  'action.cancelled': Record<never, never>;
  'confirmation.expired': Record<never, never>;
  'alias.deleted': { alias: string };
  'draft.activated': { draftType?: 'scene' | 'routine' };
  'draft.room_required': { draftType: 'scene' | 'routine' };
  'draft.action_required': { draftType: 'scene' | 'routine' };
  'draft.time_required': Record<never, never>;
  'draft.prepared': { draftType: 'scene' | 'routine'; name: string; command: 'turn_on' | 'turn_off'; count: number; roomName: string; time?: string };
  'draft.activation_failed': Record<never, never>;
  'draft.cancelled': { draftType?: 'scene' | 'routine' };
  'confirmation.none_pending': Record<never, never>;
  'confirmation.are_you_sure': Record<never, never>;
  'selection.follow_up_selected': { label: string };
  'clarification.pronoun_multiple_options': Record<never, never>;
  'clarification.which_one': Record<never, never>;
  'clarification.which_one_do_you_mean': Record<never, never>;
  'clarification.intent_multiple_matches': { segment: string };
  'listing.scenes_empty': Record<never, never>;
  'listing.scenes': { list: string };
  'listing.automation_status': { name: string; enabled: boolean };
  'listing.automations_empty': Record<never, never>;
  'listing.automations': { list: string };
  'management.scene_not_found': { name: string };
  'management.automation_not_found': { name: string };
  'management.device_not_found': { name: string };
  'management.device_not_in_scene': { name: string };
  'management.rename_scene_confirmation': { sceneName: string; newName: string };
  'management.toggle_automation_confirmation': { name: string; enabled: boolean };
  'management.add_device_confirmation': { deviceName: string; sceneName: string };
  'management.remove_device_confirmation': { deviceName: string; sceneName: string };
  'management.room_name_required': Record<never, never>;
  'management.room_rename_details_required': Record<never, never>;
  'management.room_deletion_name_required': Record<never, never>;
  'management.room_already_exists': { name: string };
  'management.room_not_found': { name: string };
  'management.create_room_confirmation': { name: string };
  'management.room_created': { name: string };
  'management.rename_room_confirmation': { currentName: string; newName: string };
  'management.room_renamed': { name: string };
  'management.delete_room_confirmation': { name: string; unassignedDevices: number };
  'management.room_deleted': { name: string; unassignedDevices: number };
  'management.unsupported_action': Record<never, never>;
  'management.scene_renamed': { name: string };
  'management.automation_toggled': { name: string; enabled: boolean };
  'management.scene_updated': { name: string };
  'management.execution_failed': Record<never, never>;
  'confirmation.confirm': Record<never, never>;
  'confirmation.yes': Record<never, never>;
  'confirmation.no': Record<never, never>;
  'command.not_understood': Record<never, never>;
  'execution.failed': Record<never, never>;
  'execution.unknown_error': Record<never, never>;
  'selection.invalid': Record<never, never>;
  'selection.target_required': Record<never, never>;
  'resolution.device_not_found': { targetPhrase: string };
  'clarification.vague_light_room': Record<never, never>;
  'clarification.vague_light_room_example': Record<never, never>;
  'clarification.device_multiple_matches': Record<never, never>;
  'clarification.device_multiple_matches_question': Record<never, never>;
  'confirmation.generic_proceed': Record<never, never>;
  'confirmation.generic_proceed_yes': Record<never, never>;
  'confirmation.generic_proceed_no': Record<never, never>;
  'scene.not_found': Record<never, never>;
  'scene.execution_started': Record<never, never>;
  'confirmation.device_control': { deviceName: string };
  'confirmation.multi_action': { count: number; actionSummary: string };
  'confirmation.multi_action_yes': Record<never, never>;
  'confirmation.multi_action_no': Record<never, never>;
  'intent.not_recognized': Record<never, never>;
  'fuzzy.suggestion': { targetPhrase: string; deviceName: string };
  'fuzzy.question': { deviceName: string };
  'fuzzy.not_found': { targetPhrase: string };
  'state.detail_no_devices': Record<never, never>;
  'state.room_ambiguous': Record<never, never>;
  'state.room_not_found': Record<never, never>;
  'state.room_selection_required': Record<never, never>;
  'state.room_selection_question': Record<never, never>;
  'state.no_targets_in_room': { entityLabel: string; roomName: string };
  'state.no_matching_targets': Record<never, never>;
  'state.inventory_count': { count: number; itemLabel: string; roomSuffix: string };
  'state.room_no_controllable': { roomName: string };
  'state.room_all_off': { roomName: string };
  'state.room_all_on': { roomName: string };
  'state.room_summary': { onCount: number; total: number; roomName: string };
  'state.device_not_found': Record<never, never>;
  'state.device_multiple_matches': Record<never, never>;
  'state.device_query_on': { deviceName: string; isOn: boolean };
  'state.device_query_off': { deviceName: string; isOff: boolean };
  'state.device_status': { deviceName: string; isOn: boolean };
  'sensor.reading': { name: string; value: string; unit: string };
  'sensor.unavailable': { name: string };
  'sensor.not_found': Record<never, never>;
  'sensor.selection_unavailable': Record<never, never>;
  'sensor.clarification': Record<never, never>;
  'sensor.clarification_question': Record<never, never>;
};

export type AssistantResponseMessageKey = keyof AssistantResponseCatalogParameters;

type AssistantResponseTemplate<TKey extends AssistantResponseMessageKey> = (
  parameters: AssistantResponseCatalogParameters[TKey]
) => string;

type AssistantResponseCatalog = {
  [TKey in AssistantResponseMessageKey]: Record<
    AssistantResponseCatalogLanguage,
    AssistantResponseTemplate<TKey>
  >;
};

const responseCatalog: AssistantResponseCatalog = {
  'quick.greeting': {
    es: ({ userName }) => `A la orden${userName ? `, ${userName}` : ''}. La casa está atenta.`,
    en: ({ userName }) => `At your service${userName ? `, ${userName}` : ''}. The residence is standing by.`,
  },
  'quick.wellness': {
    es: () => 'Operando con normalidad. Control local, voz y sistemas residenciales atentos.',
    en: () => 'Operating normally. Local control, voice services, and residential systems are standing by.',
  },
  'quick.name': {
    es: () => 'Soy HomePilot, tu operador residencial local.',
    en: () => 'I am HomePilot, your local residential operator.',
  },
  'profile.preferred_address': {
    es: ({ address }) => `Entendido. Me dirigiré a ti como ${address} en la conversación general.`,
    en: ({ address }) => `Understood. I will address you as ${address} in general conversation.`,
  },
  'profile.tone': {
    es: ({ tone }) => `Entendido. Usaré un tono ${({ neutral: 'neutral', warm: 'cálido', formal: 'formal' }[tone])} en la conversación general.`,
    en: ({ tone }) => `Understood. I will use a ${({ neutral: 'neutral', warm: 'warm', formal: 'formal' }[tone])} tone in general conversation.`,
  },
  'preference.response_style': {
    es: ({ preference }) => ({
      concise: 'Entendido. Responderé de forma breve.',
      standard: 'Entendido. Responderé de forma normal.',
      detailed: 'Entendido. Incluiré más detalle cuando sea útil.',
    }[preference]),
    en: ({ preference }) => ({
      concise: 'Understood. I will keep my responses concise.',
      standard: 'Understood. I will use a balanced response style.',
      detailed: 'Understood. I will include more detail when useful.',
    }[preference]),
  },
  'preference.detail_offer': {
    es: () => ' Puedo ampliar cualquier parte si te sirve.',
    en: () => ' I can expand on any part if useful.',
  },
  'language.updated': {
    es: () => 'Perfecto. A partir de ahora hablaré en español.',
    en: () => "Got it. I'll speak in English from now on.",
  },
  'action.cancelled': {
    es: () => 'Acción cancelada.',
    en: () => 'Action cancelled.',
  },
  'confirmation.expired': {
    es: () => 'La confirmación ya venció. Indícame nuevamente la acción que deseas realizar.',
    en: () => 'That confirmation has expired. Please tell me again which action you want to perform.',
  },
  'alias.deleted': {
    es: ({ alias }) => `Listo, eliminé el alias '${alias}'.`,
    en: ({ alias }) => `Done, I deleted the alias '${alias}'.`,
  },
  'draft.activated': {
    es: ({ draftType }) => draftType === 'routine' ? 'Listo. Rutina activada correctamente.' : 'Listo. Escena activada correctamente. Sistemas alineados.',
    en: ({ draftType }) => draftType === 'routine' ? 'Ready. Routine activated successfully.' : 'Ready. Scene activated successfully. Systems aligned.',
  },
  'draft.activation_failed': {
    es: () => 'No se pudo activar la escena.',
    en: () => 'Failed to activate draft.',
  },
  'draft.cancelled': {
    es: ({ draftType }) => `Entendido, no activé la ${draftType === 'routine' ? 'rutina' : 'escena'}.`,
    en: ({ draftType }) => `Understood, I didn't activate the ${draftType === 'routine' ? 'routine' : 'scene'}.`,
  },
  'draft.room_required': {
    es: ({ draftType }) => `Para crear la ${draftType === 'routine' ? 'rutina' : 'escena'}, indícame la estancia.`,
    en: ({ draftType }) => `To create the ${draftType === 'routine' ? 'routine' : 'scene'}, tell me which room it belongs to.`,
  },
  'draft.action_required': {
    es: ({ draftType }) => `Para crear la ${draftType === 'routine' ? 'rutina' : 'escena'}, indícame qué debe hacer, por ejemplo encender o apagar las luces.`,
    en: ({ draftType }) => `To create the ${draftType === 'routine' ? 'routine' : 'scene'}, tell me what it should do, for example turn lights on or off.`,
  },
  'draft.time_required': {
    es: () => 'Para crear la rutina, indícame la hora local, por ejemplo a las 22:30.',
    en: () => 'To create the routine, tell me the local time, for example at 22:30.',
  },
  'draft.prepared': {
    es: ({ draftType, name, command, count, roomName, time }) => `Preparé ${draftType === 'scene' ? 'la escena' : 'la rutina'} "${name}" para ${command === 'turn_on' ? 'encender' : 'apagar'} ${count} dispositivo${count === 1 ? '' : 's'} en ${roomName}${time ? ` a las ${time}` : ''}. ¿Quieres activarla ahora?`,
    en: ({ draftType, name, command, count, roomName, time }) => `I prepared the ${draftType === 'routine' ? 'routine' : 'scene'} "${name}" to ${command === 'turn_on' ? 'turn on' : 'turn off'} ${count} device${count === 1 ? '' : 's'} in ${roomName}${time ? ` at ${time}` : ''}. Do you want to activate it now?`,
  },
  'confirmation.none_pending': {
    es: () => '¿Confirmar qué? No tengo ninguna acción pendiente.',
    en: () => "Confirm what? I don't have any pending actions.",
  },
  'confirmation.are_you_sure': {
    es: () => '¿Estás seguro?',
    en: () => '¿Are you sure?',
  },
  'selection.follow_up_selected': {
    es: ({ label }) => `Seleccioné ${label}. ¿Qué quieres hacer con este dispositivo?`,
    en: ({ label }) => `I've selected ${label}. What would you like to do with it?`,
  },
  'clarification.pronoun_multiple_options': {
    es: () => 'Encontré varias opciones para eso. ¿A cuál te refieres?',
    en: () => 'I found several options for that. Which one do you mean?',
  },
  'clarification.which_one': {
    es: () => '¿Cuál?',
    en: () => 'Which one?',
  },
  'clarification.which_one_do_you_mean': {
    es: () => '¿A cuál te refieres?',
    en: () => 'Which one do you mean?',
  },
  'clarification.intent_multiple_matches': {
    es: ({ segment }) => `Encontré varias opciones para "${segment}".`,
    en: ({ segment }) => `I found multiple matches for "${segment}".`,
  },
  'listing.scenes_empty': {
    es: () => 'Aún no tienes escenas creadas.',
    en: () => "You don't have any scenes created yet.",
  },
  'listing.scenes': {
    es: ({ list }) => `Estas son tus escenas:\n${list}`,
    en: ({ list }) => `These are your scenes:\n${list}`,
  },
  'listing.automation_status': {
    es: ({ name, enabled }) => `• ${name} — ${enabled ? 'activa' : 'inactiva'}`,
    en: ({ name, enabled }) => `• ${name} — ${enabled ? 'active' : 'inactive'}`,
  },
  'listing.automations_empty': {
    es: () => 'Aún no tienes automatizaciones.',
    en: () => "You don't have any automations yet.",
  },
  'listing.automations': {
    es: ({ list }) => `Estas son tus automatizaciones:\n${list}`,
    en: ({ list }) => `These are your automations:\n${list}`,
  },
  'management.scene_not_found': {
    es: ({ name }) => `No encontré la escena "${name}".`,
    en: ({ name }) => `Scene "${name}" not found.`,
  },
  'management.automation_not_found': {
    es: ({ name }) => `No encontré la automatización "${name}".`,
    en: ({ name }) => `Automation "${name}" not found.`,
  },
  'management.device_not_found': {
    es: ({ name }) => `No encontré el dispositivo "${name}".`,
    en: ({ name }) => `Device "${name}" not found.`,
  },
  'management.device_not_in_scene': {
    es: ({ name }) => `El dispositivo "${name}" no está en la escena.`,
    en: ({ name }) => `Device "${name}" is not in the scene.`,
  },
  'management.rename_scene_confirmation': {
    es: ({ sceneName, newName }) => `Voy a renombrar la escena "${sceneName}" a "${newName}". ¿Confirmo?`,
    en: ({ sceneName, newName }) => `I'm going to rename the scene "${sceneName}" to "${newName}". Confirm?`,
  },
  'management.toggle_automation_confirmation': {
    es: ({ name, enabled }) => `Voy a ${enabled ? 'activar' : 'desactivar'} la automatización "${name}". ¿Confirmo?`,
    en: ({ name, enabled }) => `I'm going to ${enabled ? 'enable' : 'disable'} the automation "${name}". Confirm?`,
  },
  'management.add_device_confirmation': {
    es: ({ deviceName, sceneName }) => `Voy a agregar "${deviceName}" (apagado) a la escena "${sceneName}". ¿Confirmo?`,
    en: ({ deviceName, sceneName }) => `I'm going to add "${deviceName}" (off) to the scene "${sceneName}". Confirm?`,
  },
  'management.remove_device_confirmation': {
    es: ({ deviceName, sceneName }) => `Voy a quitar "${deviceName}" de la escena "${sceneName}". ¿Confirmo?`,
    en: ({ deviceName, sceneName }) => `I'm going to remove "${deviceName}" from the scene "${sceneName}". Confirm?`,
  },
  'management.room_name_required': {
    es: () => 'Sí. Dime el nombre de la nueva estancia, por ejemplo: crea una estancia llamada Biblioteca.',
    en: () => 'Yes. Tell me the name of the new room, for example: create a room called Library.',
  },
  'management.room_rename_details_required': {
    es: () => 'Dime qué estancia deseas renombrar y el nuevo nombre, por ejemplo: renombra la estancia Biblioteca a Estudio.',
    en: () => 'Tell me which room to rename and its new name, for example: rename the room Library to Study.',
  },
  'management.room_deletion_name_required': {
    es: () => 'Dime qué estancia deseas eliminar, por ejemplo: elimina la estancia Biblioteca.',
    en: () => 'Tell me which room to delete, for example: delete the room Library.',
  },
  'management.room_already_exists': {
    es: ({ name }) => `Ya existe una estancia llamada "${name}".`,
    en: ({ name }) => `A room named "${name}" already exists.`,
  },
  'management.room_not_found': {
    es: ({ name }) => `No encontré la estancia "${name}".`,
    en: ({ name }) => `Room "${name}" not found.`,
  },
  'management.create_room_confirmation': {
    es: ({ name }) => `Voy a crear la estancia "${name}". ¿Confirmo?`,
    en: ({ name }) => `I'm going to create the room "${name}". Confirm?`,
  },
  'management.room_created': {
    es: ({ name }) => `Listo, creé la estancia "${name}".`,
    en: ({ name }) => `Ready, created the room "${name}".`,
  },
  'management.rename_room_confirmation': {
    es: ({ currentName, newName }) => `Voy a cambiar el nombre de la estancia "${currentName}" a "${newName}". ¿Confirmo?`,
    en: ({ currentName, newName }) => `I'm going to rename the room "${currentName}" to "${newName}". Confirm?`,
  },
  'management.room_renamed': {
    es: ({ name }) => `Listo, la estancia ahora se llama "${name}".`,
    en: ({ name }) => `Ready, the room is now named "${name}".`,
  },
  'management.delete_room_confirmation': {
    es: ({ name, unassignedDevices }) => `Voy a eliminar la estancia "${name}". ${unassignedDevices === 0 ? 'No tiene dispositivos asignados.' : `${unassignedDevices} ${unassignedDevices === 1 ? 'dispositivo quedará' : 'dispositivos quedarán'} sin estancia.`} ¿Confirmo?`,
    en: ({ name, unassignedDevices }) => `I'm going to delete the room "${name}". ${unassignedDevices === 0 ? 'It has no assigned devices.' : `${unassignedDevices} ${unassignedDevices === 1 ? 'device will' : 'devices will'} be left without a room.`} Confirm?`,
  },
  'management.room_deleted': {
    es: ({ name, unassignedDevices }) => `Listo, eliminé la estancia "${name}".${unassignedDevices === 0 ? '' : ` ${unassignedDevices} ${unassignedDevices === 1 ? 'dispositivo quedó' : 'dispositivos quedaron'} sin estancia.`}`,
    en: ({ name, unassignedDevices }) => `Ready, deleted the room "${name}".${unassignedDevices === 0 ? '' : ` ${unassignedDevices} ${unassignedDevices === 1 ? 'device was' : 'devices were'} left without a room.`}`,
  },
  'management.unsupported_action': {
    es: () => 'No estoy seguro de cómo gestionar eso.',
    en: () => "I'm not sure how to manage that.",
  },
  'management.scene_renamed': {
    es: ({ name }) => `Listo, renombré la escena a "${name}".`,
    en: ({ name }) => `Ready, scene renamed to "${name}".`,
  },
  'management.automation_toggled': {
    es: ({ name, enabled }) => `Listo, ${enabled ? 'activé' : 'desactivé'} la automatización "${name}".`,
    en: ({ name, enabled }) => `Ready, automation "${name}" ${enabled ? 'enabled' : 'disabled'}.`,
  },
  'management.scene_updated': {
    es: ({ name }) => `Listo, actualicé la escena "${name}".`,
    en: ({ name }) => `Ready, updated scene "${name}".`,
  },
  'management.execution_failed': {
    es: () => 'No se pudo ejecutar la acción de gestión.',
    en: () => 'Failed to execute management action.',
  },
  'confirmation.confirm': {
    es: () => '¿Confirmo?',
    en: () => 'Confirm?',
  },
  'confirmation.yes': {
    es: () => 'Sí',
    en: () => 'Yes',
  },
  'confirmation.no': {
    es: () => 'No',
    en: () => 'No',
  },
  'command.not_understood': {
    es: () => 'No entendí ese comando. Indícame dispositivo y estancia, por ejemplo: apaga la luz de la sala.',
    en: () => 'I did not understand that command. Give me the device and room, for example: turn off the living room light.',
  },
  'execution.failed': {
    es: () => 'La ejecución falló.',
    en: () => 'Execution failed.',
  },
  'execution.unknown_error': {
    es: () => 'Error desconocido durante la ejecución.',
    en: () => 'Unknown error during execution.',
  },
  'selection.invalid': {
    es: () => 'Selección o acción pendiente inválida.',
    en: () => 'Invalid selection or pending action.',
  },
  'selection.target_required': {
    es: () => 'Falta el objetivo para la selección.',
    en: () => 'Missing target for selection.',
  },
  'resolution.device_not_found': {
    es: ({ targetPhrase }) => `No encontré un dispositivo llamado '${targetPhrase}'.`,
    en: () => `I couldn't find a device matching your request.`,
  },
  'clarification.vague_light_room': {
    es: () => '¿En qué estancia quieres controlar la luz?',
    en: () => 'In which room do you want to control the light?',
  },
  'clarification.vague_light_room_example': {
    es: () => "Puedes decir: 'prende la luz de la sala'.",
    en: () => "You can say: 'turn on the living room light'.",
  },
  'clarification.device_multiple_matches': {
    es: () => 'Encontré varios dispositivos compatibles. Indícame el objetivo.',
    en: () => 'I found several matching devices. Please choose the target.',
  },
  'clarification.device_multiple_matches_question': {
    es: () => '¿Cuál quieres controlar?',
    en: () => 'Which one do you want to control?',
  },
  'confirmation.generic_proceed': {
    es: () => '¿Estás seguro de que quieres continuar?',
    en: () => 'Are you sure you want to proceed?',
  },
  'confirmation.generic_proceed_yes': {
    es: () => 'Sí, adelante',
    en: () => 'Yes, proceed',
  },
  'confirmation.generic_proceed_no': {
    es: () => 'No, cancelar',
    en: () => 'No, cancel',
  },
  'scene.not_found': {
    es: () => 'Escena no encontrada. Necesito una escena válida.',
    en: () => 'Scene not found. I need a valid scene.',
  },
  'scene.execution_started': {
    es: () => 'Escena en ejecución.',
    en: () => 'Scene execution started.',
  },
  'confirmation.device_control': {
    es: ({ deviceName }) => `¿Estás seguro de que quieres controlar ${deviceName}?`,
    en: ({ deviceName }) => `Are you sure you want to control ${deviceName}?`,
  },
  'confirmation.multi_action': {
    es: ({ count, actionSummary }) => `Puedo ejecutar ${count} acciones (${actionSummary}). Confírmame para proceder.`,
    en: ({ count, actionSummary }) => `I can execute ${count} actions (${actionSummary}). Confirm to proceed.`,
  },
  'confirmation.multi_action_yes': {
    es: () => 'Sí, ejecutar todo',
    en: () => 'Yes, execute all',
  },
  'confirmation.multi_action_no': {
    es: () => 'No, cancelar',
    en: () => 'No, cancel',
  },
  'intent.not_recognized': {
    es: () => 'Tipo de instrucción no reconocido. Quedo atento a una orden más clara.',
    en: () => 'Instruction type not recognized. Standing by for a clearer command.',
  },
  'fuzzy.suggestion': {
    es: ({ targetPhrase, deviceName }) => `No encontré un dispositivo llamado '${targetPhrase}'. ¿Quisiste decir '${deviceName}'?`,
    en: ({ targetPhrase, deviceName }) => `I didn't find a device called '${targetPhrase}'. Did you mean '${deviceName}'?`,
  },
  'fuzzy.question': {
    es: ({ deviceName }) => `¿Quisiste decir '${deviceName}'?`,
    en: ({ deviceName }) => `Did you mean '${deviceName}'?`,
  },
  'fuzzy.not_found': {
    es: ({ targetPhrase }) => `No encontré un dispositivo llamado '${targetPhrase}'.`,
    en: ({ targetPhrase }) => `I couldn't find a device called '${targetPhrase}'.`,
  },
  'state.detail_no_devices': {
    es: () => 'No se encontraron dispositivos.',
    en: () => 'No devices found.',
  },
  'state.room_ambiguous': {
    es: () => 'Encontré varias estancias que podrían coincidir. Por favor, sé más específico.',
    en: () => 'I found several rooms that could match. Please be more specific.',
  },
  'state.room_not_found': {
    es: () => 'No encontré esa estancia.',
    en: () => "I couldn't find that room.",
  },
  'state.room_selection_required': {
    es: () => '¿En qué estancia?',
    en: () => 'In which room?',
  },
  'state.room_selection_question': {
    es: () => '¿En qué estancia?',
    en: () => 'Which room?',
  },
  'state.no_targets_in_room': {
    es: ({ entityLabel, roomName }) => `No encontré ${entityLabel} en ${roomName}.`,
    en: ({ entityLabel, roomName }) => `I couldn't find any ${entityLabel} in ${roomName}.`,
  },
  'state.no_matching_targets': {
    es: () => 'No encontré dispositivos que coincidan con esa consulta.',
    en: () => 'I could not find any devices matching that query.',
  },
  'state.inventory_count': {
    es: ({ count, itemLabel, roomSuffix }) => `Tienes ${count} ${itemLabel}${roomSuffix}.`,
    en: ({ count, itemLabel, roomSuffix }) => `You have ${count} ${itemLabel}${roomSuffix}.`,
  },
  'state.room_no_controllable': {
    es: ({ roomName }) => `No veo dispositivos controlables en ${roomName}.`,
    en: ({ roomName }) => `I don't see controllable devices in ${roomName}.`,
  },
  'state.room_all_off': {
    es: ({ roomName }) => `Todo está apagado en ${roomName}.`,
    en: ({ roomName }) => `Everything is off in ${roomName}.`,
  },
  'state.room_all_on': {
    es: ({ roomName }) => `Todo está encendido en ${roomName}.`,
    en: ({ roomName }) => `Everything is on in ${roomName}.`,
  },
  'state.room_summary': {
    es: ({ onCount, total, roomName }) => `Hay ${onCount} de ${total} dispositivos encendidos en ${roomName}.`,
    en: ({ onCount, total, roomName }) => `There are ${onCount} out of ${total} devices on in ${roomName}.`,
  },
  'state.device_not_found': {
    es: () => 'No pude encontrar el dispositivo por el que preguntas.',
    en: () => "I couldn't find the device you're asking about.",
  },
  'state.device_multiple_matches': {
    es: () => 'Encontré varios dispositivos con ese nombre. ¿A cuál te refieres?',
    en: () => 'I found several devices with that name. Which one do you mean?',
  },
  'state.device_query_on': {
    es: ({ deviceName, isOn }) => isOn ? `Sí, ${deviceName} está encendido.` : `No, ${deviceName} está apagado.`,
    en: ({ deviceName, isOn }) => isOn ? `Yes, ${deviceName} is on.` : `No, ${deviceName} is off.`,
  },
  'state.device_query_off': {
    es: ({ deviceName, isOff }) => isOff ? `Sí, ${deviceName} está apagado.` : `No, ${deviceName} está encendido.`,
    en: ({ deviceName, isOff }) => isOff ? `Yes, ${deviceName} is off.` : `No, ${deviceName} is on.`,
  },
  'state.device_status': {
    es: ({ deviceName, isOn }) => isOn ? `${deviceName} está encendido.` : `${deviceName} está apagado.`,
    en: ({ deviceName, isOn }) => isOn ? `${deviceName} is on.` : `${deviceName} is off.`,
  },
  'sensor.reading': {
    es: ({ name, value, unit }) => 'La lectura de ' + name + ' es ' + value + unit + '.',
    en: ({ name, value, unit }) => 'The ' + name + ' reading is ' + value + unit + '.',
  },
  'sensor.unavailable': {
    es: ({ name }) => 'La lectura de ' + name + ' no está disponible.',
    en: ({ name }) => 'The reading for ' + name + ' is not available.',
  },
  'sensor.not_found': {
    es: () => 'No encontré una lectura de sensor autorizada para esa consulta.',
    en: () => 'I could not find an authorized sensor reading for that request.',
  },
  'sensor.selection_unavailable': {
    es: () => 'Esa lectura de sensor ya no está disponible.',
    en: () => 'That sensor reading is no longer available.',
  },
  'sensor.clarification': {
    es: () => 'Encontré varias lecturas de sensores. ¿A cuál te refieres?',
    en: () => 'I found multiple sensor readings. Which one do you mean?',
  },
  'sensor.clarification_question': {
    es: () => '¿Qué sensor?', 
    en: () => 'Which sensor?', 
  },
};

export function getAssistantResponseText<TKey extends AssistantResponseMessageKey>(
  key: TKey,
  language: string,
  parameters: AssistantResponseCatalogParameters[TKey]
): string {
  const catalogLanguage: AssistantResponseCatalogLanguage = language === 'en' ? 'en' : 'es';
  const template = responseCatalog[key][catalogLanguage] as AssistantResponseTemplate<TKey>;
  return template(parameters);
}
