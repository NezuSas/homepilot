import { BRAND } from '../../../shared/config/brand';
import { DeviceCommandV1 } from '../../../devices/domain/commands';
import { Device } from '../../../devices/domain/types';
import { AssistantMemoryState } from '../ports/AssistantMemoryPort';
import { JarvisResponseFormatter, type JarvisResponseStyle } from '../response/JarvisResponseFormatter';
import { getAssistantResponseText } from '../response/AssistantResponseCatalog';
import type { AssistantConversationResponse, ExecutedCommandResult } from './conversationTypes';

// Pure builders of assistant response messages.

export function withJarvisStyle(
  response: AssistantConversationResponse,
  style: JarvisResponseStyle,
  language: string
): AssistantConversationResponse {
  const responseStyle = {
    ...style,
    userName: style.userName?.trim() || undefined
  };

  if (language !== 'es' || !responseStyle.userName) {
    return { ...response, responseStyle };
  }

  return {
    ...response,
    message: JarvisResponseFormatter.format(responseStyle),
    responseStyle
  };
}

export function handleEquivalenceQuery(language: string): AssistantConversationResponse {
  return {
    type: 'answer',
    message: language === 'en'
      ? `Yes. In ${BRAND.productName}, I can resolve rooms by their name or the aliases you define in your settings. I’ll treat them as references to where your devices are located.`
      : `Sí, en ${BRAND.productName} puedo resolver estancias por su nombre o por los alias que definas en tu configuración. Los usaré como referencias al espacio donde están tus dispositivos.`
  };
}

export function handleConversationContext(memory: AssistantMemoryState | null, language: string): AssistantConversationResponse {
  if (memory?.originalPrompt) {
    return {
      type: 'answer',
      message: language === 'en'
        ? `Your previous request was: ${memory.originalPrompt}.`
        : `Tu solicitud anterior fue: ${memory.originalPrompt}.`
    };
  }

  return {
    type: 'answer',
    message: language === 'en'
      ? 'I do not have a previous request available in this conversation.'
      : 'No tengo una solicitud anterior disponible en esta conversación.'
  };
}

export function formatStateDevicePreview(devices: readonly Device[], language: string): string {
  if (devices.length === 0) return language === 'en' ? 'none' : 'ninguno';

  const counts = new Map<string, number>();
  for (const device of devices) {
    counts.set(device.name, (counts.get(device.name) ?? 0) + 1);
  }

  const labels = Array.from(counts.entries()).map(([name, count]) => count === 1 ? name : `${name} ×${count}`);
  const visible = labels.slice(0, 4);
  const remaining = labels.length - visible.length;
  const suffix = remaining > 0
    ? (language === 'en' ? ` and ${remaining} more` : ` y ${remaining} más`)
    : '';
  return `${visible.join(', ')}${suffix}`;
}

export function buildSensorReadingResponse(sensor: Device, language: string): AssistantConversationResponse {
  const state = sensor.lastKnownState?.state;
  const normalizedState = typeof state === 'string' ? state.trim().toLowerCase() : '';
  if (state === undefined || state === null || state === '' || normalizedState === 'unknown' || normalizedState === 'unavailable') {
    return { type: 'answer', message: getAssistantResponseText('sensor.unavailable', language, { name: sensor.name }) };
  }

  const rawAttributes = sensor.lastKnownState?.attributes;
  const attributes = rawAttributes && typeof rawAttributes === 'object'
    ? rawAttributes as Record<string, unknown>
    : {};
  const unit = typeof attributes.unit_of_measurement === 'string' && attributes.unit_of_measurement.trim()
    ? ' ' + attributes.unit_of_measurement.trim()
    : '';
  return {
    type: 'answer',
    message: getAssistantResponseText('sensor.reading', language, { name: sensor.name, value: String(state), unit }),
  };
}

export function buildCommandSuccessMessage(command: DeviceCommandV1, deviceName: string, _userName: string | null, language: string): string {
  if (language === 'en') {
    const verb = command === 'turn_on' ? 'Turned on' : (command === 'turn_off' ? 'Turned off' : 'Controlled');
    return `${verb} ${deviceName}.`;
  } else {
    const verb = command === 'turn_on' ? 'Encendí' : (command === 'turn_off' ? 'Apagué' : 'Controlé');
    return `${verb} ${deviceName}.`;
  }
}

