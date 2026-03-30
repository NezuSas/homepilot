import { AutomationRuleRepository } from '../../../domain/repositories/AutomationRuleRepository';
import { DeviceRepository } from '../../../domain/repositories/DeviceRepository';
import { TopologyReferencePort } from '../../ports/TopologyReferencePort';
import { IdGenerator } from '../../../../shared/domain/types';
import { createAutomationRule, AutomationTrigger, AutomationAction, AutomationRule } from '../../../domain';
import { DeviceNotFoundError } from '../../errors';
import { InvalidAutomationRuleError } from '../../../domain/errors';

export interface CreateAutomationRuleRequest {
  homeId: string;
  userId: string;
  name: string;
  trigger: AutomationTrigger;
  action: AutomationAction;
}

/**
 * Caso de uso para crear una nueva regla de automatización.
 * Valida la existencia de dispositivos, la consistencia del hogar y el ownership del emisor (Zero-Trust).
 */
export async function createAutomationRuleUseCase(
  request: CreateAutomationRuleRequest,
  deps: {
    automationRuleRepository: AutomationRuleRepository;
    deviceRepository: DeviceRepository;
    topologyReferencePort: TopologyReferencePort;
    idGenerator: IdGenerator;
  }
): Promise<AutomationRule> {
  // 1. Validar ownership del hogar para el usuario solicitante
  await deps.topologyReferencePort.validateHomeOwnership(request.homeId, request.userId);

  // 2. Validar existencia de ambos dispositivos involucrados
  const triggerDevice = await deps.deviceRepository.findDeviceById(request.trigger.deviceId);
  if (!triggerDevice) throw new DeviceNotFoundError(request.trigger.deviceId);

  const targetDevice = await deps.deviceRepository.findDeviceById(request.action.targetDeviceId);
  if (!targetDevice) throw new DeviceNotFoundError(request.action.targetDeviceId);

  // 3. Validar integridad de ubicación (ambos dispositivos deben pertenecer al mismo hogar de la regla)
  if (triggerDevice.homeId !== request.homeId || targetDevice.homeId !== request.homeId) {
    throw new InvalidAutomationRuleError('device home mismatch');
  }

  // 4. Inicializar la entidad (aplica validaciones internas como prevención de bucles)
  const rule = createAutomationRule({
    homeId: request.homeId,
    userId: request.userId,
    name: request.name,
    trigger: request.trigger,
    action: request.action
  }, deps.idGenerator);

  // 5. Persistencia atómica
  await deps.automationRuleRepository.save(rule);

  return rule;
}
