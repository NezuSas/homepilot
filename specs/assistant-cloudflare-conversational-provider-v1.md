# SPEC: Assistant Cloudflare Conversational Provider V1

**Status:** Implemented
**Owner:** HomePilot Engineering

## 1. Objective

Provide an optional Cloudflare Workers AI provider for concise, natural HomePilot
conversation while preserving local authorization, state resolution, and action
execution as the sole source of truth.

## 2. Scope

This feature applies only to `AssistantSmallTalkService`. Deterministic
household skills, command routing, confirmation tickets, Planner V2, camera
data, credentials, and device execution remain local and unchanged.

## 3. Configuration

- `ASSISTANT_CONVERSATIONAL_LLM_PROVIDER=ollama|cloudflare` selects the
  conversational provider and defaults to `ollama`.
- `CLOUDFLARE_AI_ACCOUNT_ID` and `CLOUDFLARE_AI_API_TOKEN` are required only
  when `cloudflare` is selected.
- `CLOUDFLARE_AI_MODEL` defaults to `@cf/meta/llama-3.1-8b-instruct-fast`.
- `CLOUDFLARE_AI_TIMEOUT_MS` defaults to `2200`.
- The API token is an installation secret. It is never returned by the API,
  persisted in HomePilot data, or written to logs.

## 4. Functional Requirements

- **FR-01:** The Cloudflare client calls the official Workers AI REST endpoint
  with a compact prompt constructed from already-authorized HomePilot context.
- **FR-02:** Requests use bounded output and JSON schema mode. A response is
  accepted only when it satisfies the existing conversational response shape.
- **FR-03:** Cloudflare receives no credentials, camera data, local IP address,
  device identifiers, or complete home inventory from this integration.
- **FR-04:** If configuration is incomplete, the request fails, the quota is
  unavailable, or the timeout is reached, HomePilot returns its existing local
  conversational fallback without executing an action.
- **FR-05:** Selecting Cloudflare for conversation does not change Ollama use
  by Planner V2 or the existing local intent interpreter.

## 5. Acceptance Criteria

- [x] **AC-01:** Cloudflare can be selected only with the installation's own
  account ID and API token.
- [x] **AC-02:** The request includes bounded generation, JSON schema mode,
  and no token in its JSON body.
- [x] **AC-03:** Cloudflare response failures safely reach the existing local
  fallback and do not execute actions.
- [x] **AC-04:** The local Ollama provider remains the default and all command,
  confirmation, authorization, and Planner V2 flows retain their behavior.
- [x] **AC-05:** Docker forwards the optional configuration without embedding
  any customer-specific credential.

## 6. Validation

- Unit tests cover successful structured responses, string JSON responses,
  provider errors, and conversational provider selection.
- Typecheck, full test suite, root build, Operator Console build, spec coverage,
  and Docker runtime health checks pass.
