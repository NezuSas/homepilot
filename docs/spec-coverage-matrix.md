# Spec-Driven Coverage Matrix

This matrix connects implemented behavior to its primary specification. It
does not replace code contracts or duplicate each spec's acceptance criteria.

## Operating Rule

Before changing functional behavior, API, persistence, authorization,
integration, or UI behavior:

1. Find the applicable row.
2. Read the primary spec and its `.tasks.md` file.
3. Update the spec before code when the scope changes.
4. Add a new spec and mapping rule when no existing surface applies.

Every TypeScript/TSX file under `apps/api`, `apps/operator-console/src`, and
`packages` is checked by:

```bash
npm run check:spec-coverage
```

The command fails if a file cannot be mapped to an existing spec.

| Domain or surface | Main code | Primary spec family |
|---|---|---|
| Authentication, roles, and users | `packages/auth`, `AuthRoutes`, `AdminRoutes`, `UsersView` | Auth RBAC and user management |
| Setup and installation profiles | `packages/system-setup`, `SystemRoutes`, onboarding views | Setup, installation, and Edge customer specs |
| Home topology | `packages/topology`, `TopologyRoutes`, topology views | Home and room management |
| Dashboards and widgets | Dashboard routes, dashboard views, widgets | Dashboard layout and user navigation |
| Devices and commands | `packages/devices`, device routes, inbox, controls | Device command, capability, and state specs |
| Discovery and import | device routes, inbox, Home Assistant integration | Device discovery inbox |
| Scenes | scene routes, builder, and scene views | Scene lifecycle |
| Automation | `packages/automation`, automation routes and views | Automation engine and lifecycle |
| Assistant and voice | `packages/assistant`, assistant routes and conversation views | Assistant and natural voice specs |
| Home Assistant | Home Assistant integration and settings routes | Home Assistant connection, realtime, and resilience specs |
| Cameras | camera routes, native camera routes, camera UI | Home Assistant camera and native camera specs |
| Android Smart Displays | `AndroidDisplayRoutes`, `packages/integrations/android-display` | Android display integration V1 |
| IntentFlow manifest and effective actions | `BoardManifestV1`, `EffectiveActionsResolver` | HomePilot effectiveActions V1 |
| Installation verification | Installation verification broker and shared Cloud Edge config provider | HomePilot Installation Verification Broker V1 |
| Device-bound Edge identity | TPM/software provider, binding repository, Directory proof client, diagnostic startup | HomePilot Device-Bound Edge Identity V1 |
| IntentFlow manifest sync | Bundle parser, Directory/IntentFlow clients, local manifest cache and effective-actions provider | HomePilot IntentFlow Manifest Sync V1 |
| Smart Display commercial controls and command execution | Control catalog, command-token cache, IntentFlow command client, Action Card target | Smart Display Control Catalog V1 |
| Media | media routes and player cards | Media player local control |
| Energy | energy view and snapshot widgets | Energy management |
| Sonoff LAN | `packages/integrations/sonoff` | Sonoff local integration |
| Privacidad de escenas y automatizaciones por creador | `SceneRoutes`, `AutomationRoutes`, repositorios y casos de uso, asistente e importación de tableros | `specs/scene-lifecycle-v1.md` REQ-06/AC6; `specs/automation-rules-engine-v1.md` AC6 |
| System variables | system variables routes and package | System variables |
| Diagnostics and audit | observability packages and diagnostic views | Observability diagnostics and release hardening |
| Public ingress and deployment | Compose, ingress, and installation scripts | Public ingress, Docker, and durable persistence |
| Operator Console | console application and design system | Operator Console specs |
| Inicio hero, favoritas momentáneas, iconos de rutinas y Sections de un slot | Home hero, flip clock, context chips and direct dashboard button, routine/action tiles, Scene/Automation icon persistence and forms, Dashboard canvas and transfer normalization | `specs/operator-console-v1.md` AC38–AC44; `specs/operator-console-v1.tasks.md` UI-Home-04, QA-Home-05, BE-Home-03, UI-Home-05, QA-Home-04, UI-Home-07, QA-Home-06, UI-Dashboard-04, QA-Home-03 |
| Límite nocturno, identidades de rutinas y formularios en tablet | Personalización horaria, selectores de escenas/automatizaciones, selector modular y overlays de edición | `specs/operator-console-v1.md` AC45; `specs/operator-console-modular-components-v1.md` AC75 |
| Acciones momentáneas en Escenas y Automatizaciones | Capacidades reales `press`/`activate`, constructores y ejecución compartida de comandos | `specs/operator-console-v1.md` AC46; `specs/operator-console-v1.tasks.md` UI-Routines-01 |
| Carga inicial fluida, favoritas estables y dispositivos por espacio | LoadingState, useInitialLoading, Home y vistas asíncronas, SceneCard, AutomationDeviceSelect y SearchableSelectField | `specs/operator-console-v1.md` AC51–AC53; `specs/operator-console-v1.tasks.md` UI-Loading-01, UI-Routines-06; `specs/operator-console-modular-components-v1.md` REQ-18 |
| Shared Edge foundations | API gateway, route handler, shared contracts | Edge platform foundations |

## Audited Coverage

- The **870** audited TypeScript/TSX files have a mapping rule to an existing
  spec.
- All bounded contexts under `packages/` and all API route families are
  covered.
- Console views inherit the primary spec for the domain behavior they render.
- The executable check also verifies primary spec status, task file presence,
  acceptance criteria, and required component documentation.

## Review Gate

A change must stop for specification work when the relevant spec cannot answer:
who can execute it, which data it changes, how it fails safely, and how it is
validated.
