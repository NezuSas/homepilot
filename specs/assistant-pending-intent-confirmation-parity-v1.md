# Assistant Pending-Intent Confirmation Parity V1

**Status:** Implemented
**Author:** HomePilot Engineering
**Date:** 2026-08-17

## Problem

Single-device conversational intents already expired after five minutes when a user replied in natural language. The UI confirmation control did not apply that same expiry check, so it could execute a stale pending intent.

## Scope

- Apply the existing five-minute pending-intent confirmation window to both natural-language and UI confirmation origins.
- Reject invalid or future timestamps as inactive.
- Clear the expired pending state and return a localized expiry response without dispatching a command.

## Non-goals

- This does not change the dedicated 120-second bulk confirmation-ticket policy.
- This does not migrate other pending conversational states to confirmation tickets.
- This does not change confirmation requirements, role checks, or device authorization.

## Functional Requirements

- **FR-01:** A pending intent may execute only when its timestamp is valid, not in the future, and younger than five minutes.
- **FR-02:** UI `confirm` and natural-language affirmative replies use the same activity predicate.
- **FR-03:** An expired or invalid pending intent is cleared and never dispatched.
- **FR-04:** The expiry response is available in Spanish and English through the typed response catalog.

## Acceptance Criteria

- [x] **AC-01:** A UI confirmation for an intent older than five minutes does not execute the command.
- [x] **AC-02:** A natural-language confirmation for an intent older than five minutes does not execute the command.
- [x] **AC-03:** Both expired paths clear `pendingIntent` and return the same localized expiry response.
- [x] **AC-04:** A future timestamp is rejected as inactive and cannot dispatch a command.
- [x] **AC-05:** A current pending intent continues through the existing confirmation and execution pipeline.

## Evidence

- `packages/assistant/application/AssistantConversationService.ts`
- `packages/assistant/application/response/AssistantResponseCatalog.ts`
- `packages/assistant/__tests__/assistant_conversation_service.test.ts`