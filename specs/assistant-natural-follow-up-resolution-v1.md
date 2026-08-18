# Assistant Natural Follow-Up Resolution V1

**Status:** Implemented  
**Author:** HomePilot Engineering  
**Date:** 2026-08-17

## Problem

The follow-up resolver understood selected short forms such as `apágala` and `turn it off`, but it discarded the natural phrasing around a reference. A request such as `Could you turn it off, please?` was rewritten into a different-language imperative and a polite Spanish request could lose its surrounding context.

## Scope

- Resolve a single, previously authorized memory entity when an explicit control reference appears in a complete Spanish or English request.
- Preserve the surrounding user phrase while substituting only the reference.
- Keep all device authorization, capability validation, confirmation, and execution in the existing assistant pipeline.

## Non-goals

- Resolve an ambiguous reference when multiple entities are in memory.
- Infer a previous action that is not represented by the current phrase.
- Execute a command in the resolver or bypass Planner, device capabilities, or confirmation policy.

## Functional Requirements

- **FR-01:** A singular contextual control reference is eligible only when exactly one entity is available in short-term memory.
- **FR-02:** Spanish and English off/on references preserve the surrounding phrase and use a grammatical command replacement.
- **FR-03:** If replacement cannot be performed against the original prompt, the prompt remains unchanged.
- **FR-04:** The resolver returns a resolved prompt only; authorization and execution remain downstream.

## Acceptance Criteria

- [x] **AC-01:** `¿Podrías apagarla por favor?` resolves to `¿Podrías apagar Luz Escritorio por favor?` when exactly that entity is in context.
- [x] **AC-02:** `Could you turn it off, please?` resolves to `Could you turn Luz Escritorio off, please?` when exactly that entity is in context.
- [x] **AC-03:** An empty or multi-entity memory cannot select a target through this rule.
- [x] **AC-04:** Existing positional and clarification-option follow-ups continue to work.
- [x] **AC-05:** The resolved request continues through the existing authorization, capability, and confirmation pipeline.
- [x] **AC-06:** Natural variants such as ``prenderla``, ``switch it off``, and ``switch that on`` resolve only when exactly one entity is in memory, while preserving the surrounding request.

## Evidence

- `packages/assistant/application/FollowUpResolver.ts`
- `packages/assistant/__tests__/follow_up_resolver.test.ts`
- `packages/assistant/application/AssistantConversationService.ts`
