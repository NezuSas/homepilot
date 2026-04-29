/**
 * HomePilot Assistant Planner V2 Contract
 * 
 * Defines the structured JSON output expected from the LLM when acting as a planner.
 * This contract is strictly hardware-agnostic and uses natural language references.
 */

export type TargetReferenceType = 
  | 'device' 
  | 'room' 
  | 'zone' 
  | 'category' 
  | 'scene' 
  | 'alias' 
  | 'context_reference';

/**
 * Normalized context hints to avoid character encoding issues and provide
 * a stable set of triggers for the resolution engine.
 */
export type ContextHint = 
  | 'turn_it_on'
  | 'turn_it_off'
  | 'first_option'
  | 'above_area'
  | 'it'
  | 'them';

export interface TargetReference {
  type: TargetReferenceType;
  name: string; // The natural name mentioned (e.g., "cocina", "luz de la mesa")
  context_hint?: ContextHint;
}

export type PlannerActionType = 
  | 'set_state' 
  | 'toggle' 
  | 'query_status' 
  | 'activate_scene';

export type PlannerCommand = 
  | 'turn_on'
  | 'turn_off'
  | 'toggle'
  | 'open'
  | 'close'
  | 'stop'
  | 'set_position'
  | 'set_brightness'
  | 'query';

export interface ActionParams {
  power?: 'on' | 'off';
  brightness?: number; // 0-100
  colorTemperature?: 'warm' | 'neutral' | 'cool';
  color?: string; // hex or name
  position?: number; // 0-100
}

export interface PlannerAction {
  type: PlannerActionType;
  target: TargetReference;
  command: PlannerCommand;
  params?: ActionParams;
  confidence: number; // 0.0 to 1.0
  llm_confirmation_hint?: string; // Advisory reasoning only
}

export interface AssistantPlanV2 {
  type: 'plan' | 'clarification_needed' | 'unsupported' | 'small_talk';
  plan_confidence: number;
  actions: PlannerAction[];
  
  unsupported_items?: Array<{
    request: string;
    reason: string;
  }>;
  
  clarification?: {
    question: string;
    options_labels: string[]; // No IDs
    missing_info?: 'target' | 'command' | 'room';
  };
  
  user_feedback_draft: string;
}

/**
 * JSON Schema for LLM System Prompt.
 */
export const PLANNER_V2_SCHEMA = {
  type: "object",
  properties: {
    type: { enum: ["plan", "clarification_needed", "unsupported", "small_talk"] },
    plan_confidence: { type: "number", minimum: 0, maximum: 1 },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { enum: ["set_state", "toggle", "query_status", "activate_scene"] },
          target: {
            type: "object",
            properties: {
              type: { enum: ["device", "room", "zone", "category", "scene", "alias", "context_reference"] },
              name: { type: "string" },
              context_hint: { enum: ["turn_it_on", "turn_it_off", "first_option", "above_area", "it", "them"] }
            },
            required: ["type", "name"]
          },
          command: { enum: ["turn_on", "turn_off", "toggle", "open", "close", "stop", "set_position", "set_brightness", "query"] },
          params: {
            type: "object",
            properties: {
              power: { enum: ["on", "off"] },
              brightness: { type: "integer", minimum: 0, maximum: 100 },
              colorTemperature: { enum: ["warm", "neutral", "cool"] },
              color: { type: "string" },
              position: { type: "integer", minimum: 0, maximum: 100 }
            }
          },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          llm_confirmation_hint: { type: "string" }
        },
        required: ["type", "target", "command", "confidence"]
      }
    },
    unsupported_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          request: { type: "string" },
          reason: { type: "string" }
        },
        required: ["request", "reason"]
      }
    },
    clarification: {
      type: "object",
      properties: {
        question: { type: "string" },
        options_labels: { type: "array", items: { type: "string" } },
        missing_info: { enum: ["target", "command", "room"] }
      },
      required: ["question", "options_labels"]
    },
    user_feedback_draft: { type: "string" }
  },
  required: ["type", "plan_confidence", "actions", "user_feedback_draft"]
};
