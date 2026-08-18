# Assistant Voice Provider Baseline V1 — Tasks

Primary specification: [assistant-voice-provider-baseline-v1.md](./assistant-voice-provider-baseline-v1.md)

## Provider inventory

- [x] Document the installed local Whisper STT baseline, language behavior, and bounded input policy.
- [x] Document the installed local Piper TTS baseline, local voice resolution, and fallback behavior.
- [x] Document the browser wake listener ownership and acknowledgement behavior.
- [x] Document the written-response fallback and shared interaction cancellation contract.

## Privacy and reliability

- [x] Restrict wake telemetry to typed, non-content metadata.
- [x] Verify telemetry and interaction cancellation with automated tests.

## Verification

- [x] Run typecheck and targeted console tests.
- [x] Run the full workspace test suite and production builds.
- [x] Start the Docker stack and verify API health.
