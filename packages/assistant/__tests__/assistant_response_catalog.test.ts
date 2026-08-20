import { getAssistantResponseText } from '../application/response/AssistantResponseCatalog';

describe('AssistantResponseCatalog', () => {
  it('returns every quick response in Spanish and English', () => {
    expect(getAssistantResponseText('quick.greeting', 'es', {}))
      .toBe('A la orden. La casa está atenta.');
    expect(getAssistantResponseText('quick.greeting', 'en', { userName: 'Oscar' }))
      .toBe('At your service, Oscar. The residence is standing by.');
    expect(getAssistantResponseText('quick.wellness', 'es', {}))
      .toBe('Operando con normalidad. Control local, voz y sistemas residenciales atentos.');
    expect(getAssistantResponseText('quick.wellness', 'en', {}))
      .toBe('Operating normally. Local control, voice services, and residential systems are standing by.');
    expect(getAssistantResponseText('quick.name', 'es', {}))
      .toBe('Soy HomePilot, tu operador residencial local.');
    expect(getAssistantResponseText('quick.name', 'en', {}))
      .toBe('I am HomePilot, your local residential operator.');
  });

  it.each([
    ['es', 'Entendido. Me dirigiré a ti como Oscar en la conversación general.'],
    ['en', 'Understood. I will address you as Oscar in general conversation.'],
  ] as const)('formats the preferred address acknowledgement in %s', (language, expected) => {
    expect(getAssistantResponseText('profile.preferred_address', language, { address: 'Oscar' })).toBe(expected);
  });

  it.each([
    ['es', 'neutral', 'Entendido. Usaré un tono neutral en la conversación general.'],
    ['es', 'warm', 'Entendido. Usaré un tono cálido en la conversación general.'],
    ['es', 'formal', 'Entendido. Usaré un tono formal en la conversación general.'],
    ['en', 'neutral', 'Understood. I will use a neutral tone in general conversation.'],
    ['en', 'warm', 'Understood. I will use a warm tone in general conversation.'],
    ['en', 'formal', 'Understood. I will use a formal tone in general conversation.'],
  ] as const)('formats the %s tone branch for %s', (language, tone, expected) => {
    expect(getAssistantResponseText('profile.tone', language, { tone })).toBe(expected);
  });

  it.each([
    ['es', 'concise', 'Entendido. Responderé de forma breve.'],
    ['es', 'standard', 'Entendido. Responderé de forma normal.'],
    ['es', 'detailed', 'Entendido. Incluiré más detalle cuando sea útil.'],
    ['en', 'concise', 'Understood. I will keep my responses concise.'],
    ['en', 'standard', 'Understood. I will use a balanced response style.'],
    ['en', 'detailed', 'Understood. I will include more detail when useful.'],
  ] as const)('formats the %s response preference branch for %s', (language, preference, expected) => {
    expect(getAssistantResponseText('preference.response_style', language, { preference })).toBe(expected);
  });

  it('returns detail offers and language-update acknowledgements in both languages', () => {
    expect(getAssistantResponseText('preference.detail_offer', 'es', {}))
      .toBe(' Puedo ampliar cualquier parte si te sirve.');
    expect(getAssistantResponseText('preference.detail_offer', 'en', {}))
      .toBe(' I can expand on any part if useful.');
    expect(getAssistantResponseText('language.updated', 'es', {}))
      .toBe('Perfecto. A partir de ahora hablaré en español.');
    expect(getAssistantResponseText('language.updated', 'en', {}))
      .toBe("Got it. I'll speak in English from now on.");
    expect(getAssistantResponseText('action.cancelled', 'es', {}))
      .toBe('Acción cancelada.');
    expect(getAssistantResponseText('action.cancelled', 'en', {}))
      .toBe('Action cancelled.');
  });
  it('formats the core multi-turn responses in both languages', () => {
    expect(getAssistantResponseText('confirmation.expired', 'es', {}))
      .toBe('La confirmación ya venció. Indícame nuevamente la acción que deseas realizar.');
    expect(getAssistantResponseText('confirmation.expired', 'en', {}))
      .toBe('That confirmation has expired. Please tell me again which action you want to perform.');
    expect(getAssistantResponseText('alias.deleted', 'es', { alias: 'luz de lectura' }))
      .toBe("Listo, eliminé el alias 'luz de lectura'.");
    expect(getAssistantResponseText('alias.deleted', 'en', { alias: 'reading light' }))
      .toBe("Done, I deleted the alias 'reading light'.");
    expect(getAssistantResponseText('draft.activated', 'es', {}))
      .toBe('Listo. Escena activada correctamente. Sistemas alineados.');
    expect(getAssistantResponseText('draft.activated', 'en', {}))
      .toBe('Ready. Scene activated successfully. Systems aligned.');
    expect(getAssistantResponseText('draft.activation_failed', 'es', {}))
      .toBe('No se pudo activar la escena.');
    expect(getAssistantResponseText('draft.activation_failed', 'en', {}))
      .toBe('Failed to activate draft.');
    expect(getAssistantResponseText('draft.cancelled', 'es', {}))
      .toBe('Entendido, no activé la escena.');
    expect(getAssistantResponseText('draft.cancelled', 'en', {}))
      .toBe("Understood, I didn't activate the scene.");
    expect(getAssistantResponseText('confirmation.none_pending', 'es', {}))
      .toBe('¿Confirmar qué? No tengo ninguna acción pendiente.');
    expect(getAssistantResponseText('confirmation.none_pending', 'en', {}))
      .toBe("Confirm what? I don't have any pending actions.");
expect(getAssistantResponseText('confirmation.are_you_sure', 'es', {}))
      .toBe('¿Estás seguro?');
    expect(getAssistantResponseText('confirmation.are_you_sure', 'en', {}))
      .toBe('¿Are you sure?');
expect(getAssistantResponseText('selection.follow_up_selected', 'es', { label: 'Luz Escritorio' }))
      .toBe('Seleccioné Luz Escritorio. ¿Qué quieres hacer con este dispositivo?');
    expect(getAssistantResponseText('selection.follow_up_selected', 'en', { label: 'Desk Light' }))
      .toBe("I've selected Desk Light. What would you like to do with it?");
    expect(getAssistantResponseText('clarification.pronoun_multiple_options', 'es', {}))
      .toBe('Encontré varias opciones para eso. ¿A cuál te refieres?');
    expect(getAssistantResponseText('clarification.pronoun_multiple_options', 'en', {}))
      .toBe('I found several options for that. Which one do you mean?');
    expect(getAssistantResponseText('clarification.which_one', 'es', {})).toBe('¿Cuál?');
    expect(getAssistantResponseText('clarification.which_one_do_you_mean', 'en', {})).toBe('Which one do you mean?');
    expect(getAssistantResponseText('clarification.intent_multiple_matches', 'es', { segment: 'luz principal' }))
      .toBe('Encontré varias opciones para "luz principal".');
    expect(getAssistantResponseText('clarification.intent_multiple_matches', 'en', { segment: 'main light' }))
      .toBe('I found multiple matches for "main light".');
  });
  it('returns generic execution and selection responses in both languages', () => {
    expect(getAssistantResponseText('command.not_understood', 'es', {})).toBe('No entendí ese comando. Indícame dispositivo y estancia, por ejemplo: apaga la luz de la sala.');
    expect(getAssistantResponseText('command.not_understood', 'en', {})).toBe('I did not understand that command. Give me the device and room, for example: turn off the living room light.');
    expect(getAssistantResponseText('execution.failed', 'es', {})).toBe('La ejecución falló.');
    expect(getAssistantResponseText('execution.failed', 'en', {})).toBe('Execution failed.');
    expect(getAssistantResponseText('execution.unknown_error', 'es', {})).toBe('Error desconocido durante la ejecución.');
    expect(getAssistantResponseText('execution.unknown_error', 'en', {})).toBe('Unknown error during execution.');
    expect(getAssistantResponseText('selection.invalid', 'es', {})).toBe('Selección o acción pendiente inválida.');
    expect(getAssistantResponseText('selection.invalid', 'en', {})).toBe('Invalid selection or pending action.');
    expect(getAssistantResponseText('selection.target_required', 'es', {})).toBe('Falta el objetivo para la selección.');
    expect(getAssistantResponseText('selection.target_required', 'en', {})).toBe('Missing target for selection.');
    expect(getAssistantResponseText('execution.failed', 'unsupported-language', {})).toBe('La ejecución falló.');
  });
  it('returns sensor-reading responses in both languages', () => {
    expect(getAssistantResponseText('sensor.reading', 'es', { name: 'Temperatura Sala', value: '22.5', unit: ' °C' })).toBe('La lectura de Temperatura Sala es 22.5 °C.');
    expect(getAssistantResponseText('sensor.reading', 'en', { name: 'Patio Humidity', value: '56', unit: ' %' })).toBe('The Patio Humidity reading is 56 %.');
    expect(getAssistantResponseText('sensor.unavailable', 'es', { name: 'Temperatura Sala' })).toBe('La lectura de Temperatura Sala no está disponible.');
    expect(getAssistantResponseText('sensor.unavailable', 'en', { name: 'Patio Humidity' })).toBe('The reading for Patio Humidity is not available.');
    expect(getAssistantResponseText('sensor.not_found', 'es', {})).toBe('No encontré una lectura de sensor autorizada para esa consulta.');
    expect(getAssistantResponseText('sensor.not_found', 'en', {})).toBe('I could not find an authorized sensor reading for that request.');
    expect(getAssistantResponseText('sensor.selection_unavailable', 'es', {})).toBe('Esa lectura de sensor ya no está disponible.');
    expect(getAssistantResponseText('sensor.selection_unavailable', 'en', {})).toBe('That sensor reading is no longer available.');
    expect(getAssistantResponseText('sensor.clarification', 'es', {})).toBe('Encontré varias lecturas de sensores. ¿A cuál te refieres?');
    expect(getAssistantResponseText('sensor.clarification_question', 'en', {})).toBe('Which sensor?');
  });

  it('formats scene and automation management responses in both languages', () => {
    expect(getAssistantResponseText('listing.scenes_empty', 'es', {})).toBe('Aún no tienes escenas creadas.');
    expect(getAssistantResponseText('listing.scenes', 'en', { list: '• Cinema' })).toBe('These are your scenes:\n• Cinema');
    expect(getAssistantResponseText('listing.automation_status', 'es', { name: 'Noche', enabled: true })).toBe('• Noche — activa');
    expect(getAssistantResponseText('listing.automations_empty', 'en', {})).toBe("You don't have any automations yet.");
    expect(getAssistantResponseText('listing.automations', 'es', { list: '• Noche — activa' })).toBe('Estas son tus automatizaciones:\n• Noche — activa');
    expect(getAssistantResponseText('management.scene_not_found', 'en', { name: 'Cinema' })).toBe('Scene "Cinema" not found.');
    expect(getAssistantResponseText('management.automation_not_found', 'es', { name: 'Noche' })).toBe('No encontré la automatización "Noche".');
    expect(getAssistantResponseText('management.device_not_found', 'en', { name: 'Desk Light' })).toBe('Device "Desk Light" not found.');
    expect(getAssistantResponseText('management.device_not_in_scene', 'es', { name: 'Luz Escritorio' })).toBe('El dispositivo "Luz Escritorio" no está en la escena.');
    expect(getAssistantResponseText('management.rename_scene_confirmation', 'en', { sceneName: 'Cinema', newName: 'Movie Night' })).toBe('I\'m going to rename the scene "Cinema" to "Movie Night". Confirm?');
    expect(getAssistantResponseText('management.toggle_automation_confirmation', 'es', { name: 'Noche', enabled: false })).toBe('Voy a desactivar la automatización "Noche". ¿Confirmo?');
    expect(getAssistantResponseText('management.add_device_confirmation', 'en', { deviceName: 'Desk Light', sceneName: 'Cinema' })).toBe('I\'m going to add "Desk Light" (off) to the scene "Cinema". Confirm?');
    expect(getAssistantResponseText('management.remove_device_confirmation', 'es', { deviceName: 'Luz Escritorio', sceneName: 'Cine' })).toBe('Voy a quitar "Luz Escritorio" de la escena "Cine". ¿Confirmo?');
    expect(getAssistantResponseText('management.unsupported_action', 'en', {})).toBe("I'm not sure how to manage that.");
    expect(getAssistantResponseText('management.scene_renamed', 'es', { name: 'Cine' })).toBe('Listo, renombré la escena a "Cine".');
    expect(getAssistantResponseText('management.automation_toggled', 'en', { name: 'Night', enabled: true })).toBe('Ready, automation "Night" enabled.');
    expect(getAssistantResponseText('management.scene_updated', 'es', { name: 'Cine' })).toBe('Listo, actualicé la escena "Cine".');
    expect(getAssistantResponseText('management.execution_failed', 'en', {})).toBe('Failed to execute management action.');
    expect(getAssistantResponseText('confirmation.confirm', 'es', {})).toBe('¿Confirmo?');
    expect(getAssistantResponseText('confirmation.yes', 'en', {})).toBe('Yes');
    expect(getAssistantResponseText('confirmation.no', 'es', {})).toBe('No');
  });

  it('formats point-state query responses in both languages', () => {
    expect(getAssistantResponseText('state.room_no_controllable', 'es', { roomName: 'Sala' })).toBe('No veo dispositivos controlables en Sala.');
    expect(getAssistantResponseText('state.room_no_controllable', 'en', { roomName: 'Office' })).toBe("I don't see controllable devices in Office.");
    expect(getAssistantResponseText('state.room_all_off', 'es', { roomName: 'Sala' })).toBe('Todo está apagado en Sala.');
    expect(getAssistantResponseText('state.room_all_off', 'en', { roomName: 'Office' })).toBe('Everything is off in Office.');
    expect(getAssistantResponseText('state.room_all_on', 'es', { roomName: 'Sala' })).toBe('Todo está encendido en Sala.');
    expect(getAssistantResponseText('state.room_all_on', 'en', { roomName: 'Office' })).toBe('Everything is on in Office.');
    expect(getAssistantResponseText('state.room_summary', 'es', { onCount: 2, total: 3, roomName: 'Sala' })).toBe('Hay 2 de 3 dispositivos encendidos en Sala.');
    expect(getAssistantResponseText('state.room_summary', 'en', { onCount: 2, total: 3, roomName: 'Office' })).toBe('There are 2 out of 3 devices on in Office.');
    expect(getAssistantResponseText('state.device_not_found', 'es', {})).toBe('No pude encontrar el dispositivo por el que preguntas.');
    expect(getAssistantResponseText('state.device_not_found', 'en', {})).toBe("I couldn't find the device you're asking about.");
    expect(getAssistantResponseText('state.device_multiple_matches', 'es', {})).toBe('Encontré varios dispositivos con ese nombre. ¿A cuál te refieres?');
    expect(getAssistantResponseText('state.device_multiple_matches', 'en', {})).toBe('I found several devices with that name. Which one do you mean?');
    expect(getAssistantResponseText('state.device_query_on', 'es', { deviceName: 'Luz Sala', isOn: true })).toBe('Sí, Luz Sala está encendido.');
    expect(getAssistantResponseText('state.device_query_on', 'en', { deviceName: 'Office Light', isOn: false })).toBe('No, Office Light is off.');
    expect(getAssistantResponseText('state.device_query_off', 'es', { deviceName: 'Luz Sala', isOff: true })).toBe('Sí, Luz Sala está apagado.');
    expect(getAssistantResponseText('state.device_query_off', 'en', { deviceName: 'Office Light', isOff: false })).toBe('No, Office Light is on.');
    expect(getAssistantResponseText('state.device_status', 'es', { deviceName: 'Luz Sala', isOn: true })).toBe('Luz Sala está encendido.');
    expect(getAssistantResponseText('state.device_status', 'en', { deviceName: 'Office Light', isOn: false })).toBe('Office Light is off.');
  });
  it('formats device resolution, confirmation, and scene execution responses in both languages', () => {
    expect(getAssistantResponseText('resolution.device_not_found', 'es', { targetPhrase: 'luz patio' })).toBe("No encontré un dispositivo llamado 'luz patio'.");
    expect(getAssistantResponseText('resolution.device_not_found', 'en', { targetPhrase: 'patio light' })).toBe("I couldn't find a device matching your request.");
    expect(getAssistantResponseText('clarification.vague_light_room', 'es', {})).toBe('¿En qué estancia quieres controlar la luz?');
    expect(getAssistantResponseText('clarification.vague_light_room', 'en', {})).toBe('In which room do you want to control the light?');
    expect(getAssistantResponseText('clarification.vague_light_room_example', 'es', {})).toBe("Puedes decir: 'prende la luz de la sala'.");
    expect(getAssistantResponseText('clarification.vague_light_room_example', 'en', {})).toBe("You can say: 'turn on the living room light'.");
    expect(getAssistantResponseText('clarification.device_multiple_matches', 'es', {})).toBe('Encontré varios dispositivos compatibles. Indícame el objetivo.');
    expect(getAssistantResponseText('clarification.device_multiple_matches_question', 'en', {})).toBe('Which one do you want to control?');
    expect(getAssistantResponseText('confirmation.generic_proceed', 'es', {})).toBe('¿Estás seguro de que quieres continuar?');
    expect(getAssistantResponseText('confirmation.generic_proceed_yes', 'en', {})).toBe('Yes, proceed');
    expect(getAssistantResponseText('confirmation.generic_proceed_no', 'es', {})).toBe('No, cancelar');
    expect(getAssistantResponseText('scene.not_found', 'en', {})).toBe('Scene not found. I need a valid scene.');
    expect(getAssistantResponseText('scene.execution_started', 'es', {})).toBe('Escena en ejecución.');
    expect(getAssistantResponseText('confirmation.device_control', 'en', { deviceName: 'Office Light' })).toBe('Are you sure you want to control Office Light?');
    expect(getAssistantResponseText('confirmation.multi_action', 'es', { count: 2, actionSummary: 'Luz Sala, Luz Patio' })).toBe('Puedo ejecutar 2 acciones (Luz Sala, Luz Patio). Confírmame para proceder.');
    expect(getAssistantResponseText('confirmation.multi_action_yes', 'en', {})).toBe('Yes, execute all');
    expect(getAssistantResponseText('confirmation.multi_action_no', 'es', {})).toBe('No, cancelar');
    expect(getAssistantResponseText('intent.not_recognized', 'en', {})).toBe('Instruction type not recognized. Standing by for a clearer command.');
  });
  it('formats detailed-state query outcomes in both languages', () => {
    expect(getAssistantResponseText('state.detail_no_devices', 'es', {})).toBe('No se encontraron dispositivos.');
    expect(getAssistantResponseText('state.detail_no_devices', 'en', {})).toBe('No devices found.');
    expect(getAssistantResponseText('state.room_ambiguous', 'es', {})).toBe('Encontré varias estancias que podrían coincidir. Por favor, sé más específico.');
    expect(getAssistantResponseText('state.room_ambiguous', 'en', {})).toBe('I found several rooms that could match. Please be more specific.');
    expect(getAssistantResponseText('state.room_not_found', 'es', {})).toBe('No encontré esa estancia.');
    expect(getAssistantResponseText('state.room_not_found', 'en', {})).toBe("I couldn't find that room.");
    expect(getAssistantResponseText('state.room_selection_required', 'en', {})).toBe('In which room?');
    expect(getAssistantResponseText('state.room_selection_question', 'es', {})).toBe('¿En qué estancia?');
    expect(getAssistantResponseText('state.no_targets_in_room', 'es', { entityLabel: 'luces', roomName: 'Sala' })).toBe('No encontré luces en Sala.');
    expect(getAssistantResponseText('state.no_targets_in_room', 'en', { entityLabel: 'devices', roomName: 'Office' })).toBe("I couldn't find any devices in Office.");
    expect(getAssistantResponseText('state.no_matching_targets', 'es', {})).toBe('No encontré dispositivos que coincidan con esa consulta.');
    expect(getAssistantResponseText('state.no_matching_targets', 'en', {})).toBe('I could not find any devices matching that query.');
    expect(getAssistantResponseText('state.inventory_count', 'es', { count: 2, itemLabel: 'luces', roomSuffix: ' en Sala' })).toBe('Tienes 2 luces en Sala.');
    expect(getAssistantResponseText('state.inventory_count', 'en', { count: 1, itemLabel: 'light', roomSuffix: ' in Office' })).toBe('You have 1 light in Office.');
  });
  it('formats fuzzy device-resolution responses in both languages', () => {
    expect(getAssistantResponseText('fuzzy.suggestion', 'es', { targetPhrase: 'lus sala', deviceName: 'Luz Sala' })).toBe("No encontré un dispositivo llamado 'lus sala'. ¿Quisiste decir 'Luz Sala'?");
    expect(getAssistantResponseText('fuzzy.suggestion', 'en', { targetPhrase: 'ofice light', deviceName: 'Office Light' })).toBe("I didn't find a device called 'ofice light'. Did you mean 'Office Light'?");
    expect(getAssistantResponseText('fuzzy.question', 'es', { deviceName: 'Luz Sala' })).toBe("¿Quisiste decir 'Luz Sala'?");
    expect(getAssistantResponseText('fuzzy.not_found', 'en', { targetPhrase: 'unknown' })).toBe("I couldn't find a device called 'unknown'.");
  });
});