export function formatMultiCommandSummary(results: ExecutedCommandResult[], language: string, bulkType?: 'all' | 'lights'): string {
  const isEn = language === 'en';
  const successes = results.filter(r => r.result.status === 'success');
  const failures = results.filter(r => r.result.status === 'failed');

  if (failures.length === 0) {
    if (results.length === 1) {
      const r = results[0];
      if (isEn) {
        const verb = r.action.command === 'turn_on' ? 'Turned on' : (r.action.command === 'turn_off' ? 'Turned off' : 'Controlled');
        return `${verb} ${r.deviceName}.`;
      } else {
        const verb = r.action.command === 'turn_on' ? 'Encendí' : (r.action.command === 'turn_off' ? 'Apagué' : 'Controlé');
        return `${verb} ${r.deviceName}.`;
      }
    }

    if (results.length <= 3) {
      const names = results.map(r => r.deviceName).join(isEn ? ', ' : ', ');
      const lastIndex = names.lastIndexOf(', ');
      const formattedNames = lastIndex !== -1
        ? names.substring(0, lastIndex) + (isEn ? ' and ' : ' y ') + names.substring(lastIndex + 2)
        : names;

      if (isEn) {
        return `Done, controlled ${formattedNames} successfully.`;
      } else {
        return `Listo, controlé ${formattedNames} correctamente.`;
      }
    }

    // Compact bulk response (> 3)
    const commands = Array.from(new Set(results.map(r => r.action.command)));
    const sameCmd = commands.length === 1;
    const cmd = sameCmd ? commands[0] : 'mixed';

    const term = bulkType === 'lights'
      ? (isEn ? 'lights' : 'luces')
      : (isEn ? 'devices' : 'dispositivos');

    if (isEn) {
      if (cmd === 'turn_on') return `Done, turned on ${results.length} ${term} successfully.`;
      if (cmd === 'turn_off') return `Done, turned off ${results.length} ${term} successfully.`;
      return `Done, executed ${results.length} actions successfully.`;
    } else {
      if (cmd === 'turn_on') return `Listo, encendí ${results.length} ${term} correctamente.`;
      if (cmd === 'turn_off') return `Listo, apagué ${results.length} ${term} correctamente.`;
      return `Listo, ejecuté ${results.length} acciones correctamente.`;
    }
  }

  // Total failure
  if (successes.length === 0) {
    if (results.length === 1) {
      const error = results[0].result.actions[0]?.error || (isEn ? 'Unknown error' : 'Error desconocido');
      return isEn
        ? `Failed to control ${results[0].deviceName}: ${error}`
        : `No pude controlar ${results[0].deviceName}: ${error}`;
    }
    const failList = failures.map(f => `• ${f.deviceName}: ${f.result.actions[0]?.error || 'Error'}`).join('\n');
    return isEn
      ? `Failed to execute any actions:\n${failList}`
      : `No pude ejecutar ninguna acción:\n${failList}`;
  }

  // Partial failure
  const failList = failures.map(f => `• ${f.deviceName}: ${f.result.actions[0]?.error || 'Error'}`).join('\n');
  if (isEn) {
    return `Executed ${successes.length} of ${results.length} actions successfully. Failed:\n${failList}`;
  } else {
    return `Ejecuté ${successes.length} de ${results.length} acciones correctamente. Fallaron:\n${failList}`;
  }
}

export function handleCompanyInfoQuery(language: string): AssistantConversationResponse {
  const isEn = language === 'en';
  const message = isEn
    ? `${BRAND.companyName} S.A.S. is an Ecuadorian technology company based in Cuenca, focused on transforming homes, buildings, businesses, and industrial spaces into connected, secure, efficient, and personalized environments. ${BRAND.companyName} creates integrated systems to improve how people live and work through ecosystems like ${BRAND.companyName} Living, ${BRAND.companyName} Elevate, and ${BRAND.companyName} Core. For more information about our services in automation, security, and infrastructure, visit: https://www.nezuecuador.com/`
    : `${BRAND.companyName} S.A.S. es una empresa ecuatoriana de tecnología con base en Cuenca, enfocada en transformar hogares, edificios, comercios e industrias en espacios conectados, seguros, eficientes y personalizados. ${BRAND.companyName} crea sistemas integrados para mejorar la vida y el trabajo a través de ecosistemas como ${BRAND.companyName} Living, ${BRAND.companyName} Elevate y ${BRAND.companyName} Core. Para más información sobre nuestros servicios de automatización, seguridad e infraestructura, visita: https://www.nezuecuador.com/`;

  return {
    type: 'answer',
    message
  };
}
