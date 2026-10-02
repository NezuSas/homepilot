# Spec-Driven Coverage Matrix

- Modbus TCP nativo: `specs/modbus-tcp-local-integration-v1.md` AC1–AC7; protocolo TCP simulado, configuración/inventario SQLite, driver, lifecycle y rutas Admin en `ModbusTcpClient.test.ts`, `ModbusService.test.ts`, `ModbusRoutes.test.ts`. Jest focalizado 102/102 PASS en 6 suites (67 Modbus y 35 regresión); responsive `Native Modbus configuration` 5/5 PASS: móvil, tablet portrait/landscape, desktop, claro/oscuro y no-Admin. Typecheck/lint/builds y controles de trazabilidad/arquitectura/i18n PASS. Evidencia `.impeccable/review/modbus-v1/`. Sin suites completas, Docker ni certificación del PLC físico/mapa Xinje.

- Densidad Sensor / llegada entre Sections: 73/73 Jest focalizados; 10/10 responsive en `.impeccable/review/sensor-density-cross-drop/`, confirmación de arrastre 7/7 en `.impeccable/review/sensor-density-drag-confirm/` (16 escenarios únicos). Padding vertical computado ≤8px y separación lectura/pie ≤8px en todas las presentaciones; misma geometría skeleton/contenido; overlay sobre otra Section y animación Web Animations real después de soltar, con persistencia y sin comandos físicos. Typecheck/lint/builds raíz/consola y controles spec/BDD/module/i18n/arquitectura/no-any PASS. Ajuste local sin schema ni IDs persistidos.

- Refinamiento Sensor/drag 2026-10-02: 76/76 Jest en SensorMetricCard/SensorAnalogGauge/DashboardCardSkeleton/sectionSlots/sectionCardDrag; responsive focalizado 19/19 en `.impeccable/review/compact-drag-verified/`. Unidad inline, tipografía común, graduaciones adicionales, ausencia compacta, preview elevado, Section desde fondo libre y masonry por columna con huecos persistidos. Geometría skeleton/contenido, mouse/touch/teclado y cancelación seguida de movimiento comprobados. Typecheck/lint/builds y spec/BDD/module/i18n/arquitectura/no-any PASS. No responsive completo, Git ni deploy.

- Sensor analógico AC40 vigente (2026-10-02): `SensorAnalogGauge.test.tsx`, `SensorMetricCard.test.tsx`, `DashboardCardSkeleton.test.tsx`, `TopologyDeviceTile.test.tsx` → 75/75 PASS; responsive Sensor clarity/Sensor width/Room devices/geometría inicial → 17/17 y confirmación Sensor 5/5 PASS. Presenter modular y escala instrumental real sustituyen fichas/barra; spec y tareas Dashboard actualizadas, documento `docs/components/SensorMetricCard.md`. Typecheck/lint/builds y spec/BDD/module/i18n/arquitectura/no-any PASS. Evidencia `.impeccable/review/analog-final/`; no suite responsive completa ni publicación. Las entradas Sensor del 2026-10-01 conservadas abajo son históricas.

Verificación documental final 2026-10-01 por el coordinador: spec coverage, BDD traceability y module test coverage PASS tras la actualización Sensor v2; la repetición mencionada abajo quedó completada.

- Evidencia Sensor AC40 vigente, 2026-10-01: extensión local en la paleta Dashboard existente. Cabecera/hero/pie en bandas comunes, nombres completos con salto natural, icono encima en angosto, cifras de peso 450, profundidad compacta y meter porcentual en el pie. Radio 16 px efectivo en CSS y wrapper Sensor de `SectionCardItem`; skeleton propio sin radio general conflictivo y con iguales bandas y `containerName: sensor-card`. `123456.7` continuo, aproximadamente 19–20 px en angosto, unidad debajo; ausencia «— / Sin lectura» sin interrogación ni datos ficticios. Modelo/presenter, grid, masonry y backend sin cambios en esta corrección. Capturas `.impeccable/review/sensor-v2-*`; revisión final fresca confirma resueltos P2 radio, P2 lectura larga y P3 skeleton. Aprobación visual del usuario pendiente.
- Validación final comunicada por el coordinador: Jest 57/57 en tres suites y 16 escenarios responsive únicos PASS inicialmente; 9/9 Sensor/skeleton PASS en dos confirmaciones tras corregir radio conflictivo. Prueba responsive añade ajuste computado de título y radio 16 px sin relajar aserciones. Typecheck, lint y builds raíz/Operator Console finales PASS; spec/BDD/module/i18n/architecture/no-production-any PASS antes de esta actualización documental, con los tres controles documentales pendientes de repetición por el coordinador. Responsive completo: cero ejecuciones. Docker no ejecutado; hardware físico, Safari, tecnologías de asistencia y contraste numérico no certificados. Detalle e historial en `specs/dashboard-layout-and-widgets-v1.tasks.md` y `design-qa.md`.
- Las dos entradas Sensor anteriores conservadas abajo son históricas: sus PASS y veredicto técnico limitado preceden al rechazo visual del usuario y no representan aceptación ni evidencia vigente.

