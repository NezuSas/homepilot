# AssistantCard

**Source:** `apps/operator-console/src/components/ui/AssistantCard.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Reusable surface for an assistant recommendation, finding, or action without
containing AI logic.

## Contract

Receives content, visual priority, and actions derived by the assistant view or
store. It associates title and description for screen readers, keeps its icon
decorative, and semantically excludes a dismissed finding.

## Usage

Use for interpreted findings; do not use it to issue commands directly or show
sensitive reasoning without authorization.

## States and Acceptance

Keeps information, action, empty, and loading states compact and translated by
the consumer. It reduces padding on mobile and lets category, severity, text,
and long actions wrap without overflow. Direct buttons use the available touch
width on mobile and recover natural width from tablet upward. A finding with
`isDismissed` retains neither focus nor residual accessible context.