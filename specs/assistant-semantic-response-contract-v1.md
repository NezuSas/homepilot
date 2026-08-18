# Assistant Semantic Response Contract V1

**Status:** Implemented  
**Author:** HomePilot Engineering  
**Date:** 2026-08-17

## Problem

The assistant currently returns its public `message` string directly from multiple application services. This preserves a stable HTTP contract, but makes language coverage and response consistency difficult to audit. A full migration must not alter command execution, confirmation, authorization, or the established response text without explicit product approval.

## Scope

- Introduce a typed internal response catalog for a bounded, low-risk response surface.
- Keep the public `AssistantConversationResponse.message` contract unchanged.
- Migrate quick responses, conversational-preference acknowledgements, the repetitive cancellation acknowledgement, and the bounded core multi-turn confirmation surface without changing their published Spanish or English text.
- Cover every catalog entry in both supported languages with automated tests.

## Non-goals

- Replacing dynamic execution, clarification, device-state, or confirmation text in this phase.
- Changing public API payloads or returning translation keys to the Operator Console.
- Changing tone, permissions, confirmations, or device behavior.

## Functional Requirements

- **FR-01:** Each migrated message has a typed key and typed interpolation data.
- **FR-02:** The catalog owns the exact Spanish and English output for every migrated key.
- **FR-03:** Callers cannot provide an unknown message key or omit required interpolation data at compile time.
- **FR-04:** A migrated response remains a string in the current HTTP response contract.
- **FR-05:** The quality gate must reject a missing Spanish or English catalog entry and a detached migration in the bounded surface.

## Acceptance Criteria

- [x] **AC-01:** Quick greeting, wellness, and assistant-name responses use a typed catalog.
- [x] **AC-02:** Preferred address, conversation tone, language override, response-style, and cancellation acknowledgements use the same catalog.
- [x] **AC-03:** Spanish and English output matches the established published wording.
- [x] **AC-04:** Every supported key and interpolation branch is tested.
- [x] **AC-05:** Typecheck, assistant tests, and full builds preserve the public conversation contract.
- [x] **AC-06:** The assistant response-catalog quality gate validates every bounded key and language in CI.
- [x] **AC-07:** Alias deletion, draft activation, draft cancellation/failure, pending-confirmation expiry, and no-pending confirmation messages use the typed catalog without output changes.
- [x] **AC-08:** Static generic command, execution, and selection messages use the typed catalog without output changes.
