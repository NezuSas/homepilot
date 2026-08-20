# SPEC: Assistant Interactive LLM Latency Budget V1

**Status:** Implemented
**Owner:** HomePilot Engineering
**Date:** 2026-08-20

## Problem

A local Ollama model has no token billing cost, but it still consumes finite CPU time. The conversational assistant used the complete home context, could wait for the generic Ollama timeout, and then scheduled a second Planner V2 shadow request for the same non-control turn. On CPU-only Edge hardware this produced unpredictable waits and queued model work.

## Scope

This specification bounds model work used by conversational turns and diagnostic Planner V2 shadow sampling. It does not change deterministic device control, authorization, confirmation, or enable Planner V2 live execution.

## Requirements

- **REQ-01:** Conversational small talk must use the authorized ultra-light home map instead of the full home context.
- **REQ-02:** A conversational Ollama request must have a fixed 1,500 ms timeout and generate at most 32 tokens. A timeout or invalid model response must retain the existing deterministic fallback response.
- **REQ-03:** A conversational response produced by `AssistantSmallTalkService` must not enqueue an additional Planner V2 shadow request for the same turn.
- **REQ-04:** Planner V2 shadow sampling must use a fixed 1,500 ms timeout and a 48-token limit. Deployment environment values must not extend this diagnostic budget.
- **REQ-05:** At most one Planner V2 shadow request may be in flight. New sampled requests while one is pending must be skipped and logged as `in_flight`.
- **REQ-06:** Planner V2 live execution remains disabled by default and is outside this latency change.

## Acceptance Criteria

- [x] **AC1:** Small-talk calls `buildUltraLightLlmHomeMap(prompt, userId)` and passes the compact result to Ollama.
- [x] **AC2:** Small-talk calls Ollama with `{ timeoutMs: 1500, numPredict: 32 }` and safely returns the existing fallback on failure.
- [x] **AC3:** A non-control conversational response does not call `runShadow` after the small-talk request completes.
- [x] **AC4:** Shadow calls Planner V2 with `{ timeoutMs: 1500, numPredict: 48 }`, independent of `ASSISTANT_PLANNER_V2_SHADOW_TIMEOUT_MS`.
- [x] **AC5:** A second overlapping shadow request does not call the interpreter and records an `in_flight` skip.
- [x] **AC6:** Type checking, all tests, backend build, operator console build, and Docker runtime validation pass.

## Non-Goals

- Selecting a different Ollama model or detecting hardware profiles.
- Promoting Planner V2 to live execution.
- Changing existing deterministic commands, state queries, safety confirmation, permissions, or UI contracts.