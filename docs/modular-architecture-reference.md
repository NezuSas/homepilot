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

## Audited Exceptions

| Surface | Reason for size | Protection |
|---|---|---|
| `AssistantConversationService` | Coordinates natural-language routes, safety gates, confirmations, memory, and execution. | Dedicated resolvers, validators, policies, and broad test coverage. |
| `App.tsx` | Owns authenticated application shell, realtime event orchestration, and responsive navigation. | Store boundaries, extracted views/components, and responsive tests. |
| Dashboard widget composition | Supports persisted, heterogeneous widget types. | Widget-level components and spec-governed normalization. |

These are tracked as refactoring candidates, not documentation defects. Any
behavior-changing decomposition requires its own approved spec and regression
suite.