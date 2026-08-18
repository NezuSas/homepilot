# HomeConversationComposer

**Source:** `apps/operator-console/src/components/HomeConversationComposer.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Composes text, voice input, microphone selection, and speech output for talking
to the home.

## Contract

Receives text, browser capabilities, translated labels including operational
state, and callbacks for sending, recording, speech output, and audio source.
It does not interpret commands or retain global state.

## Usage

Use in the conversation view. The view owns the request lifecycle and avoids
replacing existing messages during refresh.

## States and Acceptance

Stays anchored to the bottom edge while scrolling, preserves the mobile safe
area, and lets voice controls wrap inside available width. The field retains
focus, exposes accessible help, and the send action remains adjacent to the
composer. The status indicator announces the localized ready or sending label,
and labels do not truncate at narrow widths.