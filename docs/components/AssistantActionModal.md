# AssistantActionModal

**Source:** `apps/operator-console/src/components/AssistantActionModal.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Executes a concrete assistant-suggested action without duplicating the visual
or accessibility infrastructure of console dialogs.

## Contract

Receives the finding identifier, typed action, optional device name, and close
and success callbacks. It uses `Modal` for portal, focus, Escape, Tab cycle,
scroll, and responsive composition. Its forms retain room assignment, device
rename, device import, and draft activation flows.

## Usage

Open only from an assistant suggestion that already provides a valid action. The
consumer refreshes data through `onSuccess`; this component neither knows nor
modifies global stores.

## States and Acceptance

Confirmation is blocked while sending, preventing close or double execution.
Actions remain visible in the fixed modal footer and long content retains
internal scrolling on mobile, tablet, and desktop.