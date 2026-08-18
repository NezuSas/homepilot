# HomeConversationHeader

**Source:** `apps/operator-console/src/components/HomeConversationHeader.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Presents conversation operational context, status, and message count without
coupling to assistant transport.

## Contract

Receives title, subtitle, loading state, and message count from its consuming
view. Static labels are resolved through component i18n.

## States and Acceptance

Title and subtitle support long text without horizontal truncation. Edge,
local-execution, state, and count indicators adapt to available width and
retain localized labels.