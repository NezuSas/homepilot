# SPEC: Nezu Domestic Assistant V1

**Status:** Draft

- Status: implementation-ready draft
- Date: 2026-08-05
- Owner: HomePilot

## 1. Problem

HomePilot already provides conversation, wake-word activation, STT, TTS, memory, planning, and device execution. Without a unified definition, these capabilities can evolve as isolated flows and produce late, duplicated, or unhelpful responses in a home.

This specification defines the **Nezu Domestic Assistant** product. “Domestic Jarvis” describes the intended level of experience; it is not used as an in-product identity, integration, or brand reference.

## 2. Scope

- Unify the expected behavior for chat, voice activation, and household actions.
- Define the lifecycle of an interaction, error recovery, and stale-response disposal.
- Establish boundaries for context, permissions, confirmations, privacy, observability, and internationalization.
- Divide subsequent implementation into verifiable phases.
- Keep HomePilot as the source of truth; Home Assistant may remain an optional bridge.

## 3. Out of scope

- Creating a parallel assistant, a separate memory system, or a new HTTP contract.
- Changing the current policy for devices, routines, cameras, or media without a later specification.
- Executing actions outside an authenticated HomePilot session.
- Requiring a cloud model, retaining audio by default, or using third-party identities.

## 4. Product principles

1. **Local first:** the experience remains useful without external access.
2. **Verifiable result:** an action is confirmed only after the executor returns its result.
3. **Minimum useful response:** clear, brief, and without emojis or irrelevant inventory of unassigned devices.
4. **No old responses:** a cancelled or replaced order cannot speak or overwrite the current state.
5. **Consistent language:** text and speech follow the language selected in HomePilot.
6. **Privacy by design:** secrets, tokens, audio, and sensitive content are not exposed in the UI or ordinary audit records.
7. **Semantic language, not scattered literals:** the assistant does not construct UI responses, errors, questions, or confirmations from literal strings distributed through code. It produces a typed semantic result that a localized composer turns into text and speech.

## 5. Use cases

| ID | Use case | Expected result |
|---|---|---|
| UC-01 | Control a device | Executes an allowed capability and communicates the real result. |
| UC-02 | Control by room | Resolves lights, covers, and other visible devices in the requested room. |
| UC-03 | Execute a routine | Executes a scene or automation available to the user. |
| UC-04 | Query status | Responds with the current state without changing the home. |
| UC-05 | Ambiguous request | Requests a brief clarification before executing. |
| UC-06 | Interrupt | Cancels capture, transcription, planning, TTS, and pending callbacks. |
| UC-07 | Recoverable error | Keeps the UI available and explains only the useful error. |

## 6. Functional requirements

### RF-01. Unified input

Chat, manual microphone, and wake-word activation create an identifiable interaction with a `turnId`, origin, and language. No separate business path is created for each surface.

### RF-02. Interaction lifecycle

```text
idle -> wake_detected -> listening_order -> transcribing -> resolving
     -> confirming (optional) -> executing -> responding -> idle

any state -> cancel_requested | timeout | error -> idle
```

- Each origin has at most one active interaction.
- Cancellation invalidates TTS, pending requests, and callbacks associated with the cancelled `turnId`.
- A late callback cannot update the transcript, response, or state of a later interaction.
- An empty transcript releases the lifecycle without blocking a new interaction.

### RF-03. Capture and STT

- One accepted capture produces at most one STT request.
- Transient HTTP errors, including session conflicts, are treated as recoverable completion rather than a permanent lock.
- The acknowledgement sound is never played more than once per accepted interaction.

### RF-04. Authorized context

The assistant uses only homes, rooms, devices, routines, and dashboards that the current user can query or control. Context is built through existing services without duplicating permissions in the client.

### RF-05. Resolution and execution

- Reuse `AssistantConversationService`, `AssistantContextBuilder`, `AssistantFastPathResolver`, the existing planner, confirmation policies, and device capabilities.
- The assistant never invents capabilities or states.
- State synchronization propagates to Home, Spaces, Dashboards, and every affected surface. A successful assistant execution received while a snapshot request is already in flight queues exactly one forced refresh after that request completes, so a pre-command response cannot remain authoritative.

### RF-06. Confirmations

- Voice preserves the current policy: bulk actions do not require an unnecessary second confirmation when policy permits them.
- Chat preserves visual confirmation when an action is sensitive according to the existing policy.
- When ambiguous, ask first; never guess the target.

### RF-06a. Deterministic household-status queries

- Queries for a named room status, unavailable devices, and globally active lights resolve against the authorized device scope before any model fallback.
- A phrase such as "turn off the lights that are on" is global; a state qualifier must never be interpreted as a room name.
- An availability query reports only devices whose current state is unavailable; it never invents a failure reason.

### RF-07. Response

Every interaction ends in one of these categories: `completed`, `needs_clarification`, `needs_confirmation`, `cancelled`, `failed`, or `no_speech`. The response communicates only the information needed by the user.

### RF-08. Semantic composition and i18n

