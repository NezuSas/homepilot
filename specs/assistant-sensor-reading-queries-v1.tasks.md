# Assistant Sensor Reading Queries V1 — Tasks

Primary specification: [assistant-sensor-reading-queries-v1.md](./assistant-sensor-reading-queries-v1.md)

## Implementation

- [x] Add a deterministic sensor-reading classifier and resolver.
- [x] Restrict candidates to authorized sensor and binary-sensor entities.
- [x] Format persisted readings with integration-provided units when present.
- [x] Preserve a no-dispatch, read-only interaction path.

## Verification

- [x] Add Spanish, English, ambiguity, unavailable, and authorization-boundary tests.
- [x] Run typecheck, full tests, backend build, frontend build, and Docker runtime validation.