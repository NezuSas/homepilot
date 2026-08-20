# Tasks: Nezu Domestic Assistant V1

Primary specification: [nezu-domestic-assistant-v1.md](./nezu-domestic-assistant-v1.md)

## Product preparation

- [x] Define the Nezu residential identity without introducing a parallel assistant.
- [x] Bound scope, exclusions, and the HomePilot source of truth.
- [x] Define the interaction lifecycle, cancellation, and stale-response prevention.
- [x] Define requirements for permissions, confirmation, privacy, i18n, and accessibility.
- [x] Record acceptance criteria and open decisions.

## Phase A — Contracts and lifecycle

- [x] Inventory current chat, wake-word, STT, TTS, and execution states against RF-01 and RF-02. Evidence: `assistant-interaction-turn-lifecycle-v1.md`.
- [x] Define the internal turn contract without changing public HTTP routes. Evidence: `AssistantTurnCoordinator`.
- [x] Centralize callback invalidation by `turnId` and origin.
- [x] Add tests for cancellation and late-response races.

## Phase B — Robust voice

- [x] Verify one STT request for each accepted manual capture. Evidence: the Playwright `Manual voice capture` scenario verifies one local recording, one STT request, and one assistant conversation request.
- [x] Verify one STT request for each accepted wake-word capture. Evidence: the Playwright `Global wake activation` scenario verifies one accepted capture, one STT request, and one assistant conversation request.
- [x] Cover 409, timeout, empty transcript, and interruption without leaving interaction locks. Evidence: assistant API cancellation and recovery tests.
- [x] Verify that the wake-word listener clears the previous turn and emits only one acknowledgement sound. Evidence: the Playwright `Global wake activation` scenario verifies one acknowledgement for an accepted activation containing a command.
- [x] Confirm a written fallback when TTS fails or is cancelled. Evidence: `assistantApi.test.ts`.

## Phase C — Context and safety

- [x] Verify that context contains only authorized entities. Evidence: `assistant_home_isolation.test.ts`.
- [x] Validate the confirmation policy by origin and sensitivity. Evidence: `assistant_bulk_confirmation.test.ts` and `assistant_bulk_room_parity.test.ts`.
- [x] Reduce repetitive technical audit events while retaining actionable data. Evidence: `assistant-audit-noise-reduction-v1.md` and `HomeAssistantRealtimeSyncManager.test.ts`.
- [x] Ensure secrets, audio, and prompts never reach the UI or ordinary logs. Evidence: sanitized assistant telemetry and privacy tests.

## Phase D — Residential experience

- [x] Define the bounded semantic-result contract and response-key catalog without changing the public conversation response. Evidence: `assistant-semantic-response-contract-v1.md`.
- [ ] Migrate assistant success, error, clarification, confirmation, and cancellation copy to central i18n catalogs with typed parameters.
- [ ] Add validation that detects missing assistant keys in Spanish or English and new literal text outside approved catalogs.
- [x] Verify that tone variants never alter the confirmed result or reveal out-of-context data. Evidence: `assistant-personalization-safety-v1.md` and `assistant_home_isolation.test.ts`.

- [x] Apply concise responses without unsolicited inventory.
- [x] Persist a per-user local preference for concise, standard, or detailed responses without changing actions, confirmations, or permissions.
- [x] Preserve natural Spanish and English phrasing for unambiguous single-entity follow-ups without bypassing safety. Evidence: `assistant-natural-follow-up-resolution-v1.md`.
- [ ] Confirm complete Spanish and English translation, including TTS.
- [x] Verify the chat and voice composer on desktop, tablet, mobile, and virtual keyboard. Evidence: `responsive-shell.spec.ts` covers desktop, tablet, mobile, and a reduced `visualViewport` for the mobile virtual keyboard; manual and wake-word capture scenarios cover the local voice controls.
- [x] Validate state synchronization across every relevant surface. Evidence: `HomeConversationView` forces the shared device snapshot after non-failed execution; Home, Spaces, Dashboards, and device widgets consume that store; `useDeviceSnapshotStore.test.ts` proves that an in-flight pre-command refresh produces exactly one post-command refresh and that reset prevents a queued request after logout.

## Phase E — Providers and voice quality

- [x] Inventory the wake-word listener, local Whisper, and Piper against the provider contracts defined in the specification. Evidence: `assistant-voice-provider-baseline-v1.md`.
- [x] Centralize `turnId`, cancellation, and callback invalidation for every interaction origin. Evidence: `AssistantTurnCoordinator`.
- [ ] Add explicit, secure administrative configuration for optional premium providers.
- [x] Verify fallback to Piper or written text when TTS is unavailable, fails, or is cancelled. Evidence: `assistantApi.test.ts`.
- [x] Prohibit cloning, imitation, or attribution of third-party voices in configuration and documentation. Evidence: `assistant-voice-provider-baseline-v1.md`.
- [ ] Run a controlled Spanish `Ok Nezu` evaluation: precision, false positives, silence, and residential noise.
- [x] Verify that the HomePilot language governs text and TTS independently from the browser. Evidence: `apiClient.test.ts` and `AssistantRoutes.test.ts`.

## Phase F — Quality and deployment

- [x] Verify integration coverage for UC-01 through UC-07. Evidence: `assistant-domestic-use-case-verification-v1.md`.
- [x] Run `npm run typecheck`.
- [x] Run `npm run build`.
- [x] Run `npm run build --prefix apps/operator-console`.
- [x] Run `npm run test`.
- [x] Validate `docker compose up --build` in a supported installation environment.
