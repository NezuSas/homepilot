import { AssistantPlanV2, PlannerAction, TargetReference, ActionParams } from './ports/AssistantPlannerV2';

export class PlannerV2Validator {
  /**
   * Validates the structure and content of a Planner V2 result.
   * Returns null if valid, or a string describing the error.
   */
  public validate(data: unknown): string | null {
    if (!data || typeof data !== 'object') return 'Plan is null or not an object';

    const plan = data as Partial<AssistantPlanV2>;

    // 1. Basic Shape
    if (!['plan', 'clarification_needed', 'unsupported', 'small_talk'].includes(plan.type as string)) {
      return `Invalid plan type: ${plan.type}`;
    }

    if (typeof plan.plan_confidence !== 'number' || plan.plan_confidence < 0 || plan.plan_confidence > 1) {
      return 'plan_confidence must be a number between 0 and 1';
    }

    if (!Array.isArray(plan.actions)) {
      return 'actions must be an array';
    }

    if (typeof plan.user_feedback_draft !== 'string') {
      return 'user_feedback_draft must be a string';
    }

    // 2. Actions Validation
    for (const action of plan.actions) {
      const err = this.validateAction(action);
      if (err) return err;
    }

    // 3. ID Leakage Protection (Recursive check for ID-like strings)
    const idLeakErr = this.checkIdLeakage(data);
    if (idLeakErr) return idLeakErr;

    return null;
  }

  private validateAction(action: Partial<PlannerAction>): string | null {
    if (!action || typeof action !== 'object') return 'Action is null or not an object';

    const validActionTypes = ['set_state', 'toggle', 'query_status', 'activate_scene'];
    if (!validActionTypes.includes(action.type as string)) {
      return `Invalid action type: ${action.type}`;
    }

    const validCommands = [
      'turn_on', 'turn_off', 'toggle', 'open', 'close', 
      'stop', 'set_position', 'set_brightness', 'query'
    ];
    if (!validCommands.includes(action.command as string)) {
      return `Invalid command: ${action.command}`;
    }

    if (typeof action.confidence !== 'number' || action.confidence < 0 || action.confidence > 1) {
      return 'Action confidence must be a number between 0 and 1';
    }

    // Target validation
    const target = action.target as Partial<TargetReference>;
    if (!target || typeof target !== 'object') return 'Action target is missing';

    const validTargetTypes = ['device', 'room', 'zone', 'category', 'scene', 'alias', 'context_reference'];
    if (!validTargetTypes.includes(target.type as string)) {
      return `Invalid target type: ${target.type}`;
    }

    if (typeof target.name !== 'string' || target.name.trim() === '') {
      return 'Target name must be a non-empty string';
    }

    // Params validation
    if (action.params) {
      const err = this.validateParams(action.params);
      if (err) return err;
    }

    return null;
  }

  private validateParams(params: Partial<ActionParams>): string | null {
    if (params.power && !['on', 'off'].includes(params.power)) {
      return `Invalid power value: ${params.power}`;
    }

    if (params.brightness !== undefined) {
      if (!Number.isInteger(params.brightness) || params.brightness < 0 || params.brightness > 100) {
        return 'Brightness must be an integer between 0 and 100';
      }
    }

    if (params.position !== undefined) {
      if (!Number.isInteger(params.position) || params.position < 0 || params.position > 100) {
        return 'Position must be an integer between 0 and 100';
      }
    }

    const validTemps = ['warm', 'neutral', 'cool'];
    if (params.colorTemperature && !validTemps.includes(params.colorTemperature)) {
      return `Invalid colorTemperature: ${params.colorTemperature}`;
    }

    return null;
  }

  /**
   * Scans the data for strings that look like IDs (UUIDs, HA entity IDs, etc.)
   */
  private checkIdLeakage(obj: unknown): string | null {
    if (!obj || typeof obj !== 'object') return null;

    // UUID Regex (Common pattern for DB/Service IDs)
    const uuidRegex = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
    
    // Narrow Integration ID Regex (e.g. light.kitchen, lock.front_door)
    const integrationPrefixes = [
      'light', 'switch', 'sensor', 'binary_sensor', 'cover', 
      'climate', 'media_player', 'lock', 'alarm_control_panel'
    ].join('|');
    const integrationRegex = new RegExp(`^(${integrationPrefixes})\\.[a-z0-9_]+$`, 'i');

    const stack: unknown[] = [obj];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || typeof current !== 'object') continue;

      const record = current as Record<string, unknown>;

      for (const key in record) {
        if (!Object.prototype.hasOwnProperty.call(record, key)) continue;

        const value = record[key];
        if (typeof value === 'string') {
          if (uuidRegex.test(value)) return `ID Leakage detected: "${value}" matches UUID pattern`;
          if (integrationRegex.test(value)) return `ID Leakage detected: "${value}" matches integration pattern`;
        } else if (value && typeof value === 'object') {
          stack.push(value);
        }
      }
    }
    return null;
  }
}
