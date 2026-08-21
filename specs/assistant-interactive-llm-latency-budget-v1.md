# SPEC: Assistant Interactive LLM Latency Budget V1

**Status:** Implemented
**Owner:** HomePilot Engineering
**Date:** 2026-08-20

## Problem

A local Ollama model has no token billing cost, but it still consumes finite CPU time. The conversational assistant used the complete home context, could wait for the generic Ollama timeout, and then scheduled a second Planner V2 shadow request for the same non-control turn. On CPU-only Edge hardware this produced unpredictable waits and queued model work.

## Scope

This specification bounds model work used by conversational turns and diagnostic Planner V2 shadow sampling. It does not change deterministic device control, authorization, confirmation, or enable Planner V2 live execution.

## Requirements

- **REQ-01:** Conversational small talk must use the authorized ultra-light home map instead of the full home context, send no more than 120 characters of that map to Ollama, and avoid reading scenes or aliases unless the prompt can reference them.
- **REQ-02:** A conversational Ollama request must have a fixed 800 ms timeout and generate at most 20 tokens. Its instruction must remain compact enough for CPU-only Edge hardware, prohibit greetings, and constrain decoding to a response object with a non-empty `text` value of at most 56 characters. A timeout or invalid model response must return a deterministic, authorized device-summary fallback instead of a generic command-error message.
- **REQ-03:** A conversational attempt made by `AssistantSmallTalkService` must not enqueue an additional Planner V2 shadow request for the same turn, including when it falls back.
- **REQ-04:** Planner V2 shadow sampling must use a fixed 1,500 ms timeout and a 48-token limit. Deployment environment values must not extend this diagnostic budget.
- **REQ-05:** At most one Planner V2 shadow request may be in flight. New sampled requests while one is pending must be skipped and logged as `in_flight`.
- **REQ-06:** When local Ollama is enabled, bootstrap must prewarm the configured local model unless `OLLAMA_PREWARM=false`. A failed prewarm is logged and never prevents deterministic HomePilot operation.
- **REQ-07:** Planner V2 live execution remains disabled by default and is outside this latency change.

## Acceptance Criteria

- [x] **AC1:** Small-talk calls `buildUltraLightLlmHomeMap(prompt, userId)`, passes no more than 120 characters of authorized context to Ollama, and skips scene/alias reads for a plain conversational prompt.
- [x] **AC2:** Small-talk calls Ollama with `{ timeoutMs: 800, numPredict: 20 }` and the bounded response schema and safely returns an authorized device-summary fallback on failure.
- [x] **AC3:** A non-control conversational attempt does not call `runShadow` after the small-talk request completes, including when the model response falls back.
- [x] **AC4:** Shadow calls Planner V2 with `{ timeoutMs: 1500, numPredict: 48 }`, independent of `ASSISTANT_PLANNER_V2_SHADOW_TIMEOUT_MS`.
- [x] **AC5:** A second overlapping shadow request does not call the interpreter and records an `in_flight` skip.
- [x] **AC6:** Enabled local Ollama starts a 5,000 ms-bounded, structured prewarm request that keeps the configured model resident; a failure is non-fatal.
- [x] **AC7:** Type checking, all tests, backend build, operator console build, and Docker runtime validation pass.

## Non-Goals

- Selecting a different Ollama model or detecting hardware profiles.
- Promoting Planner V2 to live execution.
- Changing existing deterministic commands, state queries, safety confirmation, permissions, or UI contracts.