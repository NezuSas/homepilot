# Assistant Interaction Turn Lifecycle V1

**Status:** Implemented  
**Author:** HomePilot Engineering  
**Date:** 2026-08-17

## Problem

Chat, manual microphone capture, and the global wake-word flow previously used separate request counters and abort controllers. Each protected its own callback path, but no shared lifecycle proved that a newer user interaction invalidated every older assistant request and speech response.

## Scope

- Introduce one browser-local turn coordinator shared by chat, manual voice, and wake-word interactions.
- Preserve all existing public HTTP routes and assistant payloads.
- Abort superseded conversation and STT requests, discard stale callbacks, and stop obsolete speech.
- Keep the implementation local to the authenticated browser session; no transcript, audio, token, or prompt is persisted by the coordinator.

## Non-goals

- This spec does not alter device authorization, confirmation, planner behavior, or backend conversation memory.
- It does not replace browser-level microphone permission handling or provide a hardware E2E test harness.

## Functional Requirements

- **FR-01:** Every assistant interaction obtains a typed `turnId` and origin (`chat`, `manual_voice`, or `wake_word`).
- **FR-02:** Starting a new turn aborts the previous turn and notifies active UI owners exactly once.
- **FR-03:** Conversation, STT, and TTS callbacks verify that their turn is still current before changing UI state, sending speech, or presenting a result.
- **FR-04:** Cancellation must be recoverable: the composer becomes available and stale errors are not rendered.
- **FR-05:** The STT helper accepts caller cancellation in addition to its existing timeout behavior.

## Acceptance Criteria

- [x] **AC-01:** A replacement turn aborts the previous signal and only the new turn remains current.
- [x] **AC-02:** A stale chat or wake-word response cannot render or speak after a newer turn begins.
- [x] **AC-03:** A manual voice STT request is cancelled when its turn is invalidated and resolves safely without an error bubble.
- [x] **AC-04:** Existing assistant HTTP contracts remain unchanged.
- [x] **AC-05:** Coordinator and STT cancellation behavior are covered by automated tests.

## Evidence

- `apps/operator-console/src/lib/assistantTurnCoordinator.ts`
- `apps/operator-console/src/views/HomeConversationView.tsx`
- `apps/operator-console/src/App.tsx`
- `apps/operator-console/src/lib/assistantApi.ts`
- `apps/operator-console/src/lib/__tests__/assistantTurnCoordinator.test.ts`
- `apps/operator-console/src/lib/__tests__/assistantApi.test.ts`