# UiLabels

**Source:** `apps/operator-console/src/components/ui/uiLabels.ts`
**Family spec:** `specs/operator-console-modular-contract-v1.md`

## Purpose

Lets primitives show their own built-in texts (close button, empty search result,
clear search, confirm and cancel) without importing i18n.

## Contract

`UiLabelsContext` carries a `UiLabels` object; `useUiLabels()` reads it. Defaults
are English. `UiLabelsBridge` (outside `components/ui`) translates the values once
at the app root and re-renders on language change. A prop passed to a primitive
(`closeLabel`, `placeholder`, `confirmText`…) always wins over the context.

## Usage

Primitives call `useUiLabels()`; consumers need no change. Tests can wrap content in
`UiLabelsContext.Provider` to assert translated values.
