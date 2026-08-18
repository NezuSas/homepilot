# PageFrame

**Source:** `apps/operator-console/src/components/ui/PageFrame.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Responsive console-view frame for width, spacing, and page hierarchy.

## Contract

Receives children, `immersive`, `maxWidth`, and composition classes. It does
not decide navigation, permissions, or fetching.

## Usage

Use as the root of sidebar views to avoid parallel margins and breakpoints.

## States and Acceptance

Content retains vertical scrolling, adaptive padding, and no intentional
horizontal overflow. The frame limits width to the available viewport and lets
flexible children shrink before creating lateral scrolling.