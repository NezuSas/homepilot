# UserProfileModal

**Source:** `apps/operator-console/src/components/UserProfileModal.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Lets a person update visible name and local avatar without duplicating console
dialog visual or accessibility infrastructure.

## Contract

Receives authenticated user, `onClose`, and `onSaved`. It uses `Modal` for
portal, focus, Escape, Tab cycle, scrolling, and responsive footer. The
component locally manages avatar loading, crop, zoom, and persistence.

## Usage

Open from the session profile. It creates no global store and modifies no
permissions. Visible text and accessible labels come from ES/EN i18n.

## States and Acceptance

Keeps the loaded profile while editing, presents localized loading, and blocks
close or double save during persistence. Crop retains touch control, accessible
zoom, and actions visible within the viewport.