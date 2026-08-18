# HomePilot Architecture

## System Model

HomePilot is a local-first smart-home appliance. The Edge runtime is the source
of truth for a physical home: it owns device communication, current state,
automations, local authentication, and the Operator Console API. Cloud services
are additive and must not be required for local control.

## Runtime

| Layer | Responsibility | Technology |
|---|---|---|
| API | HTTP contracts, authentication boundary, and route dispatch | Fastify v5, TypeScript |
| Realtime | Authenticated state delivery to clients | `ws` attached to Fastify |
| UI | Stateless browser shell for rendering and user interaction | React, Vite, TypeScript |
| Persistence | Durable local application state | SQLite |
| Integrations | Translation between HomePilot commands and external protocols | Home Assistant, Sonoff LAN, ONVIF/RTSP, local media drivers |
| Runtime packaging | Reproducible appliance deployment | Docker Compose |

## Architectural Boundaries

### Composition root

`bootstrap.ts` and `infrastructure/assemblers/` construct concrete adapters and
inject them into application services. Domain routes and application services do
not create integration clients or database connections directly.

### API adapters

`apps/api/routes/` contains HTTP adapters. A route parses and validates input,
uses injected services, and translates domain errors into HTTP responses. Route
logic must not contain domain decisions or create infrastructure services.

### Bounded contexts

- `packages/auth`: sessions, authentication, local users, roles, and Directory SSO links.
- `packages/topology`: homes, rooms, memberships, and structural ownership.
- `packages/devices`: device lifecycle, capabilities, commands, and state.
- `packages/automation`: automation rule execution.
- `packages/assistant`: conversational intent, confirmation, scope, and response orchestration.
- `packages/integrations`: protocol-specific adapters for Home Assistant, Sonoff LAN, and native cameras.
- `packages/system-*`: setup, persistent system variables, and operational diagnostics.
- `packages/shared`: stable cross-cutting contracts, events, HTTP abstractions, and persistence helpers.

### Operator Console

`apps/operator-console/src/views/` owns route-level orchestration, data loading,
local state, and navigation. `components/` renders reusable sections;
`components/ui/` provides reusable visual primitives. Browser components do not
contain domain rules or bypass API contracts.

## Data and Event Flow

1. A UI action reaches a route through a stable HTTP contract.
2. The route calls an application service.
3. The service validates authorization and domain capability, then uses an
   injected port or driver.
4. The integration adapter sends the physical command or consumes an external
   update.
5. The resulting state is persisted and emitted through the local event path.
6. The Operator Console refreshes or receives the state without treating the
   browser as the source of truth.

## SOLID Enforcement

- **Single Responsibility:** route adapters, use cases, repositories, drivers,
  and visual components have distinct ownership.
- **Open/Closed:** device and camera protocol support is extended through driver
  registrations rather than UI-specific vendor branching.
- **Liskov Substitution:** integration implementations conform to their ports
  and can be replaced in tests.
- **Interface Segregation:** application dependencies use focused repository,
  driver, and service contracts.
- **Dependency Inversion:** composition roots inject infrastructure into
  application services and route handlers.

## Controlled Complexity

`AssistantConversationService`, `App.tsx`, and dashboard widget composition are
large orchestration surfaces. They are covered by dedicated collaborators,
feature specs, and tests. Refactoring them is a behavior-changing engineering
initiative and is intentionally separate from documentation-only audit work.

## Validation Contract

```bash
npm run verify:quality
npm run typecheck
npm run test
npm run build
npm run build --prefix apps/operator-console
```

For runtime changes, validate the applicable Docker Compose profile as defined
in `docs/command-reference.md`.