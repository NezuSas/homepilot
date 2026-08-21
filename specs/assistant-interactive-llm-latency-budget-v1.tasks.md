# TASKS: Assistant Interactive LLM Latency Budget V1

## Implementation

- [x] REQ-01/REQ-02: Use no more than 120 characters of authorized ultra-light context, skip irrelevant scene/alias reads, use a bounded 56-character response schema, and enforce an 800 ms / 20-token budget with an authorized device-summary fallback for conversational Ollama requests.
- [x] REQ-03: Do not schedule Planner V2 shadow work after any conversational model attempt, including a fallback.
- [x] REQ-04/REQ-05: Bound shadow calls to 1,500 ms / 48 tokens and permit only one in-flight diagnostic request.
- [x] REQ-06: Prewarm the configured local Ollama model at bootstrap unless explicitly disabled, without making model availability a startup dependency.

## Verification

- [x] AC1/AC2: `assistant_small_talk_service.test.ts` and `assistant_context_builder.test.ts` verify the 120-character context cap, user scoping, minimized reads, and Ollama options.
- [x] AC3: Conversation-service coverage verifies that conversational attempts, including fallbacks, do not schedule Planner V2 work.
- [x] AC4/AC5: `assistant_planner_v2_shadow.test.ts` verifies the bounded V2 options and overlapping request protection.
- [x] AC6: `ollama_client.test.ts` verifies the 5,000 ms-bounded structured prewarm request.
- [x] AC7: Run typecheck, tests, both builds, and Docker runtime validation.