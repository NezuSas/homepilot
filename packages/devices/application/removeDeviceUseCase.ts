import { AutomationAction, AutomationTrigger } from '../domain/automation/types';
import { AutomationRuleRepository } from '../domain/repositories/AutomationRuleRepository';
import { DeviceRepository } from '../domain/repositories/DeviceRepository';
import { SceneRepository } from '../domain/repositories/SceneRepository';
import { DeviceInUseError, DeviceNotFoundError } from './errors';

export interface RemoveDeviceDependencies {
  deviceRepository: DeviceRepository;
  sceneRepository: SceneRepository;
  automationRuleRepository: AutomationRuleRepository;
}

function triggerReferencesDevice(trigger: AutomationTrigger, deviceId: string): boolean {
  if (trigger.type === 'device_state_changed') return trigger.deviceId === deviceId;
  if (trigger.type === 'compound') {
    return trigger.conditions.some((condition) => triggerReferencesDevice(condition, deviceId));
  }
  return false;
}

function actionReferencesDevice(action: AutomationAction, deviceId: string): boolean {
  if (action.type === 'device_command') return action.targetDeviceId === deviceId;
  if (action.type === 'delay') return actionReferencesDevice(action.then, deviceId);
  return false;
}

export async function removeDeviceUseCase(
  deviceId: string,
  deps: RemoveDeviceDependencies,
): Promise<void> {
  const device = await deps.deviceRepository.findDeviceById(deviceId);
  if (!device) throw new DeviceNotFoundError(deviceId);

  const [scenes, automationRules] = await Promise.all([
    deps.sceneRepository.findAll(),
    deps.automationRuleRepository.findAll(),
  ]);

  const sceneUsesDevice = scenes.some((scene) =>
    scene.actions.some((action) => action.deviceId === deviceId)
  );
  const automationUsesDevice = automationRules.some((rule) =>
    triggerReferencesDevice(rule.trigger, deviceId)
    || actionReferencesDevice(rule.action, deviceId)
  );

  if (sceneUsesDevice || automationUsesDevice) {
    throw new DeviceInUseError(deviceId);
  }

  await deps.deviceRepository.deleteDevice(deviceId);
}
