# Tareas: user-dashboard-navigation

## Auditoría de evidencia por criterio

- [x] **Navegación y visibilidad (AC1–AC10, AC17–AC21).** Código auditado en `apps/operator-console/src/App.tsx`, `lib/viewNavigation.ts`, `DashboardsView.tsx` y repositorios SQLite; la navegación responsive y el historial se ejercen en `apps/operator-console/tests/responsive-shell.spec.ts`.
- [x] **Estructura de secciones y catálogo (AC12–AC16, AC22–AC35).** Código y normalización auditados en `apps/operator-console/src/views/dashboards/` y sus pruebas `dashboardUtils.test.ts` / `sectionCardCatalog.test.ts`.
- [x] **Cortinas y media (AC20, AC36–AC37).** Componentes auditados en `CurtainDeviceTile.tsx`, widgets de dashboard y suites de dispositivos/integración correspondientes.
- [ ] **Evidencia de aceptación de navegación por usuario.** Añadir escenarios E2E explícitos para AC1–AC5, AC8–AC11 y AC17–AC21 sobre el sidebar autenticado.
- [ ] **Evidencia visual y de interacción de widgets.** Añadir escenarios E2E para AC12–AC16, AC22–AC37 en los breakpoints definidos por la spec.

> La spec sigue en **Borrador**: esta auditoría no declara implementados criterios que todavía carecen de escenario de aceptación directo.