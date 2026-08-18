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
  'draft.activated': Record<never, never>;
  'draft.activation_failed': Record<never, never>;
  'draft.cancelled': Record<never, never>;
  'confirmation.none_pending': Record<never, never>;
  'command.not_understood': Record<never, never>;
  'execution.failed': Record<never, never>;
  'execution.unknown_error': Record<never, never>;
  'selection.invalid': Record<never, never>;
  'selection.target_required': Record<never, never>;
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
    es: () => 'Listo. Escena activada correctamente. Sistemas alineados.',
    en: () => 'Ready. Scene activated successfully. Systems aligned.',
  },
  'draft.activation_failed': {
    es: () => 'No se pudo activar la escena.',
    en: () => 'Failed to activate draft.',
  },
  'draft.cancelled': {
    es: () => 'Entendido, no activé la escena.',
    en: () => "Understood, I didn't activate the scene.",
  },
  'confirmation.none_pending': {
    es: () => '¿Confirmar qué? No tengo ninguna acción pendiente.',
    en: () => "Confirm what? I don't have any pending actions.",
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