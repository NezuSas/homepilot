# ConfirmModal

**Source:** `apps/operator-console/src/components/ConfirmModal.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Requests explicit confirmation before a sensitive or destructive action.

## Contract

Receives open state, title, description, labels, asynchronous confirmation
callback, and close callback. It reuses `Modal` for portal, focus, Escape, Tab
containment, viewport, and scrolling. It manages submission state to prevent
double execution.

## Usage

Use for delete, disconnect, reset, or impact-bearing actions. Do not use it for
simple toggles or voice commands already confirmed by their policy.

## States and Acceptance

The action is blocked during submission; cancel and close do not execute the
intent; labels are translated by the consumer. While submitting, Escape,
backdrop, and the close button cannot close the modal.