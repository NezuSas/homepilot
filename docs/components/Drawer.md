# Drawer

AC80 refinement: `dismissible` defaults false. Backdrop/Escape do not discard editing; close/Cancel remain explicit. `dismissible=true` opts an informational drawer into dismissal without changing focus trap/restore.

**Source:** `apps/operator-console/src/components/ui/Drawer.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Presents lateral details and forms without duplicating portal, backdrop, focus,
keyboard, or global scroll-lock behavior.

## Contract

`DrawerProps` receives `isOpen`, content, and optional close handling. It can
associate a title or description for accessibility and allows panel and
backdrop styling without changing behavior. `hideCloseButton` lets a workflow
provide its own header without duplicating visible actions.

## Usage

Use for persistent side surfaces such as the device inspector. Content uses a
flexible column with internal scrolling when it exceeds viewport height.

## States and Acceptance

Locks document scrolling while open, restores focus after explicit close,
optionally dismisses with Escape, contains Tab navigation, retains focus changes leaving the top layer,
and keeps the panel inside the viewport on mobile, tablet, and desktop.
