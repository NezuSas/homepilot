# SPEC: Home Conversation Experience V1

**Status:** Implemented
**Date:** 2026-08-21
**Scope:** Professional visual redesign of the existing Home Conversation experience.

## Problem Statement

The conversation screen contained the required functional flows but presented them as disconnected bubbles over a mostly empty canvas. The welcome state, action confirmations, and active message thread lacked a common visual hierarchy, leaving the assistant less trustworthy and less intentional than the rest of HomePilot.

## Scope

- Replace the conversation composition with a token-based local command workspace.
- Present an empty state as a focused conversational entry with three real suggested commands and a prominent command composer.
- Give the active conversation a readable assistant timeline, differentiated user intent, explicit execution and confirmation surfaces, an explicit request lifecycle, and a persistent command dock.
- Preserve a local, read-only conversation transcript per signed-in resident for the current browser session; stale action choices are never restored.
- Preserve all assistant messages, intent handling, confirmation policy, voice controls, keyboard behavior, API contracts, sessions, and device actions.

## Out of Scope

- Changes to assistant intent handling, messages, execution policy, API, storage, or authorization.
- New backend endpoints, execution-policy changes, or persistent server-side conversation storage.
- Restoring pending confirmations or clarification actions after a reload.

## Acceptance Criteria

- **AC1:** The empty conversation is visually distinct from the prior loose card: it uses a focused, low-chrome conversational entry with localized title, description, and three real suggestions.
- **AC2:** Selecting a suggestion invokes the same existing send flow as before.
- **AC3:** Active messages use a consistent assistant timeline, differentiated user messages, and semantic confirmation/execution surfaces without duplicating controls.
- **AC4:** The command composer remains fixed at the bottom across desktop, tablet, and mobile; welcome suggestions reflow to one column on narrow screens.
- **AC5:** Dark and light themes use only existing semantic tokens, with deliberate surface contrast and accessible readable text.
- **AC6:** A resident sees explicit visible state for listening, transcription, local consultation, and ready/error recovery. An in-flight text request can be cancelled without executing any subsequent response.
- **AC7:** The welcome state exposes only contextual command suggestions. Suggestions that may require confirmation carry an accessible protection cue; full scope and confirmation appear only when the action is proposed. Confirmation uses the primary interaction color while success remains green.
- **AC8:** A session-local transcript survives a refresh for the same signed-in resident, strips interactive action options before restoration, and can be deliberately cleared with a visible new-conversation control.
- **AC9:** Clarification options initially show no more than four choices, then reveal the remainder through a deliberate control.
- **AC10:** Typecheck, tests, both builds, responsive browser tests, spec coverage, and runtime Docker validation pass.