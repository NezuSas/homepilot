# OverlayAccessibility

**Source:** `apps/operator-console/src/components/ui/useOverlayAccessibility.ts`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Centralizes the accessibility contract for overlays used by `Modal` and
`Drawer`.

## Contract

Receives visibility, close callback, and container reference. It manages
initial focus, Escape, Tab cycle, focus restoration, and document scroll lock.
It keeps an overlay stack so only the top layer retains focus.

## States and Acceptance

When multiple overlays open, document scroll remains locked until the last
closes. The top layer retains focus even during programmatic changes and does
not compete with nested overlays. On close, focus returns to the triggering
element. Behavior is preserved on mobile, tablet, and desktop.