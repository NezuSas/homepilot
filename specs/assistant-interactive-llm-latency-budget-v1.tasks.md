# TASKS: Assistant Deterministic Conversation Runtime V1

Primary specification: assistant-interactive-llm-latency-budget-v1.md

## Implementation

- [x] Remove the Ollama service, dependencies, ports, volumes, and model environment variables from all supported Compose profiles.
- [x] Remove Ollama checks from supported installation and maintenance scripts, remove stale Compose services during deployment, and clear the unused HomePilot Ollama image.
- [x] Remove model settings from the environment templates and effective local environment.
- [x] Preserve deterministic assistant, safety, and voice behavior without a model container.

## Verification

- [x] Composition and deployment checks verify that no supported runtime profile references Ollama or a conversational model provider, that maintenance deployment uses `--remove-orphans`, and that it clears the unused Ollama image.
- [x] Run typecheck, tests, both builds, and Docker runtime validation without an Ollama container.