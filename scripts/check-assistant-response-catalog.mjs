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
  'confirmation.none_pending',
  'command.not_understood',
  'execution.failed',
  'execution.unknown_error',
  'selection.invalid',
  'selection.target_required',
  'sensor.reading',
  'sensor.unavailable',
  'sensor.not_found',
  'sensor.selection_unavailable',
  'sensor.clarification',
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
    keys: ['language.updated', 'action.cancelled', 'confirmation.expired', 'alias.deleted', 'draft.activated', 'draft.activation_failed', 'draft.cancelled', 'confirmation.none_pending', 'command.not_understood', 'execution.failed', 'execution.unknown_error', 'selection.invalid', 'selection.target_required', 'sensor.reading', 'sensor.unavailable', 'sensor.not_found', 'sensor.selection_unavailable', 'sensor.clarification', 'sensor.clarification_question'],
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