- Domain services return a typed result by intent, for example `assistant.action_completed`, together with safe parameters such as visible name, room, and confirmed state.
- The client and TTS resolve that result through a central i18n catalog; they must not receive or duplicate full sentences from services, routes, components, or callbacks.
- Every assistant key exists in Spanish and English. An unresolved key uses the configured-language fallback and emits technical telemetry without exposing sensitive content.
- Wording, tone, and personality variants are versioned templates per language, not conditionals containing literal text. A template cannot change facts, permissions, or execution results.
- Names created by users for homes, rooms, devices, and routines remain data; they are never translated or changed inside a response.

### RF-09. Voice and language

TTS uses the language selected in the app, rather than only the browser language. If TTS fails, the written response remains available.

### RF-10. Wake word

The canonical phrase is **Ok Nezu** and its allowed variations are managed from the existing central catalog. A new activation discards prior audio, transcript, and responses before opening a new interaction.

### RF-11. Useful auditing

The audit records an event, result, human-readable entity, and timestamp. It does not store tokens, secrets, audio, or complete prompts by default, and groups repeated technical events so they do not hide useful information.

### RF-12. Local-first voice providers

- The baseline runs with activation, local Whisper STT, and local Piper TTS, without an external account or third-party key.
- Every provider implements an explicit contract. The Spanish phrase `Ok Nezu` is not declared production-ready until precision, false positives, and residential-noise performance are evaluated.
- The UI shows only availability, language, and a sanitized technical cause; it never exposes keys, signed URLs, audio, internal traces, or prompts.
- An absent, restarted, or exhausted provider releases the active turn and leaves written conversation available.

### RF-13. Optional premium provider

- A high-fidelity external provider may only be enabled by an installation-authorized administrator.
- Its secrets do not appear in the UI, audit trail, diagnostics, exports, or logs.
- If it fails, is exhausted, or is not configured, Piper provides fallback with the same semantic result and without blocking written text.
- Only owned, licensed, or verifiably authorized voices are permitted. Cloning, imitation, or attribution of third-party identities is forbidden.

### RF-14. Language, personality, and context

- An explicit HomePilot language takes precedence over the browser language for both text and TTS.
- The Nezu personality is sober, concise, and residential; no template may alter confirmed facts, permissions, or errors.
- Context is limited to the authorized user, home, rooms, devices, routines, and time. It never incorporates data from other accounts.

### RF-15. Voice session quality

- Every turn retains an identifier, origin, language, provider, and sanitized closure reason.
- A new activation invalidates the prior one; captures, STT, and TTS cannot coexist in parallel for the same origin.
- Metrics are aggregated and do not store audio, transcripts, prompts, tokens, or secrets.
- Tests cover activation, silence, interruption, reactivation, slow TTS, unavailable STT, language changes, and an unavailable premium provider.

## 7. Target architecture

```text
Chat / Microphone / Wake word
          |
 Client interaction coordinator
          |
STT / TTS / cancellation lifecycle
          |
 AssistantConversationService
   |         |          |
Context   Fast path   Planner / follow-up
   |         |          |
Confirmation policy and capabilities
          |
Device / routine executor
          |
Sanitized response + audit + state synchronization
```

`packages/assistant` retains domain logic. The client controls microphone permission, accessibility, local presentation, and cancellation. `AssistantRoutes` remains the HTTP boundary; any contract change requires a dedicated implementation specification.

```text
Typed domain result
          |
 Semantic response composer
          |
Central i18n catalog + safe parameters + tone template
          |
    UI text and TTS synthesis
```

### 7.1. Provider contracts

| Contract | Input and output | Mandatory boundary |
| --- | --- | --- |
| `WakeWordProvider` | Activation and confidence | Does not execute devices or retain audio. |
| `SpeechToTextProvider` | Accepted capture and transcript | Does not know permissions, routines, or states. |
| `AssistantOrchestrator` | `turnId`, context, and cancellation sequence | Does not create UI literal strings. |
| `ResponseComposer` | Typed results and safe parameters | Does not alter confirmed results. |
| `TextToSpeechProvider` | Already-composed text and selected language | Does not make household decisions. |

### 7.2. Session states

```text
idle -> activated -> listening -> transcribing -> resolving -> executing? -> speaking -> idle
                  \-> cancelled | no_speech | failed -> idle
```

Every transition belongs to one `turnId`. Stale callbacks are discarded before updating the UI, playing TTS, or executing an action.

### 7.3. Identity and degradation constraints

- Voice cloning, imitation, and attribution of third-party identities are not offered.
- A premium provider is optional, requires administrative consent, and degrades to Piper without blocking the written flow.
- A voice provider cannot expand capabilities, permissions, or alter a domain result.

### 7.4. Local response-style preference

- Every authenticated user may choose a `concise`, `standard`, or `detailed` style, persisted locally as their own preference.
- The assistant recognizes explicit requests for concise, standard, or more detailed replies in Spanish and English.
- The preference initially composes only general conversational responses; it does not modify confirmations, permissions, intent, execution, entities, or security policies.
- Detailed mode never invents data: it preserves the confirmed response and may only offer to expand it.
- The preference is neither shared between users nor sent to external providers.

