# Assistant Interaction Turn Lifecycle V1 — Tasks

Primary specification: [assistant-interaction-turn-lifecycle-v1.md](./assistant-interaction-turn-lifecycle-v1.md)

## Turn contract

- [x] Define a browser-local typed turn and origin contract.
- [x] Share the coordinator across chat, manual voice, and wake-word flows.
- [x] Invalidate stale conversation and TTS callbacks before UI updates.
- [x] Propagate turn cancellation to the STT request.

## Verification

- [x] Add unit tests for replacement, listener notification, and explicit cancellation.
- [x] Add an STT cancellation test.
- [x] Run console typecheck, targeted tests, and lint without new errors.