export interface AutomationBuilderDevice {
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
  trigger: AutomationTriggerConfig & { type: 'device_state_changed' | 'time' };
  action: AutomationActionConfig & { type: 'device_command' | 'execute_scene' };
}
