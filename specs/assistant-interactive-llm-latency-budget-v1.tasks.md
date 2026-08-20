# TASKS: Assistant Interactive LLM Latency Budget V1

## Implementation

- [x] REQ-01/REQ-02: Use the authorized ultra-light context and an explicit 1,500 ms / 32-token budget for conversational Ollama requests.
- [x] REQ-03: Do not schedule Planner V2 shadow work after a model-backed conversational response.
- [x] REQ-04/REQ-05: Bound shadow calls to 1,500 ms / 48 tokens and permit only one in-flight diagnostic request.

## Verification

- [x] AC1/AC2: `assistant_small_talk_service.test.ts` verifies compact context, user scoping, and Ollama options.
- [x] AC3: Conversation-service coverage verifies conversational routing without Planner V2 execution.
- [x] AC4/AC5: `assistant_planner_v2_shadow.test.ts` verifies the bounded V2 options and overlapping request protection.
- [x] AC6: Run typecheck, tests, both builds, and Docker runtime validation.