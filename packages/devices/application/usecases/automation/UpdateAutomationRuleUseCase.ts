import { AutomationRuleRepository } from '../../../domain/repositories/AutomationRuleRepository';
import { DeviceRepository } from '../../../domain/repositories/DeviceRepository';
import { TopologyReferencePort } from '../../ports/TopologyReferencePort';
import { AutomationRule, AutomationTrigger, AutomationAction, updateAutomationRule, UpdateAutomationRulePatch } from '../../../domain';
import { AutomationRuleNotFoundError, DeviceNotFoundError } from '../../errors';
import { InvalidAutomationRuleError } from '../../../domain/errors';

export interface UpdateAutomationRuleRequest {
  readonly name?: string;
  readonly trigger?: AutomationTrigger;
  readonly action?: AutomationAction;
}

/**
 * Caso de uso: Actualizar de forma parcial (PATCH semántico) una regla de automatización.
 *
 * Campos actualizables: name, trigger, action.
 * Campos inmutables: id, homeId, userId, enabled.
 *
 * Revalidación de dispositivos:
 * - Solo se revalida la existencia y consistencia de hogar si trigger o action son modificados.
 * - La prevención de bucle se reevalúa siempre a través de la función de dominio updateAutomationRule.
 *
 * Zero-Trust: se valida ownership del hogar antes de cualquier mutación.
 */
export async function updateAutomationRuleUseCase(
  ruleId: string,
  userId: string,
  request: UpdateAutomationRuleRequest,
  deps: {
    automationRuleRepository: AutomationRuleRepository;
    deviceRepository: DeviceRepository;
    topologyReferencePort: TopologyReferencePort;
  }
): Promise<AutomationRule> {
  // 1. Localizar la regla; falla explícitamente si no existe (AC8)
  const existing = await deps.automationRuleRepository.findById(ruleId);
  if (!existing) throw new AutomationRuleNotFoundError(ruleId);

  // 2. Validar ownership del hogar asignado a la regla (Zero-Trust, AC7)
  await deps.topologyReferencePort.validateHomeOwnership(existing.homeId, userId);

  // 3. Revalidar dispositivos, pero SOLO si trigger o action son parte del patch
  //    Optimización: si el patch no toca dispositivos, omitir las llamadas al repositorio.
  const touchesDevices = request.trigger !== undefined || request.action !== undefined;

  if (touchesDevices) {
    // Determinar los IDs finales a validar (nuevo valor o el valor existente si no se modifica)
    const triggerDeviceId = request.trigger?.deviceId ?? existing.trigger.deviceId;
    const targetDeviceId = request.action?.targetDeviceId ?? existing.action.targetDeviceId;

    // Validar existencia del dispositivo disparador
    const triggerDevice = await deps.deviceRepository.findDeviceById(triggerDeviceId);
    if (!triggerDevice) throw new DeviceNotFoundError(triggerDeviceId);

    // Validar existencia del dispositivo objetivo
    const targetDevice = await deps.deviceRepository.findDeviceById(targetDeviceId);
    if (!targetDevice) throw new DeviceNotFoundError(targetDeviceId);

    // Validar que ambos pertenecen al mismo hogar de la regla (AC5)
    if (triggerDevice.homeId !== existing.homeId || targetDevice.homeId !== existing.homeId) {
      throw new InvalidAutomationRuleError('device home mismatch');
    }
  }

  // 4. Delegar la aplicación del patch a la función pura de dominio.
  //    Esta función aplica trimming, valida que el nombre no quede vacío y previene bucles (AC6).
  const patch: UpdateAutomationRulePatch = {
    ...(request.name !== undefined && { name: request.name }),
    ...(request.trigger !== undefined && { trigger: request.trigger }),
    ...(request.action !== undefined && { action: request.action })
  };

  const updated = updateAutomationRule(existing, patch);

  // 5. Persistir mediante save() como upsert
  await deps.automationRuleRepository.save(updated);

  return updated;
}
