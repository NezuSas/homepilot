# Modal

**Source:** `apps/operator-console/src/components/ui/Modal.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Application-shell dialog container for forms, details, and non-destructive
confirmations.

## Contract

`ModalProps` receives `isOpen`, `onClose`, title, description, optional
children, variant, and close control. `headerAlign`, `headerClassName`, and
`contentClassName` adapt broad form composition without duplicating overlay,
focus, scroll, or close button. `footer` and `footerClassName` keep critical
actions fixed outside the scrolling area. `layerClassName` adjusts portal layer
precedence when a flow requires it. `closeLabel` resolves through consumer i18n
or uses `common.close`. It locks body scroll while open.

## Usage

Content must be scrollable and actions remain visible. Use `ConfirmModal` for
critical confirmation.

## States and Acceptance

Supports default, info, danger, warning, and success variants, backdrop,
initial focus, focus restoration, Escape, and Tab cycling; it also retains
focus that leaves due to a programmatic interaction and respects nested
dialogs. It preserves mobile, tablet, and desktop viewport behavior. Optional
children support confirmations that show only a shared header and footer. Title
and description reserve close-control space, wrap long text, and footer actions
may wrap inside the viewport.