## 8. Non-functional requirements

- **Continuity:** never leave the microphone or UI blocked after an error, silence, timeout, or cancellation.
- **Performance:** keep visible data during refresh; avoid duplicate STT, TTS, and state requests.
- **Security:** user instructions never gain system privileges or reveal unauthorized data.
- **Accessibility:** listening, processing, success, and failure states are understandable without relying only on color.
- **Responsive behavior:** the chat and voice composer remains visible with a virtual keyboard on mobile and tablet.
- **i18n:** do not mix languages or unresolved keys in assistant surfaces, and do not introduce literal copy outside central catalogs.

## 9. Acceptance criteria

- [x] One activation creates one capture and one STT request. Evidence: the Playwright `Global wake activation` scenario.
- [x] Cancelling an interaction prevents late responses, TTS, and results from appearing afterwards. Evidence: `assistant-interaction-turn-lifecycle-v1.md` AC-01 through AC-05 and the corresponding coordinator and API tests.
- [x] An empty transcript, 409, or timeout returns the lifecycle to available without self-reactivating. Evidence: `assistantApi.test.ts` and `assistant-domestic-use-case-verification-v1.md` UC-07.
- [x] Context respects user permissions and never reveals foreign entities. Evidence: `assistant_home_isolation.test.ts`.
- [x] The response matches the result confirmed by the executor and excludes irrelevant inventory warnings. Evidence: `assistant-domestic-use-case-verification-v1.md` UC-01 through UC-05.
- [ ] Assistant domain results contain no full UI sentences; text, TTS, confirmations, and errors are composed from i18n keys and typed parameters.
- [ ] Each assistant key has Spanish and English translation with controlled fallback for a missing key.
- [x] The current confirmation policy is respected for chat, voice, and sensitive actions. Evidence: `assistant_bulk_confirmation.test.ts` and `assistant_bulk_room_parity.test.ts`.
- [x] Named-room status, unavailable-device, and global active-light queries resolve deterministically against the authorized scope. Evidence: `assistant_conversation_service.test.ts`.
- [x] Manual language changes modify assistant text and speech. Evidence: `apiClient.test.ts` and `AssistantRoutes.test.ts`.
- [x] `Ok Nezu` is the primary phrase and a new activation clears the prior turn. Evidence: the Playwright `Global wake activation` scenario and `assistant-interaction-turn-lifecycle-v1.md`.
- [x] The audit shows useful events and groups technical noise. Evidence: `assistant-audit-noise-reduction-v1.md` and `HomeAssistantRealtimeSyncManager.test.ts`.
- [x] Cancellation, callback races, permissions, language, and recovery have test coverage. Evidence: `assistant-interaction-turn-lifecycle-v1.md`, `assistant_home_isolation.test.ts`, `apiClient.test.ts`, and `assistant-domestic-use-case-verification-v1.md`.
- [x] The voice baseline runs without an external account or third-party key. Evidence: `assistant-voice-provider-baseline-v1.md`.
- [ ] Spanish `Ok Nezu` is evaluated for precision, false positives, and noise before production enablement.
- [ ] An administrator can enable an optional premium provider and its failure returns to Piper without interrupting text.
- [x] Cloned, imitated, or third-party-attributed voices are not allowed. Evidence: `assistant-voice-provider-baseline-v1.md`.
- [x] The language selected in HomePilot governs both assistant text and TTS. Evidence: `apiClient.test.ts` and `AssistantRoutes.test.ts`.
- [x] Voice telemetry contains no audio, transcripts, prompts, tokens, or secrets. Evidence: `assistant-voice-provider-baseline-v1.md` AC-05 and `homeConversationTelemetry.test.ts`.
- [x] Mandatory validation passes: `npm run typecheck`, `npm run build`, `npm run build --prefix apps/operator-console`, and `npm run test`. Evidence: current validation run.
- [x] A successful assistant execution cannot leave a pre-command snapshot authoritative; exactly one post-command refresh is queued while all Home, Spaces, Dashboard, and device-widget surfaces consume the shared snapshot. Evidence: `HomeConversationView`, `useDeviceSnapshotStore`, and `useDeviceSnapshotStore.test.ts`.

## 10. Later implementation plan

1. **Phase A — Contracts and lifecycle:** type states and coordinate turns without duplicating flows.
2. **Phase B — Robust voice:** strengthen wake word, capture, STT, TTS, cancellation, and recovery.
3. **Phase C — Context and safety:** validate permissions, confirmations, and useful auditing.
4. **Phase D — Residential experience:** semantic composer, concise responses, i18n, accessibility, and responsive surfaces.
5. **Phase E — Providers and voice quality:** local-first contracts, wake-word evaluation, fallback, and consent.
6. **Phase F — Observability and hardening:** minimal local metrics, race tests, and Docker validation.

Every phase requires task updates, tests, and acceptance evidence before APIs, persistence, or execution policies are changed.

## 11. Open decisions

- Exact catalog of actions considered sensitive.
- Retention and opt-in activation of voice telemetry without content.
- Per-home personality versus a single Nezu personality.
- Final handling of browser autoplay restrictions.