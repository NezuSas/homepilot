# Assistant Domestic Use-Case Verification V1

**Status:** Implemented  
**Author:** HomePilot Engineering  
**Date:** 2026-08-17

## Purpose

Provide an explicit, executable trace from the seven domestic assistant use cases in `nezu-domestic-assistant-v1` to the integration-level test suites that exercise the conversation service, command path, and browser interaction lifecycle.

## Use-Case Coverage

| Use case | Executable evidence | Verified behavior |
|---|---|---|
| UC-01 Control a device | `assistant_fast_path_integration.test.ts` | An allowed device command is resolved and dispatched through the assistant path. |
| UC-02 Control by room | `assistant_context_room_fast_path.test.ts` | Room-scoped lights resolve deterministically, and ambiguous rooms require clarification. |
| UC-03 Execute a routine | `assistant_conversation_service.test.ts` | Scene and automation requests remain reviewable and use confirmation-aware execution. |
| UC-04 Query status | `assistant_conversation_service.test.ts` and `assistant_fast_path_integration.test.ts` | State queries report authorized current state without a command dispatch. |
| UC-05 Ambiguous request | `assistant_context_room_fast_path.test.ts` and `assistant_conversation_service.test.ts` | Multiple matches persist bounded clarification options instead of choosing a target. |
| UC-06 Interrupt | `assistantTurnCoordinator.test.ts` and `assistantApi.test.ts` | A replacement interaction aborts stale conversation, STT, and TTS work. |
| UC-07 Recoverable error | `assistantApi.test.ts` and `AssistantRoutes.test.ts` | STT/TTS failure, timeout, malformed payload, and service unavailability keep the written interaction recoverable. |

## Acceptance Criteria

- [x] **AC-01:** Every UC-01 through UC-07 has at least one executable test at an interaction boundary.
- [x] **AC-02:** Device control and routine execution remain subject to the existing authorization and confirmation flow.
- [x] **AC-03:** Voice interruption and failure recovery are covered independently from backend command execution.
- [x] **AC-04:** The mapping is maintained in English alongside the primary residential assistant specification.
