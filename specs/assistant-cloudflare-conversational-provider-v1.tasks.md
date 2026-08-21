# TASKS: Assistant Cloudflare Conversational Provider V1

## Phase 1 — Provider and configuration

- [x] Add a Cloudflare Workers AI structured-response adapter behind the existing LLM port.
- [x] Select the adapter only for bounded conversation and preserve local Ollama for planner paths.
- [x] Add installation-scoped environment configuration and Docker forwarding.

## Phase 2 — Safety and validation

- [x] Add adapter tests for JSON handling, bounded request options, and safe errors.
- [x] Add conversational selection coverage without enabling Ollama.
- [x] Verify AC-01 through AC-05 with mandatory validation.
