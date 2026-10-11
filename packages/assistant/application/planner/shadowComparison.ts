import type { AssistantPlanV2 } from '../ports/AssistantPlannerV2';
import type { ShadowErrorInfo, ShadowErrorType, ShadowResolutionResult } from './shadowTypes';

/** Clasifica el mensaje de error de interpretV2 en un tipo de error de sombra. */
export function classifyInterpretError(msg: string): ShadowErrorInfo {
  let type: ShadowErrorType = 'llm_failure';
  if (msg.includes('timed out')) type = 'timeout';
  else if (msg.includes('JSON') || msg.includes('parse')) type = 'invalid_json';
  else if (msg.includes('empty or invalid object')) type = 'empty_plan';
  else if (msg.includes('build') || msg.includes('homeMap')) type = 'build_failure';
  return { message: msg, type };
}

/** Clasifica un error de validación como violación de contrato JSON o fallo de validación. */
export function classifyValidationError(validationError: string): ShadowErrorInfo {
  const isContractError = validationError.includes('Invalid target type') || validationError.includes('target.type');
  return { message: validationError, type: isContractError ? 'invalid_json_contract' : 'validation_failure' as ShadowErrorType };
}

export interface V1V2Comparison {
  likelyV2BetterCandidate: boolean;
  reason: string;
}

/**
 * Compara la respuesta V1 con el plan V2: V2 es mejor candidato solo cuando V1
 * pidió aclaración y V2 produjo un plan válido, confiable y resuelto a un único dispositivo por acción.
 */
export function compareV1V2(
  v1Type: string,
  plan: AssistantPlanV2 | null,
  errorInfo: ShadowErrorInfo | null,
  validationError: string | null,
  resolutionResults: ShadowResolutionResult[]
): V1V2Comparison {
  let likelyV2BetterCandidate = false;
  let comparisonReason = 'v1_not_clarification';

  if (v1Type === 'clarification') {
    if (!plan || errorInfo || validationError) {
      comparisonReason = validationError ? 'v2_validation_failed' : 'v2_invalid_or_error';
    } else if (plan.plan_confidence < 0.8) {
      comparisonReason = 'v2_low_plan_confidence';
    } else if (!plan.actions || plan.actions.length === 0) {
      comparisonReason = 'v2_no_actions';
    } else if (plan.actions.some(a => (a.confidence || 0) < 0.8)) {
      comparisonReason = 'v2_low_action_confidence';
    } else if (resolutionResults.length !== plan.actions.length) {
      comparisonReason = 'v2_resolution_mismatch';
    } else if (resolutionResults.some(r => r.resolvedIds.length !== 1)) {
      comparisonReason = 'v2_resolution_not_single';
    } else {
      likelyV2BetterCandidate = true;
      comparisonReason = 'v2_single_high_confidence_match';
    }
  }

  return { likelyV2BetterCandidate, reason: comparisonReason };
}
