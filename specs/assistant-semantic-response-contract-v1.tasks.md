# Assistant Semantic Response Contract V1 — Tasks

Primary specification: [assistant-semantic-response-contract-v1.md](./assistant-semantic-response-contract-v1.md)

## Contract

- [x] Define typed response keys and interpolation values for the bounded initial surface.
- [x] Migrate quick responses and conversational preferences without output changes.
- [x] Migrate the language-override acknowledgement without output changes.
- [x] Migrate the repetitive cancellation acknowledgement without output changes.
- [x] Migrate the bounded core multi-turn confirmation messages without output changes.
- [x] Migrate the bounded generic command, execution, and selection messages without output changes.

## Verification

- [x] Add exhaustive Spanish and English catalog tests.
- [x] Add a CI quality gate for bilingual key completeness and the bounded migrated surface.
- [x] Run typecheck, targeted assistant tests, full builds, and the workspace suite.