- Descubrimiento offline y limpieza de pendientes: `device-discovery-inbox.md` AC10/AC14 → `ExpiredInboxDeviceRemover.test.ts`, `HomeAssistantRealtimeSyncManager.test.ts`, `DeviceRoutes.state-sync.test.ts`, responsive Compact discovery. Sensor fichas y geometría: `dashboard-layout-and-widgets-v1.md` AC40 → `SensorMetricCard.test.tsx`, `DashboardCardSkeleton.test.tsx`, `TopologyDeviceTile.test.tsx`, responsive Sensor clarity/skeleton geometry/Room devices. Alineación de configuración: `operator-console-v1.md` AC61 → responsive Compact settings.

- Evidencia Sensor AC40, 2026-10-01: rediseño desde `C:/Users/ocuen/AppData/Local/Temp/codex-clipboard-352e98b7-4278-4a87-8fbd-3b619381098e.png` dentro de la paleta cálida/naranja existente del Dashboard; icono y estancia real, fichas grandes centradas, meter inferior porcentual, estados informativos y ausencia de lectura explícita, sin historia ni rangos ficticios. `SensorMetricCard`/`DashboardCardSkeleton` comparten carcasa responsive; `SectionCardContent`/`SectionCardItem` transmiten `roomName` y `TopologyDeviceTile` respeta esa carcasa sin `h-36`. La geometría autorizada sustituye el criterio histórico de tamaño fijo del Sensor y conserva la exigencia de bounds estables skeleton → contenido, sin cambiar masonry global. Revisión final resuelve lectura continua `123456.7` y paridad móvil de 126×192 con el mismo `containerType`.
- Validación Sensor AC40, 2026-10-01: 57/57 pruebas en tres suites focalizadas y 16 escenarios responsive únicos PASS (cinco Sensor clarity, cuatro skeleton geometry, siete Room devices). Typecheck, lint, build raíz/Operator Console y controles spec/BDD/module/i18n/architecture/no-production-any PASS. Suites completas, hardware físico y Docker no ejecutados; sin operaciones Git/GitHub ni publicación. El detalle y las limitaciones se registran en `specs/dashboard-layout-and-widgets-v1.tasks.md`.

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
| Espacios operativos compactos | TopologyRoomDetailPanel, TopologyDeviceTile, topologyDeviceControl, RoomDisplayControls, CameraDeviceTile, presentaciones compartidas del Dashboard | `specs/home-room-management.md` AC16, AC24–AC26; `specs/smart-display-control-catalog-v1.md` |
| Dashboards and widgets | Dashboard routes, dashboard views, widgets | Dashboard layout and user navigation |
| Devices and commands | `packages/devices`, device routes, inbox, controls | Device command, capability, and state specs |
| Discovery and import | device routes, inbox, Home Assistant integration | Device discovery inbox |
| Scenes | scene routes, builder, and scene views | Scene lifecycle |
| Automation | `packages/automation`, automation routes and views | Automation engine and lifecycle |
| Assistant and voice | `packages/assistant`, assistant routes and conversation views | Assistant and natural voice specs |
| Home Assistant | Home Assistant integration and settings routes | Home Assistant connection, realtime, and resilience specs |
| Cameras | camera routes, native camera routes, camera UI | Home Assistant camera and native camera specs |
| Compact suggestions, camera settings and diagnostics | AssistantFindingCard/GroupCard, DashboardInsightsSection, NativeCameraSettingsCard, DateField, DiagnosticsResilienceSummary | Operator Console V1 AC59; existing Assistant/native camera contracts unchanged |
| Compact settings and first-row loading | HomePersonalizationView, HomeAssistantSettingsView, OnboardingView, component-owned skeletons, concise suggestion evidence | Operator Console V1 AC61; existing onboarding/HA contracts unchanged |
| Android Smart Displays | `AndroidDisplayRoutes`, `packages/integrations/android-display` | Android display integration V1 |
| IntentFlow manifest and effective actions | `BoardManifestV1`, `EffectiveActionsResolver` | HomePilot effectiveActions V1 |
| Installation verification | Installation verification broker and shared Cloud Edge config provider | HomePilot Installation Verification Broker V1 |
| Device-bound Edge identity | TPM/software provider, binding repository, Directory proof client, diagnostic startup | HomePilot Device-Bound Edge Identity V1 |
| IntentFlow manifest sync | Bundle parser, Directory/IntentFlow clients, local manifest cache and effective-actions provider | HomePilot IntentFlow Manifest Sync V1 |
| Smart Display commercial controls and command execution | Control catalog, command-token cache, IntentFlow command client, Action Card target | Smart Display Control Catalog V1 |
| Media | media routes and player cards | Media player local control |
| Energy | energy view and snapshot widgets | Energy management |
| Operative room eligibility and compact insights | deviceOperationalEligibility, assignedEnergyPresentation, SceneDeviceSelector, AutomationDeviceSelect, SectionWidget, AssistantFindingCard, DashboardInsightsSection, EnergyView, component skeletons | `specs/operator-console-v1.md` AC60; `specs/energy-management-v1.md` AC4 |
| Sonoff LAN | `packages/integrations/sonoff` | Sonoff local integration |
| Privacidad de escenas y automatizaciones por creador | `SceneRoutes`, `AutomationRoutes`, repositorios y casos de uso, asistente e importación de tableros | `specs/scene-lifecycle-v1.md` REQ-06/AC6; `specs/automation-rules-engine-v1.md` AC6 |
| System variables | system variables routes and package | System variables |
| Diagnostics and audit | observability packages and diagnostic views | Observability diagnostics and release hardening |
| Public ingress and deployment | Compose, ingress, and installation scripts | Public ingress, Docker, and durable persistence |
| Operator Console | console application and design system | Operator Console specs |
| Inicio hero, favoritas momentáneas, iconos de rutinas y Sections de un slot | Home hero, flip clock, context chips and direct dashboard button, routine/action tiles, Scene/Automation icon persistence and forms, Dashboard canvas and transfer normalization | `specs/operator-console-v1.md` AC38–AC44; `specs/operator-console-v1.tasks.md` UI-Home-04, QA-Home-05, BE-Home-03, UI-Home-05, QA-Home-04, UI-Home-07, QA-Home-06, UI-Dashboard-04, QA-Home-03 |
| Límite nocturno, identidades de rutinas y formularios en tablet | Personalización horaria, selectores de escenas/automatizaciones, selector modular y overlays de edición | `specs/operator-console-v1.md` AC45; `specs/operator-console-modular-components-v1.md` AC75 |
| Acciones momentáneas en Escenas y Automatizaciones | Capacidades reales `press`/`activate`, constructores y ejecución compartida de comandos | `specs/operator-console-v1.md` AC46; `specs/operator-console-v1.tasks.md` UI-Routines-01 |
| Carga inicial propia por componente, favoritas estables y dispositivos por espacio | LoadingState, ComponentSkeletons, useInitialLoading, Home y vistas asíncronas, SceneCard, AutomationDeviceSelect y SearchableSelectField | `specs/operator-console-v1.md` AC51–AC53; `specs/operator-console-v1.tasks.md` UI-Loading-01, UI-Routines-06; `specs/operator-console-modular-components-v1.md` REQ-18 |
| Gestor de configuración sin controles operativos | ManagedDeviceTile, DeviceInspector, InboxView, useDisplayControlCatalog | `specs/operator-console-v1.md` AC54; `specs/operator-console-modular-components-v1.md` AC77–AC78 (fichas compactas, filtros, Drawer estable y scroll sin barras); `specs/smart-display-control-catalog-v1.md` |
| Shared Edge foundations | API gateway, route handler, shared contracts | Edge platform foundations |

