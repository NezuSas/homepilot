# Assistant Sensor Reading Queries V1

**Status:** Approved
**Author:** HomePilot Engineering
**Date:** 2026-08-17

## Problem

HomePilot safely rejects operational commands for sensors, but the conversational assistant does not have a bounded, deterministic route for reporting authorized sensor readings such as temperature or humidity.

## Scope

- Read the latest persisted state of an authorized sensor or binary sensor.
- Resolve explicit Spanish and English temperature, humidity, and generic sensor-reading requests.
- Preserve sensor read-only behavior and existing device-command validation.
- Return a clarification only when multiple authorized sensor readings match.

## Non-goals

- Refreshing a sensor directly from a provider during a conversation.
- Writing, calibrating, or changing a sensor.
- Inferring weather, health, or safety conclusions from a raw reading.
- Changing climate-control commands, Planner V2 execution, authorization, or confirmation policy.

## Functional Requirements

- FR-01: The reading route uses only entities returned by the existing authorization gate.
- FR-02: A reading uses the latest persisted state and optional unit supplied by the integration.
- FR-03: A temperature or humidity query can resolve a single matching authorized sensor by device name or metric vocabulary.
- FR-04: Ambiguous or unavailable readings return a bounded clarification or an explicit availability response.
- FR-05: The route performs no command dispatch, provider write, confirmation, or device-state mutation. It may save scoped, ephemeral clarification memory solely to resolve a user-selected authorized sensor.

## Acceptance Criteria

- [x] AC-01: An authorized Spanish temperature request returns the persisted numeric reading and unit.
- [x] AC-02: An authorized English humidity request returns the persisted reading and unit.
- [x] AC-03: A request matching multiple authorized sensors returns a clarification limited to those sensors.
- [x] AC-04: Missing, unavailable, or unauthorized readings do not disclose data or execute a command.
- [x] AC-05: Existing climate and sensor command validation remain unchanged.
## Evidence

- packages/assistant/application/AssistantConversationService.ts
- packages/assistant/__tests__/assistant_conversation_service.test.ts
- packages/assistant/application/response/AssistantResponseCatalog.ts