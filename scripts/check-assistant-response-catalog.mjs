import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const catalogPath = join(root, 'packages', 'assistant', 'application', 'response', 'AssistantResponseCatalog.ts');
const expectedKeys = [
  'quick.greeting',
  'quick.wellness',
  'quick.name',
  'profile.preferred_address',
  'profile.tone',
  'preference.response_style',
  'preference.detail_offer',
  'language.updated',
  'action.cancelled',
  'confirmation.expired',
  'alias.deleted',
  'draft.activated',
  'draft.activation_failed',
  'draft.cancelled',
  'draft.room_required',
  'draft.action_required',
  'draft.time_required',
  'draft.prepared',
  'confirmation.none_pending',
  'confirmation.are_you_sure',
  'selection.follow_up_selected',
  'clarification.pronoun_multiple_options',
  'clarification.which_one',
  'clarification.which_one_do_you_mean',
  'clarification.intent_multiple_matches',
  'command.not_understood',
  'execution.failed',
  'execution.unknown_error',
  'selection.invalid',
  'selection.target_required',
  'resolution.device_not_found',
  'clarification.vague_light_room',
  'clarification.vague_light_room_example',
  'clarification.device_multiple_matches',
  'clarification.device_multiple_matches_question',
  'confirmation.generic_proceed',
  'confirmation.generic_proceed_yes',
  'confirmation.generic_proceed_no',
  'scene.not_found',
  'scene.execution_started',
  'confirmation.device_control',
  'confirmation.multi_action',
  'confirmation.multi_action_yes',
  'confirmation.multi_action_no',
  'intent.not_recognized',
  'fuzzy.suggestion',
  'fuzzy.question',
  'fuzzy.not_found',
  'state.detail_no_devices',
  'state.room_ambiguous',
  'state.room_not_found',
  'state.room_selection_required',
  'state.room_selection_question',
  'state.no_targets_in_room',
  'state.no_matching_targets',
  'state.inventory_count',
  'state.room_no_controllable',
  'state.room_all_off',
  'state.room_all_on',
  'state.room_summary',
  'state.device_not_found',
  'state.device_multiple_matches',
  'state.device_query_on',
  'state.device_query_off',
  'state.device_status',
  'media.no_players', 'media.target_required', 'media.target_required_question', 'media.volume_amount_required', 'media.volume_invalid', 'media.unavailable', 'media.off', 'media.playing', 'media.paused', 'media.idle', 'media.status_list', 'media.status_in_room', 'media.no_players_in_room', 'media.operation_not_supported', 'media.turn_on_not_supported', 'media.operation_failed', 'media.operation_completed',
  'sensor.reading',
  'sensor.unavailable',
  'sensor.not_found',
  'sensor.selection_unavailable',
  'sensor.clarification',
  'listing.scenes_empty',
  'listing.scenes',
  'listing.automation_status',
  'listing.automations_empty',
  'listing.automations',
  'management.scene_not_found',
  'management.automation_not_found',
  'management.device_not_found',
  'management.device_not_in_scene',
  'management.rename_scene_confirmation',
  'management.toggle_automation_confirmation',
  'management.add_device_confirmation',
  'management.remove_device_confirmation',
  'management.room_name_required',
  'management.room_rename_details_required',
  'management.room_deletion_name_required',
  'management.room_already_exists',
  'management.room_not_found',
  'management.create_room_confirmation',
  'management.room_created',
  'management.rename_room_confirmation',
  'management.room_renamed',
  'management.delete_room_confirmation',
  'management.room_deleted',
  'management.unsupported_action',
  'management.scene_renamed',
  'management.automation_toggled',
  'management.scene_updated',
  'management.execution_failed',
  'confirmation.confirm',
  'confirmation.yes',
  'confirmation.no',
  'sensor.clarification_question',
];
const migrationTargets = [
  {
    path: join(root, 'packages', 'assistant', 'application', 'AssistantQuickResponseService.ts'),
    keys: ['quick.greeting', 'quick.wellness', 'quick.name'],
  },
  {
    path: join(root, 'packages', 'assistant', 'application', 'response', 'AssistantConversationProfile.ts'),
    keys: ['profile.preferred_address', 'profile.tone'],
  },
  {
    path: join(root, 'packages', 'assistant', 'application', 'response', 'AssistantResponsePreference.ts'),
    keys: ['preference.response_style', 'preference.detail_offer'],
  },
  {
    path: join(root, 'packages', 'assistant', 'application', 'AssistantConversationService.ts'),
    keys: ['language.updated', 'action.cancelled', 'confirmation.expired', 'alias.deleted', 'draft.activated', 'draft.activation_failed', 'draft.cancelled', 'draft.room_required', 'draft.action_required', 'draft.time_required', 'draft.prepared', 'confirmation.none_pending', 'confirmation.are_you_sure', 'selection.follow_up_selected', 'clarification.pronoun_multiple_options', 'clarification.which_one', 'clarification.which_one_do_you_mean', 'clarification.intent_multiple_matches', 'command.not_understood', 'execution.failed', 'execution.unknown_error', 'selection.invalid', 'selection.target_required', 'sensor.reading', 'sensor.unavailable', 'sensor.not_found', 'sensor.selection_unavailable', 'sensor.clarification', 'sensor.clarification_question', 'listing.scenes_empty', 'listing.scenes', 'listing.automation_status', 'listing.automations_empty', 'listing.automations', 'management.scene_not_found', 'management.automation_not_found', 'management.device_not_found', 'management.device_not_in_scene', 'management.rename_scene_confirmation', 'management.toggle_automation_confirmation', 'management.add_device_confirmation', 'management.remove_device_confirmation', 'management.room_name_required', 'management.room_rename_details_required', 'management.room_deletion_name_required', 'management.room_already_exists', 'management.room_not_found', 'management.create_room_confirmation', 'management.room_created', 'management.rename_room_confirmation', 'management.room_renamed', 'management.delete_room_confirmation', 'management.room_deleted', 'management.unsupported_action', 'management.scene_renamed', 'management.automation_toggled', 'management.scene_updated', 'management.execution_failed', 'confirmation.confirm', 'confirmation.yes', 'confirmation.no', 'resolution.device_not_found', 'clarification.vague_light_room', 'clarification.vague_light_room_example', 'clarification.device_multiple_matches', 'clarification.device_multiple_matches_question', 'confirmation.generic_proceed', 'confirmation.generic_proceed_yes', 'confirmation.generic_proceed_no', 'scene.not_found', 'scene.execution_started', 'confirmation.device_control', 'confirmation.multi_action', 'confirmation.multi_action_yes', 'confirmation.multi_action_no', 'intent.not_recognized', 'fuzzy.suggestion', 'fuzzy.question', 'fuzzy.not_found', 'state.detail_no_devices', 'state.room_ambiguous', 'state.room_not_found', 'state.room_selection_required', 'state.room_selection_question', 'state.no_targets_in_room', 'state.no_matching_targets', 'state.inventory_count', 'state.room_no_controllable', 'state.room_all_off', 'state.room_all_on', 'state.room_summary', 'state.device_not_found', 'state.device_multiple_matches', 'state.device_query_on', 'state.device_query_off', 'state.device_status', 'media.no_players', 'media.target_required', 'media.target_required_question', 'media.volume_amount_required', 'media.volume_invalid', 'media.unavailable', 'media.off', 'media.playing', 'media.paused', 'media.idle', 'media.status_list', 'media.status_in_room', 'media.no_players_in_room', 'media.operation_not_supported', 'media.turn_on_not_supported', 'media.operation_failed', 'media.operation_completed'],
  },
];
const errors = [];
const catalogSource = readFileSync(catalogPath, 'utf8');
const declaredKeys = [...catalogSource.matchAll(/^  '([^']+)': \{/gm)].map((match) => match[1]);

