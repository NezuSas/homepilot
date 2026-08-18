# Assistant Audit Noise Reduction V1 — Tasks

Primary specification: [assistant-audit-noise-reduction-v1.md](./assistant-audit-noise-reduction-v1.md)

## Realtime audit behavior

- [x] Define the exact duplicate-event boundary without suppressing meaningful device changes.
- [x] Add structural state comparison for Home Assistant realtime snapshots.
- [x] Preserve state-change, attribute-change, unmapped-event, and persistence-failure paths.

## Verification

- [x] Add realtime synchronization tests for duplicate events and reordered attributes.
- [x] Run targeted integration tests.
- [x] Run typecheck, workspace and console builds, the full test suite, and Docker runtime validation.