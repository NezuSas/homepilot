# SPEC: Assistant Deterministic Conversation Runtime V1

**Status:** Implemented
**Owner:** HomePilot Engineering
**Date:** 2026-08-20

## Problem

Local language models consume finite CPU time and can delay deterministic HomePilot responses on CPU-only Edge hardware. The approved assistant runtime must never depend on a local or cloud language model to answer or control the home.

## Scope

This specification removes language-model services and configuration from every supported Edge deployment profile. It preserves deterministic device control, authorization, confirmation, voice services, and existing assistant API contracts.

## Requirements

- **REQ-01:** The production assistant runtime answers conversational requests through the deterministic local responder only.
- **REQ-02:** Supported Compose profiles declare no Ollama service, dependency, port, volume, or model environment variable.
- **REQ-03:** Bootstrap has no active model configuration, so it never prewarms or invokes a language-model service.
- **REQ-04:** Installation and maintenance scripts neither wait for nor report Ollama as a required service.
- **REQ-05:** Environment templates and the effective local environment contain no Ollama, conversational-provider, Cloudflare Workers AI, or Planner V2 model configuration.
- **REQ-06:** Existing deterministic commands, queries, confirmations, domestic recommendations, speech-to-text, and text-to-speech retain their behavior.

## Acceptance Criteria

- [x] **AC1:** Every supported Compose profile has no Ollama service, dependency, port, volume, or model environment variable.
- [x] **AC2:** The installer and maintenance status checks do not reference Ollama.
- [x] **AC3:** Environment templates have no Ollama, Cloudflare Workers AI, conversational-provider, or Planner V2 model variable.
- [x] **AC4:** Deployment validation prevents a language-model runtime from being reintroduced.
- [x] **AC5:** Type checking, all tests, backend build, operator console build, and Docker runtime validation pass without an Ollama container.

## Non-Goals

- Changing existing deterministic commands, state queries, safety confirmation, permissions, or UI contracts.
- Removing Cloudflared or any remote-access tunnel configuration.