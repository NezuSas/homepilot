# LoadingState

**Source:** `apps/operator-console/src/components/ui/LoadingState.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Presents initial loading uniformly, accessibly, and with consumer-provided
translations using skeletons rather than competing initial-load spinners.

## Contract

Receives an already translated `label`, `sm`, `md`, or `lg` scale, and standard
container attributes. `layout` selects `list` (default), compact `cards`, or
the Home `home` hero and routine placeholders. It exposes `role="status"`,
`aria-busy="true"`, atomic `aria-live`, and a translated accessible label.
All placeholder shapes are decorative and contain no interactive controls.

## Usage

Use only while a view has no data to show. During a later refresh, keep prior
information visible and use localized feedback when needed. Consumers coordinate
their required initial requests, including favorites, before presenting results.
`useInitialLoading` latches the first completed presentation so refresh does not
replace it. Failed requests must settle loading rather than block forever.
Widget-specific geometric skeletons (Dashboard/Energy) remain in place; busy
feedback on an individual action is not replaced by a view skeleton.

## States and Acceptance

Uses the shared palette, radius and compact grid geometry. The gentle pulse
respects reduced-motion preferences. The message is announced atomically. It neither
fetches data nor creates global state nor contains hard-coded text.
