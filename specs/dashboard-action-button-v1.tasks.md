# Dashboard Action Button v1 — Tasks

## Status

Implemented

## Tasks

- [x] Add `press` as an explicit device command and `button` capability/profile.
- [x] Map the Home Assistant driver command to `button.press`.
- [x] Expose Action Button in the Section catalog and filter bindings to explicit `press` capability.
- [x] Render a stateless, accessible Action Button with command feedback.
- [x] Add localized English and Spanish copy.
- [x] Add AC1–AC5 tests and run mandatory verification.

## Traceability

| Task | Acceptance criteria |
| --- | --- |
| Command/profile/driver | AC1, AC2 |
| Catalog and binding filter | AC3, AC6 |
| Stateless widget | AC4, AC5 |
| Tests and verification | AC1–AC6 |