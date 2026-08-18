# Assistant Natural Follow-Up Resolution V1 — Tasks

Primary specification: [assistant-natural-follow-up-resolution-v1.md](./assistant-natural-follow-up-resolution-v1.md)

## Resolution behavior

- [x] Preserve natural Spanish and English phrasing while replacing an unambiguous control reference.
- [x] Restrict substitution to exactly one entity in short-term memory.
- [x] Preserve the existing downstream safety pipeline.

## Verification

- [x] Add Spanish and English natural follow-up tests.
- [x] Retain coverage for positional, clarification, and empty-memory behavior.
- [x] Run targeted assistant tests and workspace typecheck.