for (const key of expectedKeys) {
  if (!declaredKeys.includes(key)) {
    errors.push(`Missing response key in ${relative(root, catalogPath)}: ${key}`);
    continue;
  }

  const catalogLines = catalogSource.split(/\r?\n/);
  const keyLine = catalogLines.findIndex((line) => line === `  '${key}': {`);
  const nextKeyLine = catalogLines.findIndex(
    (line, index) => index > keyLine && /^  '[^']+': \{$/.test(line),
  );
  const section = catalogLines
    .slice(keyLine, nextKeyLine >= 0 ? nextKeyLine : catalogLines.length)
    .join('\n');
  for (const language of ['es', 'en']) {
    if (!new RegExp(`^    ${language}:`, 'm').test(section)) {
      errors.push(`Missing ${language} response for ${key} in ${relative(root, catalogPath)}`);
    }
  }
}

for (const key of declaredKeys) {
  if (!expectedKeys.includes(key)) {
    errors.push(`Unexpected unreviewed response key in ${relative(root, catalogPath)}: ${key}`);
  }
}

for (const target of migrationTargets) {
  const source = readFileSync(target.path, 'utf8');
  for (const key of target.keys) {
    if (!source.includes(`getAssistantResponseText('${key}'`)) {
      errors.push(`Migrated response key ${key} is not used by ${relative(root, target.path)}`);
    }
  }
}

