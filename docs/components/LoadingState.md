# LoadingState

**Source:** `apps/operator-console/src/components/ui/LoadingState.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Presents initial loading uniformly, accessibly, and with consumer-provided
translations without mixing spinner implementations across views.

## Contract

Receives an already translated `label`, `sm`, `md`, or `lg` scale, and standard
container attributes. It exposes `role="status"`, announces changes through
`aria-live`, and marks the icon decorative.

## Usage

Use only while a view has no data to show. During a later refresh, keep prior
information visible and use localized feedback when needed.

## States and Acceptance

Preserves centered layout, typographic scale, and contrast through design
tokens. The message is announced atomically to screen readers. It neither
fetches data nor creates global state nor contains hard-coded text.