# Tasks: Assistant Planner V2 Production Rollout V1

Primary specification: [assistant-planner-v2-production-rollout-v1.md](./assistant-planner-v2-production-rollout-v1.md)

## Safe diagnostic rollout

- [x] Set production Docker defaults for forced, sampled Planner V2 shadow evaluation, including a conservative fallback for invalid sample-rate configuration.
- [x] Keep `ASSISTANT_PLANNER_V2_EXECUTION` disabled by default in every supported Docker profile and installation template, enforced by `check:docker-profiles`.
- [x] Document promotion and rollback criteria before any production default is changed.
- [x] Trace divergence telemetry to the existing shadow service and its automated tests.
- [x] Add a secret-free operator review command for persisted Docker shadow logs.

## Operational validation

- [ ] Collect and review 200 eligible sampled shadow turns on each target hardware profile.
- [ ] Exercise the circuit-breaker fallback on the target profile with Ollama unavailable.
- [ ] Record the review result and explicitly approve or reject live execution promotion.
- [ ] Enable live execution by default only after the acceptance criteria are met.