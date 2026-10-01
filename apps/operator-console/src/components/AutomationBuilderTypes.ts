import type { SnapshotDevice } from '../stores/useDeviceSnapshotStore';

export interface AutomationBuilderDevice extends Pick<SnapshotDevice, 'type' | 'semanticType' | 'capabilities'> {
  id: string;
  name: string;
}

export interface AutomationBuilderScene {
  id: string;
  name: string;
}

export interface AutomationTriggerConfig {
  type?: 'device_state_changed' | 'time';
  deviceId?: string;
  stateKey?: string;
  expectedValue?: string;
  time?: string;
  timeLocal?: string;
  days?: number[];
}

export interface AutomationActionConfig {
  type?: 'device_command' | 'execute_scene';
  targetDeviceId?: string;
  command?: string;
  sceneId?: string;
}

export interface AutomationRuleDraft {
  id: string;
  name: string;
  icon?: string;
  trigger: AutomationTriggerConfig & { type: 'device_state_changed' | 'time' };
  action: AutomationActionConfig & { type: 'device_command' | 'execute_scene' };
}