## Audited Coverage

- The **920** audited TypeScript/TSX files have a mapping rule to an existing
  spec.
- All bounded contexts under `packages/` and all API route families are
  covered.
- Console views inherit the primary spec for the domain behavior they render.
- The executable check also verifies primary spec status, task file presence,
  acceptance criteria, and required component documentation.

## Review Gate

Puesta en marcha Modbus local: `modbus-tcp-local-integration-v1` AC8–AC10 cubre probe Admin/hogar, bloque RAW readonly acotado, cancelación/refresco y conversión común de 16/32 bits con creación explícita desde una fila probada. Evidencia focal: 136/136 Jest y 10/10 responsive PASS; lectura TCP simulada, no PLC físico. Sin migración adicional; downgrade de variables uint32/int32 exige conversión compatible o backup.

Refinamiento local rutinas/observabilidad/tema automático: `scene-lifecycle-v1` AC6 y `automation-rules-engine-v1` AC6 cubren concesiones explícitas read/run/favorite y administración exclusiva del creador. Migración 034 aditiva requiere backup antes de MiniPC. `assistant-v1` cubre zona horaria del sistema y evidencia de cuatro días locales para hábitos; `operator-console-v1` y `observability-diagnostics-v1` cubren densidad, skeletons propios y filtros recientes por nombre. Componentes reutilizables documentados en `docs/components/RoutineSharingField.md` y `EventFilters.md`. Pruebas: SceneRoutes.sharing, SQLiteAutomationRuleRepository.sharing, BehaviorAnalysisService, AutomationEngine, eventFiltering, automaticTheme y escenarios responsive focalizados de filtros/editores.

Refinamiento local Sensor/Espacios: `dashboard-layout-and-widgets-v1` AC40 cubre tamaño medio fijo, ausencia de selector/resize, estancia no repetida y carcasa/skeleton compactos. `home-room-management` AC16 cubre grupos por tipo efectivo y orden alfabético interno. Evidencia: `sectionCardCatalog.test.ts`, `topologyDeviceControl.test.ts`, `TopologyDeviceTile.test.tsx` y escenarios responsive `Sensor width`, `Sensor clarity`, `Room devices` y geometría inicial del skeleton. Validación focalizada: 79/79 Jest y 17/17 responsive PASS.

A change must stop for specification work when the relevant spec cannot answer:
who can execute it, which data it changes, how it fails safely, and how it is
validated.
