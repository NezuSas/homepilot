# Assistant Voice Provider Baseline V1

**Status:** Implemented  
**Author:** HomePilot Engineering  
**Date:** 2026-08-17

## Purpose

Define the production baseline for HomePilot voice interaction without claiming a cloud or premium provider that has not been selected, provisioned, and evaluated on target Edge hardware.

## Scope

- Browser capture for manual voice and global wake-word interaction.
- Local Whisper speech-to-text, local Kokoro speech synthesis, and local Piper fallback synthesis.
- English and Spanish provider selection where the installed local models support them.
- Cancellation, timeouts, wake acknowledgement, and privacy-preserving client telemetry.

## Non-goals

- Selecting, provisioning, or billing a cloud STT/TTS provider.
- Claiming a measured wake-word false-acceptance or false-rejection rate without a physical hardware evaluation.
- Persisting raw audio, transcripts, prompts, generated speech, API credentials, or access tokens in browser telemetry.

## Baseline Contract

- **FR-01:** Browser microphone capture is owned by one global wake listener per browser through `navigator.locks` where supported. A listener retries safely after a microphone or recorder failure.
- **FR-02:** Whisper runs locally with bounded audio input, voice activity detection, model preload, Spanish as the default language, and English when requested by the selected console locale.
- **FR-03:** Kokoro runs locally as the configured primary voice engine. Spanish uses `em_alex` and English uses `af_heart` by default. Piper remains locally installed as an automatic per-request fallback when Kokoro is unavailable or synthesis fails; an unavailable fallback returns a recoverable service error.
- **FR-04:** The UI maintains a written assistant response when speech synthesis is unavailable, times out, or is cancelled.
- **FR-05:** A new assistant turn aborts obsolete STT, conversation, and TTS work; obsolete callbacks cannot update the UI or start speech.
- **FR-06:** Wake acknowledgement is synthesized in the browser and does not require a network audio asset.
- **FR-07:** Wake telemetry is restricted to its typed event contract: source view, result type, elapsed time, and text or prompt length. It cannot accept raw transcript or audio metadata.

## Voice Identity Policy

- HomePilot must not offer voice cloning, imitation, impersonation, or attribution to a third-party or public figure.
- Only explicitly licensed local voice assets may be configured. Kokoro-82M and its bundled assets are Apache-2.0; Piper voice model cards remain the authority for fallback voice licensing. A future premium provider must be reviewed for voice licensing before it can be exposed in administrative configuration.
## Operational Limits

- Wake-word quality depends on microphone placement, room acoustics, CPU contention, and the deployed Whisper model. It must be measured on the target appliance before using an automatic confidence threshold as a product claim.
- The current baseline intentionally avoids an undeclared premium provider. A new provider requires an approved product decision, credential handling design, cost policy, latency target, and provider-specific fallback specification.
- Local STT and TTS are service dependencies. Their health endpoints and Docker health checks remain the operational source of truth.

## Acceptance Criteria

- [x] **AC-01:** The configured local STT service rejects invalid or oversized audio and exposes only `es` or `en` to Whisper.
- [x] **AC-02:** The configured local TTS service uses Kokoro as its primary local engine and returns `provider: kokoro` on success. If Kokoro synthesis fails, it uses only locally installed Piper model files and returns `provider: piper`; if both engines are unavailable, it returns a recoverable error.
- [x] **AC-03:** Browser wake capture does not permit competing global listeners when Web Locks are available.
- [x] **AC-04:** Superseded assistant turns cannot produce stale text or speech.
- [x] **AC-05:** Voice telemetry cannot carry arbitrary metadata such as a transcript or audio payload.
- [x] **AC-06:** The written conversation remains usable if STT or TTS is unavailable.

## Evidence

- `services/stt-whisper/app.py`
- `services/tts-piper/app.py`
- `services/tts-piper/Dockerfile`
- `apps/operator-console/src/components/GlobalWakeListener.tsx`
- `apps/operator-console/src/lib/assistantTurnCoordinator.ts`
- `apps/operator-console/src/lib/assistantApi.ts`
- `apps/operator-console/src/lib/homeConversationTelemetry.ts`
- `apps/operator-console/src/lib/wakeAcknowledgementSound.ts`
- `apps/operator-console/src/lib/__tests__/assistantTurnCoordinator.test.ts`
- `apps/operator-console/src/lib/__tests__/assistantApi.test.ts`
- `apps/operator-console/src/lib/__tests__/homeConversationTelemetry.test.ts`

## Hardware-neutral voice baseline — 2026-08-21

HomePilot deliberately excludes GPU-only text-to-speech engines from the production voice path. The standard deployment must be responsive on customer mini PCs without dedicated GPU hardware.

- **FR-03a:** The production voice path uses Kokoro as its primary local engine with Piper as an automatic local fallback. It must not require GPU detection, a GPU-specific Compose override, or a downloaded GPU model.
- **AC-07:** Deploying HomePilot on a CPU-only appliance keeps the Kokoro/Piper voice service healthy and available without GPU-specific configuration.
