# Modular Architecture Reference

## Ownership Map

This reference documents the active implementation surfaces audited by
`npm run check:spec-coverage`.

| Surface | Owner | Primary responsibility | Primary spec family |
|---|---|---|---|
| `bootstrap.ts`, `infrastructure/assemblers/` | Composition root | Dependency wiring and runtime assembly | Edge platform foundations |
| `apps/api/` | Delivery layer | Stable HTTP and realtime adapters | Edge platform foundations |
| `apps/api/routes/AuthRoutes.ts`, `packages/auth/` | Authentication | Sessions, role checks, local users, and SSO links | Auth RBAC / Directory SSO |
| `apps/api/routes/TopologyRoutes.ts`, `packages/topology/` | Topology | Homes, rooms, memberships, and structural scope | Home and room management |
| `apps/api/routes/DeviceRoutes.ts`, `packages/devices/` | Devices | Discovery, capability validation, commands, and state | Device command execution |
| `apps/api/routes/AutomationRoutes.ts`, `packages/automation/` | Automation | Rule lifecycle and execution | Automation rules engine |
| `apps/api/routes/AssistantRoutes.ts`, `packages/assistant/` | Assistant | Conversational interpretation, confirmation, and scoped execution | Assistant specs |
| `apps/api/routes/CameraRoutes.ts`, `NativeCameraRoutes.ts`, `packages/integrations/native-camera/` | Cameras | Camera source management, stream contracts, ONVIF, RTSP, and PTZ | Native camera specs |
| `packages/integrations/home-assistant/` | Home Assistant adapter | Discovery, state reconciliation, and service calls | Home Assistant specs |
| `packages/integrations/sonoff/` | Sonoff LAN adapter | mDNS discovery, local reachability, and commands | Sonoff local integration |
| `packages/system-setup/`, `packages/system-vars/` | Appliance setup | First-run configuration and persistent appliance variables | Setup and system variables |
| `packages/system-observability/` | Observability | Diagnostics, audit records, and execution history | Observability diagnostics |
| `packages/shared/` | Shared kernel | Explicit cross-cutting contracts and infrastructure helpers | Edge platform foundations |
| `apps/operator-console/src/views/` | UI orchestration | Navigation, data loading, screen flow, and local UI state | Operator Console specs |
| `apps/operator-console/src/components/` | UI composition | Reusable visual sections and specialized device presentation | Operator Console modular components |
| `apps/operator-console/src/components/ui/` | Design system | Reusable visual primitives and interaction consistency | Operator Console modular components |

## Dependency Direction

```text
UI / HTTP adapter
        ↓
Application service or use case
        ↓
Domain contract / port
        ↓
Infrastructure adapter or repository
```

The composition root is the only layer allowed to bind a port to a concrete
adapter. Integrations must not be imported by the Operator Console.

## SOLID Review Rules

1. A route translates transport concerns only.
2. A service owns one application workflow and receives dependencies explicitly.
3. A repository owns persistence details only.
4. A protocol driver owns vendor and protocol details only.
5. A view orchestrates; a component renders; a UI primitive standardizes.
6. Cross-context calls use explicit ports, events, or service contracts rather
   than database or implementation reach-through.

## Module Structure

Large orchestrators are composed from cohesive modules. The original file stays
as the entry point and keeps its exports; the parts live in a contiguous folder.

| Entry point | Parts |
|---|---|
| `packages/assistant/application/AssistantConversationService.ts` | `conversation/`: one collaborator per flow (preamble, pending confirmations, routing, planning, device and room fast paths, state queries, drafts, management, safety gate) plus pure modules for intent detection, parsing and response messages. |
| `packages/assistant/application/AssistantPlannerV2ShadowService.ts` | `planner/`: shadow configuration, comparison, reporting and the hybrid execution gate. |
| `packages/assistant/application/AssistantMultiCommandParser.ts` | `multicommand/`: text rules, scope, target resolution, compound and exclusion parsing. |
| `packages/integrations/home-assistant/application/HomeAssistantRealtimeSyncManager.ts` | `sync/`: reconnect policy, state event processing, reconciliation, resilience logging. |
| `packages/automation/application/AutomationEngine.ts` | `engine/`: trigger matching, action policy, activity logging. |
| `apps/api/routes/DeviceRoutes.ts`, `CameraRoutes.ts` | `device/` and `camera/`: one route group per concern plus pure helpers (error mapping, serialization, proxy tokens, HLS manifests). |
| `bootstrap.ts` | `infrastructure/assemblers/`: one assembler per area (database, cloud gateway, assistant runtime, container). |
| `apps/operator-console/src/App.tsx` | `lib/use*` hooks (session, setup status, realtime refresh, idle return, SSO handoff, sidebar dashboards, global wake) and `components/App*` screens. |

Rules that keep this structure from decaying:

- A new file with several responsibilities is split before it is merged; the
  working limit is about 400 lines for backend files and 300 for console files.
- Pure logic lives in plain modules with their own tests; stateful
  collaborators receive their dependencies explicitly.
- The console shared components are checked automatically: `check:modular-components`,
  `check:ui-primitives`, `check:ui-patterns`, `check:design-catalog` and
  `check:design-book-coverage` (see `docs/command-reference.md`).
- Specs: `specs/backend-modularization-v1.md`,
  `specs/operator-console-modularization-v1.md`,
  `specs/operator-console-modular-contract-v1.md`.

## Audited Exceptions

| Surface | Reason | Protection |
|---|---|---|
| `packages/assistant/application/response/AssistantResponseCatalog.ts` (669 lines) | It is a data catalogue of response keys, not logic. | `check:assistant-response-catalog` verifies keys and that no literal message bypasses it. |
| Console pattern exceptions (`scripts/ui-pattern-exceptions.json`) | Spec-pinned geometry, overlays on video and panels that are not messages. | `check:ui-patterns` fails if one grows or loses its reason. |

Any behavior-changing decomposition requires its own approved spec and
regression suite.
