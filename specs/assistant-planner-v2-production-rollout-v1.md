# SPEC: Assistant Planner V2 Production Rollout V1

**Status:** Approved
**Author:** HomePilot Engineering
**Date:** 2026-08-17

## Problem

Planner V2 provides structured semantic interpretation, but the standard Edge deployment disabled both its diagnostic shadow path and live execution. This prevented the product from collecting production-quality divergence evidence and kept natural-language coverage dependent on deterministic parsing alone.

Enabling live execution without evidence would be unsafe: an incorrect semantic plan can control physical devices. The rollout must therefore preserve the deterministic path as the source of truth until observable shadow evidence satisfies explicit promotion criteria.

## Scope

- Enable sampled Planner V2 shadow evaluation in the standard Docker deployment.
- Preserve the existing no-side-effect shadow contract and structured V1/V2 divergence logs.
- Define measurable promotion and rollback criteria for live Planner V2 execution.
- Keep `ASSISTANT_PLANNER_V2_EXECUTION` opt-in until the criteria have been observed on a supported Edge installation.

## Non-goals

- This spec does not change command confirmation policy, authorization, home isolation, or the deterministic fast path.
- This spec does not promote execution merely because unit tests pass.
- This spec does not persist prompt content, audio, tokens, or secrets as rollout telemetry.

## Functional Requirements

- **FR-01:** A production Docker deployment enables shadow mode with an explicit force flag so that `NODE_ENV=production` does not silently disable it.
- **FR-02:** The default sample rate is conservative (`0.1`) to gather representative evidence without making the diagnostic path compete materially with the user-facing deterministic path. An absent, non-numeric, negative, or greater-than-one configured rate falls back to `0.1`; it must never accidentally expand sampling to every turn.
- **FR-03:** Each sampled eligible turn emits the existing structured Planner V2 diagnostic with latency, validation result, resolution outcome, V1 response type, and V2-better candidate result. It must not include raw prompt content, credentials, audio, or Home Assistant tokens.
- **FR-04:** Live execution remains disabled by default. The current circuit breaker remains the immediate fallback guard whenever execution is deliberately enabled for a controlled rollout.
- **FR-05:** A local operator can derive the automatable rollout metrics from the existing secret-free shadow logs without collecting or printing prompt, audio, credential, or token content.

## Promotion and Rollback Criteria

An operator may set `ASSISTANT_PLANNER_V2_EXECUTION=true` only after collecting at least 200 eligible sampled shadow turns on the target hardware and recording all of the following:

1. No authorization, home-isolation, confirmation, or command-capability violation.
2. At least 95% of valid plans pass validation and resolve without a shadow failure.
3. The p95 shadow latency stays within the configured shadow timeout and no user-facing deterministic response is delayed by shadow execution.
4. Every sampled V2 execution candidate is reproducible against the V1 result or is reviewed as an intentional improvement before promotion.
5. Circuit-breaker fallback is verified by forcing an unavailable Ollama endpoint in the same deployment profile.

Rollback is immediate: set `ASSISTANT_PLANNER_V2_EXECUTION=false` and redeploy if a capability, permission, confirmation, or target-resolution violation is observed, or if the circuit breaker does not preserve a usable deterministic response. Shadow may remain enabled for diagnosis unless it demonstrably affects host stability; then set `ASSISTANT_PLANNER_V2_SHADOW=false`.

## Acceptance Criteria

- [x] **AC-01:** Docker production defaults enable forced, sampled shadow evaluation while live Planner V2 execution remains opt-in.
- [x] **AC-02:** The rollout criteria and rollback procedure are documented in English.
- [x] **AC-03:** Existing shadow telemetry exposes divergence-relevant, secret-free fields.
- [x] **AC-04:** The log-review command reports total samples, valid-plan resolution rate, p95 latency, error classes, and V2-better candidates without outputting sensitive content. Invalid sampling configuration falls back to the conservative rate and is covered by regression tests.
- [ ] **AC-05:** A supported Edge installation records and reviews the required 200 eligible shadow turns before enabling live execution by default.
- [ ] **AC-06:** Controlled live execution is validated on supported Edge hardware with the circuit-breaker fallback before its default is changed.

## Evidence

- `packages/assistant/application/AssistantPlannerV2ShadowService.ts` owns shadow sampling, V1/V2 comparison telemetry, and the execution circuit breaker.
- `packages/assistant/__tests__/assistant_planner_v2_shadow.test.ts` covers disabled/shadow behavior, sampling, validation, guarded execution, and circuit-breaker fallback.
- `docker-compose.yml`, `docker-compose.office.yml`, `.env.office.example`, and `.env.native.example` supply safe non-execution defaults across supported installations.`r`n- `scripts/check-docker-profiles.mjs` prevents a profile or installation template from re-enabling live Planner V2 execution by default.
- `scripts/review-planner-v2-shadow.mjs` aggregates only structured shadow diagnostics for an operator review.