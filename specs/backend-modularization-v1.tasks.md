# TASK BREAKDOWN: Backend Modularization V1

- [x] Medición: archivos de backend de producción por tamaño (2026-10-10): `AssistantConversationService` 5.514, `DeviceRoutes` 732, `AssistantResponseCatalog` 669, `CameraRoutes` 562, `HomeAssistantRealtimeSyncManager` 546, `bootstrap` 532, `AssistantPlannerV2ShadowService` 526, `AssistantMultiCommandParser` 475, `AutomationEngine` 447.
- [x] `AssistantConversationService` dividido en `conversation/` (218 líneas la entrada; 23 colaboradores, 9 módulos puros, ningún archivo por encima de 355 líneas). La entrada conserva firma del constructor y exportaciones; `ConversationLegacySurface.ts` mantiene los nombres antiguos de métodos privados que usan pruebas existentes (candidato a retirar repuntando esas pruebas).
- [x] `DeviceRoutes` (732 → 45) y `CameraRoutes` (562 → 101) divididos en `device/` y `camera/`; `CameraRoutes` conserva métodos delegados `protected` que usa su prueba existente.
- [x] `HomeAssistantRealtimeSyncManager` (546 → 328), `AutomationEngine` (447 → 272), `AssistantPlannerV2ShadowService` (526 → 273), `AssistantMultiCommandParser` (475 → 100) y `bootstrap` (532 → 219) divididos.
- [x] Pruebas propias de los módulos puros nuevos (8 archivos de prueba nuevos más 4 de conversación).
- [x] Suite completa: Jest 415 suites y 4.317 pruebas sin cambiar aserciones previas; typecheck, build y controles `no-production-any`, `architecture-boundaries`, `module-test-coverage`, `assistant-response-catalog`, `spec-coverage` (1.244 archivos) y `bdd-traceability`.
- [x] Reglas de mapeo de `check-spec-coverage` ampliadas a `apps/api/routes/camera/` y `apps/api/routes/device/`; matriz actualizada.
- [ ] Retirar `ConversationLegacySurface` y los delegados `protected` repuntando las pruebas a los colaboradores o módulos puros.
- [ ] Revisión de código humana de `conversation/` antes de publicar (cambio grande en el flujo del asistente y del control físico).
