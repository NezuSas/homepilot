# Tasks: Specialized Domestic Agent V1

Primary specification: [assistant-specialized-domestic-agent-v1.md](./assistant-specialized-domestic-agent-v1.md)

## Phase 1 — Typed domestic skill resolver

- [x] Define bounded domestic skill and recommendation result types.
- [x] Resolve authorized rooms, scenes, and controllable devices through existing services.
- [x] Implement factual home insight, natural room comfort, night options, targeted scene discovery, and available-scene inventory.
- [x] Integrate the resolver before generic small talk without changing public API contracts.

## Phase 2 — Context and presentation

- [x] Persist resolved domestic context through existing short-term memory without modifying pending confirmation.
- [x] Revalidate domestic follow-up context before returning recommendations or additional options.
- [x] Format multi-item responses as concise heading-plus-list text.
- [x] Preserve deterministic command, query, confirmation, and Planner V2 gates.

## Phase 3 — Evaluation and validation

- [x] Add Spanish and English evaluation cases for every supported skill and natural phrase variation.
- [x] Add authorization, no-execution, and Ollama-unavailable tests.
- [x] Verify AC-01 through AC-11 and run mandatory validation.
