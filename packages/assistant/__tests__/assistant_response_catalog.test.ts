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
});
