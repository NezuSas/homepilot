# Assistant Semantic Response Contract V1 — Tasks

Primary specification: [assistant-semantic-response-contract-v1.md](./assistant-semantic-response-contract-v1.md)

## Contract

- [x] Define typed response keys and interpolation values for the bounded initial surface.
- [x] Migrate quick responses and conversational preferences without output changes.
- [x] Migrate the language-override acknowledgement without output changes.
- [x] Migrate the repetitive cancellation acknowledgement without output changes.
- [x] Migrate the bounded core multi-turn confirmation messages, including the generic multi-action confirmation question, without output changes.
- [x] Migrate the bounded generic command, execution, and selection messages without output changes.
- [x] Migrate selected-target, pronoun ambiguity, and interpreter-match clarification messages with typed parameters without output changes.

## Verification

- [x] Add exhaustive Spanish and English catalog tests.
- [x] Add a CI quality gate for bilingual key completeness and the bounded migrated surface.
- [x] Run typecheck, targeted assistant tests, full builds, and the workspace suite.

## Bounded scene and automation management response migration

- [x] Define typed bilingual keys for scene and automation lists, management confirmations, not-found outcomes, unsupported management actions, and successful management actions.
- [x] Replace only the matching `AssistantConversationService` response literals while preserving the current HTTP message wording and confirmation options.
- [x] Add catalog and source-guard coverage for every migrated management response. Evidence: `check-assistant-response-catalog.mjs`.


## Bounded point-state query response migration

- [x] Define typed bilingual keys for room/device state queries, including no controllable targets, aggregate room states, device ambiguity, and direct on/off answers.
- [x] Replace only the matching `AssistantConversationService` response literals while preserving the current HTTP message wording and clarification payload.
- [x] Add catalog and source-guard coverage for the migrated state-query responses. Evidence: `assistant_response_catalog.test.ts`, `assistant_conversation_service.test.ts`, and `check-assistant-response-catalog.mjs`.

## Bounded device-resolution and scene-execution response migration

- [x] Define typed bilingual keys for target resolution, command confirmations, scene execution, and unsupported instruction outcomes.
- [x] Replace only the matching `AssistantConversationService` response literals while preserving the current HTTP message wording and clarification payload.
- [x] Add catalog and source-guard coverage for the migrated response surface. Evidence: `assistant_response_catalog.test.ts`, `assistant_conversation_service.test.ts`, and `check-assistant-response-catalog.mjs`.

## Bounded detailed-state query outcome migration

- [x] Define typed bilingual keys for empty-state, room-resolution, target, selection, and inventory outcomes.
- [x] Replace only matching `AssistantConversationService` response literals while preserving filters, state evaluation, and clarification payloads.
- [x] Add catalog and source-guard coverage for every migrated outcome.