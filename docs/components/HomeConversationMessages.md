# HomeConversationMessages

**Sources:** `apps/operator-console/src/components/HomeConversationMessageBubble.tsx`, `HomeConversationTypingIndicator.tsx`, `HomeConversationEmptyState.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Represents initial state, messages, and typing activity for home conversation
with the same shared typography, actions, and surfaces.

## Contract

Bubbles receive a typed message and callback for their options. Initial state
receives text and suggestions from the consuming view. The three components
resolve their own labels through i18n and do not know the endpoint or
conversation logic.

## States and Acceptance

Long text wraps without truncating actionable options, messages retain
`text-body` at every breakpoint, and the typing indicator announces its state
with `role=status`. The user avatar uses a localized label when no profile is
available.