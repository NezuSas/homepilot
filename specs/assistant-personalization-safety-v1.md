# Assistant Personalization Safety V1

**Status:** Implemented  
**Author:** HomePilot Engineering  
**Date:** 2026-08-17

## Problem

Per-user conversation tone and response-detail preferences improve residential interaction, but they must remain presentation-only. A stored preference must never redirect a command, relax confirmation or authorization, alter a device result, or expose information outside the authenticated user's existing context.

## Scope

- Verify the current response-style and conversation-tone boundaries in `AssistantConversationService`.
- Preserve the existing public conversation payload and all device-control behavior.
- Add regression coverage proving that neutral, warm, and formal profiles produce the same confirmed device command and execution result.

## Non-goals

- Changing personality templates, device authorization, confirmation policy, or preference persistence.
- Applying preferences to device execution, clarification, confirmation, or error semantics.
- Introducing a new profile store, API route, or client state.

## Functional Requirements

- **FR-01:** Response style and conversation tone apply only to general conversational responses after the home-control classifier rejects the prompt as a control request.
- **FR-02:** Device commands, confirmations, clarifications, authorization, and execution results bypass response-detail composition and conversational tone prefixes.
- **FR-03:** Personalization remains per-user local preference data; it cannot expand authorized home context.

## Acceptance Criteria

- [x] **AC-01:** Neutral, warm, and formal profiles dispatch the same confirmed device identifier and command for the same authorized request.
- [x] **AC-02:** Concise, standard, and detailed response preferences do not change a confirmed execution message or executor result.
- [x] **AC-03:** A control request does not invoke the general-conversation service where tone and response-detail composition occur.
- [x] **AC-04:** Existing authorization and home-isolation coverage remains the authority for data scope; this change does not add a parallel permission path.
- [x] **AC-05:** Typecheck, targeted assistant tests, full builds, and the workspace suite pass.

## Evidence

- `packages/assistant/application/AssistantConversationService.ts` keeps presentation composition behind `allowResponsePersonalization` and the non-control branch.
- `packages/assistant/__tests__/assistant_conversation_service.test.ts` exercises neutral, warm, and formal profiles through the real confirmed-command path.
- `packages/assistant/__tests__/assistant_home_isolation.test.ts` continues to validate that authorized context never crosses homes.