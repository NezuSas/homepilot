# Assistant Audit Noise Reduction V1

**Status:** Implemented  
**Author:** HomePilot Engineering  
**Date:** 2026-08-17

## Problem

The Home Assistant realtime bridge can receive repeated state events that carry the same effective state and attributes as the local device snapshot. Persisting, broadcasting, and auditing each duplicate creates technical noise without a user-visible change, which obscures relevant assistant and device activity.

## Scope

- Suppress only realtime Home Assistant events whose state and attributes are structurally identical to the local device snapshot.
- Preserve device persistence, automation events, and audit records for every effective state or attribute change.
- Keep malformed and unmapped event behavior unchanged.

## Non-goals

- Rate-limiting or coalescing distinct state transitions.
- Changing audit retention, user-facing audit APIs, or Home Assistant websocket contracts.
- Suppressing resilience, command, or automation audit events.

## Functional Requirements

- **FR-01:** A duplicate realtime event must not save the device, emit a `system_event`, or persist `STATE_CHANGED`.
- **FR-02:** Attribute-only changes remain observable and auditable.
- **FR-03:** State changes remain observable and auditable.
- **FR-04:** Object key order must not turn semantically identical Home Assistant attributes into a new state change.

## Acceptance Criteria

- [x] **AC-01:** An event equal to the local state snapshot is ignored without persistence, event emission, or audit write.
- [x] **AC-02:** A state or attribute change still follows the existing realtime synchronization and audit path.
- [x] **AC-03:** Equivalent attributes with a different key order are treated as unchanged.
- [x] **AC-04:** Targeted integration tests, typecheck, builds, the full suite, and Docker runtime validation pass.