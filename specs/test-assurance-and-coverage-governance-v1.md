# SPEC: Test Assurance and Coverage Governance V1

**Status:** Approved
**Owner:** HomePilot Engineering
**Date:** 2026-08-17

## Problem

The test suite has broad behavioral coverage but no executable coverage baseline.
A passing suite alone cannot prove that every production surface has an assigned
test strategy or prevent coverage regression.

## Requirements

- **REQ-01:** Every maintained bounded context and API route family must have a
  named behavioral test suite.
- **REQ-02:** All critical flows must be covered by unit, integration, API, or
  responsive end-to-end tests, according to their boundary.
- **REQ-03:** The quality command must calculate coverage and fail when it
  falls below the approved baseline.
- **REQ-04:** Coverage thresholds must be ratcheted upward only with real
  behavioral tests; no empty tests or implementation-only assertions.
- **REQ-05:** Production behavior, public APIs, database schema, and UI
  behavior remain unchanged.

## Acceptance Criteria

- [x] **AC1:** An English test-assurance inventory maps every maintained
  module and route family to an existing behavioral suite.
- [x] **AC2:** Tests cover success, validation/authorization failure, and
  safe external-integration failure for every critical route family.
- [x] **AC3:** CI executes a coverage command with explicit global thresholds.
- [x] **AC4:** The initial coverage baseline is measured and documented from a
  clean full-suite run.
- [x] **AC5:** npm run test, typecheck, and both builds pass.

## Out of Scope

- Replacing real external appliances with production network calls in unit
  tests.
- Forcing line-level 100 percent coverage on generated, defensive, or
  environment-specific error handling where it would provide no user-facing
  assurance.