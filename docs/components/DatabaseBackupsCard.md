# DatabaseBackupsCard

**Source:** `apps/operator-console/src/components/DatabaseBackupsCard.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`
**Domain spec:** `specs/edge-platform-foundations-v1.md`

## Purpose

Presents local database backup status and lets an administrator explicitly
create a new backup.

## Contract

Receives safe metadata (`filename`, `sizeBytes`, `createdAt`), loading and
creation state, and separate refresh and create callbacks. It makes no HTTP
request and knows no filesystem path.

## Usage

Use only in an administrative surface that has already authorized backup
access. The consumer obtains data through protected endpoints and neither
provides nor persists internal paths.

## States and Acceptance

Keeps backups visible while refreshing, shows a localized empty state when none
exist, and communicates a localized error without removing previous data.
During creation it blocks duplicate actions and exposes `aria-busy` through the
modular button. On mobile, tablet, and desktop it adapts to available width,
truncating only the filename with an accessible title; date, size, and actions
remain readable.