const quickResponseSource = readFileSync(migrationTargets[0].path, 'utf8');
if (/\bmessage:\s*(['"`])/.test(quickResponseSource)) {
  errors.push(`Literal assistant message found in ${relative(root, migrationTargets[0].path)}`);
}

const conversationSource = readFileSync(migrationTargets[3].path, 'utf8');
const migratedConversationResponseFragments = [
  "Got it. I'll speak in English from now on.",
  'Perfecto. A partir de ahora hablaré en español.',
  'Action cancelled.',
  'Acción cancelada.',
  'La confirmación ya venció.',
  'That confirmation has expired.',
  'Listo, eliminé el alias',
  'Done, I deleted the alias',
  'Listo. Escena activada correctamente.',
  'Ready. Scene activated successfully.',
  'No se pudo activar la escena.',
  'Failed to activate draft.',
  'Entendido, no activé la escena.',
  "Understood, I didn't activate the scene.",
  '¿Confirmar qué? No tengo ninguna acción pendiente.',
  "Confirm what? I don't have any pending actions.",
  'I did not understand that command.',
  'No entendí ese comando.',
  'Execution failed.',
  'La ejecución falló.',
  'Unknown error during execution.',
  'Error desconocido durante la ejecución.',
  'Invalid selection or pending action.',
  'Selección o acción pendiente inválida.',
  'Missing target for selection.',
  'Falta el objetivo para la selección.',
  'La lectura de ',
  'The reading for ',
  'I could not find an authorized sensor reading for that request.',
  'No encontré una lectura de sensor autorizada para esa consulta.',
  'That sensor reading is no longer available.',
  'Esa lectura de sensor ya no está disponible.',
  'I found multiple sensor readings. Which one do you mean?', 
  'Encontré varias lecturas de sensores. ¿A cuál te refieres?', 
  'Which sensor?', 
  '¿Qué sensor?', 
  '¿Are you sure?',
  'Are you sure?',
  "I've selected ",
  'Seleccioné ',
  'I found several options for that. Which one do you mean?',
  'Encontré varias opciones para eso. ¿A cuál te refieres?',
  'I found multiple matches for ',
  'Aún no tienes escenas creadas.',
  "You don't have any scenes created yet.",
  'Estas son tus escenas:',
  'These are your scenes:',
  'Aún no tienes automatizaciones.',
  "You don't have any automations yet.",
  'Estas son tus automatizaciones:',
  'These are your automations:',
  'Scene "${oldName}" not found.',
  'No encontré la escena "${oldName}".',
  'Automation "${autoName}" not found.',
  'No encontré la automatización "${autoName}".',
  'Device "${deviceName}" not found.',
  'No encontré el dispositivo "${deviceName}".',
  'is not in the scene.',
  'no está en la escena.',
  "I'm going to rename the scene",
  'Voy a renombrar la escena',
  "I'm going to add",
  'Voy a agregar',
  "I'm going to remove",
  'Voy a quitar',
  "I'm not sure how to manage that.",
  'No estoy seguro de cómo gestionar eso.',
  'Ready, scene renamed to',
  'Listo, renombré la escena a',
  'Ready, automation',
  'Listo, actualicé la escena',
  'Failed to execute management action.',
  'No se pudo ejecutar la acción de gestión.',
  'Confirm?',  'Encontré varias opciones para ',
  "I couldn't find a device matching your request.",
  "You can say: 'turn on the living room light'.",
  "Puedes decir: 'prende la luz de la sala'.",
  'I found several matching devices. Please choose the target.',
  'Encontré varios dispositivos compatibles. Indícame el objetivo.',
  'Are you sure you want to proceed?',
  '¿Estás seguro de que quieres continuar?',
  'Yes, proceed',
  'Sí, adelante',
  'Scene not found. I need a valid scene.',
  'Escena no encontrada. Necesito una escena válida.',
  'Scene execution started.',
  'Escena en ejecución.',
  'Are you sure you want to control',
  '¿Estás seguro de que quieres controlar',
  'I can execute ${intent.actions.length} actions',
  'Puedo ejecutar ${intent.actions.length} acciones',
  'Yes, execute all',
  'Tipo de instrucción no reconocido.',
  'Instruction type not recognized.',
  "I don't see controllable devices in",
  'No veo dispositivos controlables en',
  'Everything is off in',
  'Todo está apagado en',
  'Everything is on in',
  'Todo está encendido en',
  'There are ${onDevices.length} out of',
  'Hay ${onDevices.length} de',
  "I couldn't find the device you're asking about.",
  'No pude encontrar el dispositivo por el que preguntas.',
  'I found several devices with that name. Which one do you mean?',
  'Encontré varios dispositivos con ese nombre. ¿A cuál te refieres?',
  'Yes, ${device.name} is on.',
  'Sí, ${device.name} está encendido.',
  'Yes, ${device.name} is off.',
  'Sí, ${device.name} está apagado.',
];
if (migratedConversationResponseFragments.some((fragment) => conversationSource.includes(fragment))) {
  errors.push(`Migrated conversation response remains literal in ${relative(root, migrationTargets[3].path)}`);
}

if (errors.length > 0) {
  console.error(`Assistant response catalog validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Assistant response catalog validation passed: ${expectedKeys.length} bilingual response key(s) and ${migrationTargets.length} migrated source surface(s).`);
