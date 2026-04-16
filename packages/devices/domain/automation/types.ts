import { DeviceCommandV1 } from '../commands';

/**
 * Represents a trigger based on a device state change.
 */
export interface DeviceStateTrigger {
  type: 'device_state_changed';
  deviceId: string;
  stateKey: string;
  expectedValue: string | number | boolean;
}

/**
 * Represents a trigger based on a specific time-of-day.
 */
export interface TimeTrigger {
  type: 'time';
  timeLocal: string;    // "HH:mm" (User Input)
  timezone: string;     // IANA Timezone, e.g. "America/Guayaquil"
  timeUTC: string;      // "HH:mm" (Server Processed)
  days?: number[];      // [0,1,2,3,4,5,6] - 0 is Sunday

  /** @deprecated use timeLocal and timeUTC */
  time?: string;
}

/**
 * Compound trigger combining multiple sub-triggers with a logical operator.
 *
 * - AND: all conditions must evaluate to true.
 * - OR:  at least one condition must evaluate to true.
 * - NOT: the single condition in `conditions[0]` must evaluate to false.
 *
 * Nesting rules:
 *  - Compound triggers can nest other compound triggers recursively.
 *  - When evaluated against a device state event, TimeTrigger sub-conditions
 *    always evaluate to false (time is checked separately in handleTimeEvent).
 *  - When evaluated against a time event, DeviceStateTrigger sub-conditions
 *    are evaluated against the current device state in the repository.
 */
export interface CompoundTrigger {
  type: 'compound';
  operator: 'AND' | 'OR' | 'NOT';
  /**
   * Sub-conditions. For NOT, exactly one element is expected.
   * For AND/OR, at least two elements are required.
   */
  conditions: AutomationTrigger[];
}

export type AutomationTrigger = DeviceStateTrigger | TimeTrigger | CompoundTrigger;

/**
 * Represents the action of executing a command on a device.
 */
export interface DeviceCommandAction {
  type: 'device_command';
  targetDeviceId: string;
  command: DeviceCommandV1;
}

/**
 * Represents the action of executing a saved scene.
 */
export interface SceneAction {
  type: 'execute_scene';
  sceneId: string;
}

/**
 * Represents a deferred action: wait delaySeconds, then execute a base action.
 *
 * Delay is in-memory only (setTimeout). Pending delays are lost on process
 * restart. Nested delays are not supported (then cannot be DelayAction).
 */
export interface DelayAction {
  type: 'delay';
  delaySeconds: number;
  /** The action to execute after the delay. Cannot be another DelayAction. */
  then: DeviceCommandAction | SceneAction;
}

export type AutomationAction = DeviceCommandAction | SceneAction | DelayAction;

/**
 * Core automation entity.
 * Defines an IF (trigger) THEN (action) relationship.
 */
export interface AutomationRule {
  readonly id: string;
  readonly homeId: string;
  readonly userId: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly trigger: AutomationTrigger;
  readonly action: AutomationAction;
}
