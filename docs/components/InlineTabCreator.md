# InlineTabCreator

**Source:** `apps/operator-console/src/components/InlineTabCreator.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Quickly captures a new tab name within dashboard navigation.

## Contract

Receives `onConfirm`, `onCancel`, placeholder, and `initialValue`. It focuses
the field on open and normalizes title with `trim` before confirming.

## Usage

Use only for tab creation or rename. Uniqueness validation and persistence
belong to the dashboard workflow.

## States and Acceptance

Enter confirms a non-empty value, Escape cancels, and the confirmation button
does not allow empty titles. The field can shrink within horizontal navigation
without forcing overflow or separating confirm and cancel actions.