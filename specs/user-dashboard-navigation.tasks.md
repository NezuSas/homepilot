# Tareas: user-dashboard-navigation

## Auditoría de evidencia por criterio

- [x] **Navegación y visibilidad (AC1–AC10, AC17–AC21).** Código auditado en `apps/operator-console/src/App.tsx`, `lib/viewNavigation.ts`, `DashboardsView.tsx` y repositorios SQLite; la navegación responsive y el historial se ejercen en `apps/operator-console/tests/responsive-shell.spec.ts`.
- [x] **Estructura de secciones y catálogo (AC12–AC16, AC22–AC35).** Código y normalización auditados en `apps/operator-console/src/views/dashboards/` y sus pruebas `dashboardUtils.test.ts` / `sectionCardCatalog.test.ts`.
- [x] **Cortinas y media (AC20, AC36–AC37).** Componentes auditados en `CurtainDeviceTile.tsx`, widgets de dashboard y suites de dispositivos/integración correspondientes.
- [x] **Evidencia E2E de sidebar (AC1, AC2, AC5, AC10).** `apps/operator-console/tests/responsive-shell.spec.ts` comprueba la etiqueta localizada, expansión/colapso independiente y navegación del dashboard hijo autenticado.
- [ ] **Evidencia de aceptación restante de navegación por usuario.** Añadir escenarios E2E explícitos para AC3–AC4, AC8–AC9, AC11 y AC17–AC21.
- [ ] **Evidencia visual y de interacción de widgets.** Añadir escenarios E2E para AC12–AC16, AC22–AC37 en los breakpoints definidos por la spec.

> La spec sigue en **Borrador**: esta auditoría no declara implementados criterios que todavía carecen de escenario de aceptación directo.