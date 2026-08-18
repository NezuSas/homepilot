# Test Assurance and Coverage Governance V1

## Purpose

HomePilot treats tests as executable evidence of product behavior. “100% assured”
does not mean forcing an arbitrary line-coverage percentage through superficial
assertions. It means every maintained production surface has an explicit test
strategy, every critical outcome is exercised, and the measured coverage
baseline cannot regress in CI.

## Maintained API Route Inventory

| Route family | Contract suite | Critical behavior covered |
|---|---|---|
| Administration | `apps/api/__tests__/AdminRoutes.test.ts` | Administrative authorization and secret-free responses. |
| Shared API errors | `apps/api/__tests__/ApiRoutes.error-sanitization.test.ts` | Safe error serialization. |
| Assistant | `apps/api/__tests__/AssistantRoutes.test.ts` | Authentication, command submission, and safe failures. |
| Authentication and SSO | `apps/api/__tests__/AuthRoutes.security.test.ts`, `AuthRoutes.directory-sso.test.ts` | Login safety, SSO linkage, replay protection, and session parity. |
| Automations | `apps/api/__tests__/AutomationRoutes.test.ts` | Authentication, empty-home handling, owner list, and admin-only mutation gate. |
| Home Assistant cameras | `apps/api/__tests__/CameraRoutes.test.ts` | Authenticated session, stream proxying, unavailable state, and HLS handling. |
| Dashboards | `apps/api/__tests__/DashboardRoutes.test.ts` | Authentication, validation, creation ownership, and export authorization. |
| Devices | `apps/api/__tests__/DeviceRoutes.*.test.ts` | Refresh, command semantics, state synchronization, and deletion. |
| Execution history | `apps/api/__tests__/ExecutionRoutes.test.ts` | Authentication, query validation, retries, and missing-history handling. |
| Media players | `apps/api/__tests__/MediaPlayerRoutes.test.ts` | Authenticated media control contract. |
| Static media | `apps/api/__tests__/MediaRoutes.test.ts` | Handler delegation and stable missing-media response. |
| Native cameras | `apps/api/__tests__/NativeCameraRoutes.test.ts` | Authenticated inventory and secure native-camera management. |
| Scenes | `apps/api/__tests__/SceneRoutes.test.ts` | Authentication, home-scoped listing, creation validation, and persistence. |
| Settings | `apps/api/__tests__/SettingsRoutes.test.ts` | Validation, masking, optional persistence, and connectivity status. |
| System diagnostics | `apps/api/__tests__/SystemRoutes.diagnostics.test.ts` | Authentication and diagnostics delegation. |
| System variables | `apps/api/__tests__/SystemVariableRoutes.test.ts` | Protected variable access and validation. |
| Topology | `apps/api/__tests__/TopologyRoutes.delete-room.test.ts` | Protected deletion and room integrity. |

## Bounded Context Evidence

The SDD/TDD/BDD cross-context mapping remains in
`docs/quality/sdd-tdd-bdd-traceability.md`. It links the route contracts above
to their underlying domain, application, persistence, and responsive-console
suites. A product change is not complete until that mapping is extended with
at least one outcome-focused test at the appropriate boundary.

## Coverage Gate

`npm run test:coverage` is the canonical measured-coverage command. It is part
of `npm run verify:quality`, so CI rejects a change if global coverage drops
below this ratchet baseline:

| Metric | Minimum |
|---|---:|
| Statements | 91% |
| Branches | 78% |
| Functions | 91% |
| Lines | 92% |

Jest uses the V8 coverage provider so the report represents JavaScript actually executed at runtime rather than TypeScript instrumentation artifacts. Latest clean-cache full-suite measurement after real behavioral coverage: **96.45% statements, 87.37% branches, 96.25% functions, and 96.45% lines** (217 suites / 2,185 tests). Every maintained module in the inventory has an assigned behavioral suite; the quality gate enforces this inventory and prevents measurable regression. The baseline may only move upward after real behavioral coverage is added; lowering it requires a documented engineering decision.

## Required Test Types

- **Domain/application:** business rules, authorization decisions, and
  persistence transitions.
- **API contract:** authentication, validation, success, and safe failure for
  each route family.
- **Integration:** adapters that communicate with Home Assistant, Sonoff,
  native cameras, local media, SQLite, and local AI services.
- **Console:** presentation adapters, widgets, responsive shell behavior, and
  user-visible error states.
- **End-to-end:** high-risk device, topology, automation, scene, and assistant
  flows that cross bounded contexts.

Generated output, defensive platform-error branches, and unreachable external
network failures are not a reason to add superficial tests. Their behavior is
covered through the nearest meaningful contract or integration boundary.

## Validation

Run the complete quality contract before completing a change:

```bash
npm run test
npm run test:coverage
npm run typecheck
npm run build
npm run build --prefix apps/operator-console
```