# Assistant Pending-Intent Confirmation Parity V1 — Tasks

Primary specification: [assistant-pending-intent-confirmation-parity-v1.md](./assistant-pending-intent-confirmation-parity-v1.md)

## Implementation

- [x] Centralize the existing pending-intent confirmation TTL in `AssistantConversationService`.
- [x] Apply the same active-state predicate to UI and natural-language confirmations.
- [x] Clear stale state before returning a localized expiry response.
- [x] Add the typed Spanish and English response-catalog entry.

## Verification

- [x] Add coverage for expired UI and natural-language confirmation paths.
- [x] Run workspace typecheck, build, frontend build, and tests.
- [x] Rebuild API and UI with Docker Compose and verify API health plus UI HTTP availability.