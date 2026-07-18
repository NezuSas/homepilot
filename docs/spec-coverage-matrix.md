# Matriz de Cobertura Spec-Driven

Esta matriz conecta el comportamiento implementado con su especificación primaria. No reemplaza los contratos de código ni duplica los criterios de aceptación de cada spec.

## Regla operativa

Antes de modificar comportamiento, API, persistencia, permisos, integración o UI funcional:

1. Ubicar la fila correspondiente.
2. Leer la spec primaria y su archivo `.tasks.md`.
3. Actualizar la spec antes del código si el alcance cambia.
4. Añadir una fila y una nueva spec si la superficie no existe.

La comprobación ejecutable de cada archivo TypeScript/TSX bajo `apps/api`,
`apps/operator-console/src` y `packages` se realiza con:

```bash
npm run check:spec-coverage
```

El comando falla si un archivo no se puede asignar a una spec existente.

| Dominio o superficie | Código principal | Spec primaria |
|---|---|---|
| Autenticación, roles y usuarios | `packages/auth`, `AuthRoutes`, `AdminRoutes`, `UsersView` | `auth-rbac-v1-local-edge-security.md`, `user-management-v2-admin-user-administration.md` |
| Onboarding y primer administrador | `packages/system-setup`, `SystemRoutes`, `FirstAdminSetupView`, `OnboardingView` | `first-run-setup-edge-onboarding-v1.md`, `edge-customer-installation-v1.md` |
| Topología de hogares y habitaciones | `packages/topology`, `TopologyRoutes`, `TopologyView` | `home-room-management.md` |
| Dashboards, pestañas, secciones y widgets | `DashboardRoutes`, `DashboardView`, `DashboardsView`, `views/dashboards` | `dashboard-layout-and-widgets-v1.md`, `user-dashboard-navigation.md` |
| Dispositivos, comandos y estado | `packages/devices`, `DeviceRoutes`, gestor e inbox | `device-command-execution.md`, `device-capabilities-command-validation.md`, `device-state-sync-observability.md` |
| Descubrimiento e importación | `DeviceRoutes`, `InboxView`, integración HA | `device-discovery-inbox.md` |
| Escenas | `SceneRoutes`, `ScenesView`, `SceneBuilderModal` | `scene-lifecycle-v1.md` |
| Automatizaciones y ejecución | `packages/automation`, `AutomationRoutes`, `AutomationsView`, `AutomationWorkbenchView` | `automation-rules-engine-v1.md`, `automation-rule-lifecycle-v1.md`, `automation-engine-v2-event-driven.md` |
| Asistente de voz y conversación | `packages/assistant`, `AssistantRoutes`, `AssistantView`, `HomeConversationView` | `assistant-v1.md`, `home-conversation-natural-voice-v1.md` |
| Bridge y sincronización Home Assistant | `packages/integrations/home-assistant`, `SettingsRoutes`, `HomeAssistantSettingsView` | `home-assistant-settings-connection-management-v1.md`, `home-assistant-realtime-sync-v1.md`, `home-assistant-sync-resilience-v2.md` |
| Cámaras HA y cámaras nativas | `CameraRoutes`, `NativeCameraRoutes`, `NativeCamerasView`, `CameraMediaFrame` | `home-assistant-camera-streaming-v1.md`, `native-camera-local-integration-v1.md` |
| Reproductores multimedia | `MediaRoutes`, `MediaPlayerRoutes`, `MediaPlayerCard` | `media-player-local-control-v1.md` |
| Energía | `EnergyView`, `useEnergyStore`, `EnergySnapshotWidget` | `energy-management-v1.md` |
| Integración Sonoff local | `packages/integrations/sonoff` | `sonoff-local-integration-v1.md` |
| Variables persistentes | `packages/system-vars`, `SystemVariableRoutes` | `system-variables-v1.md` |
| Diagnóstico, auditoría y ejecución | `packages/system-observability`, `ExecutionRoutes`, `DiagnosticsView`, `AuditLogsView`, `ExecutionLogsView` | `observability-diagnostics-v1.md`, `release-hardening-v1.md` |
| Ingreso público y despliegue Edge | Compose, ingress, scripts de instalación | `homepilot-public-ingress-v1.md`, `dockerization-edge-runtime-v1.md`, `local-durable-persistence-v1.md` |
| Operator Console y sistema visual | `apps/operator-console`, `components/ui`, design tokens | `operator-console-v1.md`, `docs/design-system.md` |
| Componentes modulares de consola | `components/ui`, modales, campos, navegación y tokens compartidos | `operator-console-modular-components-v1.md`, `docs/operator-console-component-catalog.md` |
| Fundamentos de plataforma Edge | `ApiGateway`, `RouteHandler`, `OperatorConsoleServer`, `packages/shared` | `edge-platform-foundations-v1.md` |

## Cobertura auditada

- Los 527 archivos TypeScript/TSX auditados tienen una regla de mapeo a una spec existente.
- Todos los bounded contexts bajo `packages/` y familias de rutas de `apps/api/routes/` están cubiertos.
- Las vistas de Operator Console se agrupan por comportamiento de dominio; una vista puramente composicional hereda la spec de su superficie.
- Las nuevas superficies formalizadas en esta auditoría son escenas, dashboards/widgets, media player, system variables, energía, Sonoff local y fundamentos Edge.

## Criterio de revisión

Una modificación debe detenerse y solicitar definición cuando no pueda responder, desde su spec: quién puede ejecutarla, qué datos modifica, qué falla debe mostrar y cómo se valida.
