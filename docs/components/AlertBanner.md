# AlertBanner

**Source:** `apps/operator-console/src/components/ui/AlertBanner.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Communicates information, success, warning, or failure without replacing
existing content.

## Contract

Receives a variant, message, and optional action content. It associates title
and message for screen readers, keeps its icon decorative, and lets the consumer
decide when to display it and translate its text.

## Usage

Use for meaningful page or form states. Do not use it as a transient toast or
for silent console errors.

## States and Acceptance

Every variant preserves iconography, contrast, and a readable semantic label in
both themes. On mobile, content and action stack vertically, the message may
wrap, and the direct action uses the available width; from tablet upward it
returns to natural width. Warnings and errors announce `role="alert"`;
information and success use `role="status"`. The message is always exposed as
the state description and the title is associated when present.