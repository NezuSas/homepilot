# Matriz inicial de trazabilidad SDD / TDD / BDD

| Bounded context | Spec primaria | Suite TDD | Escenario BDD ejecutable |
| --- | --- | --- | --- |
| Administración de usuarios | `user-management-v2-admin-user-administration.md` | `__tests__/UserManagement.test.ts` | `apps/api/__tests__/AdminRoutes.test.ts` — administración solo para admin y DTO sin secretos |
| Auth | `auth-rbac-v1-local-edge-security.md` | `apps/api/__tests__/AuthRoutes.security.test.ts` | Bloqueo de inicio de sesión tras intentos fallidos |
| Devices | `device-command-execution.md` | `packages/devices/__tests__/command_api.test.ts` | Despacho de comando válido y rechazo de estados inválidos |
| Device discovery | `device-discovery-inbox.md` | `apps/api/__tests__/DeviceRoutes.state-sync.test.ts`, `DeviceRoutes.delete.test.ts` + `apps/operator-console/tests/responsive-shell.spec.ts` | Gateway M2M, integridad de borrado y consola: consulta resumen sin atributos y carga progresiva de candidatos |
| Home Assistant WebSocket | `home-assistant-realtime-sync-v1.md` | `packages/integrations/home-assistant/__tests__/HomeAssistantWebSocketClient.test.ts` | Handshake válido suscribe el stream y timeout se clasifica como no alcanzable |
| Sonoff LAN | `sonoff-local-integration-v1.md` | `packages/integrations/sonoff/__tests__/SonoffDeviceDriver.test.ts` | Despacho local validado y rechazo previo de comando no soportado |
| Tuya policy | `tuya-integration-policy-v1.md` | `packages/devices/__tests__/HomeAssistantImportService.test.ts` | Cortina Tuya importada conserva el bridge Home Assistant |
| Device capabilities | `device-capabilities-command-validation.md` | `packages/devices/__tests__/CommandCapabilityValidator.test.ts` | Rechazo de comandos no soportados por la capacidad del dispositivo |
| Automation lifecycle | `automation-rule-lifecycle-v1.md` | `packages/devices/__tests__/automation/automation_lifecycle.test.ts` | Creación horaria predeterminada conserva hora local, zona IANA y días |
| Automation Engine V2 | `automation-engine-v2-event-driven.md` | `packages/devices/__tests__/automation/automation_engine.test.ts` | Rebotes concurrentes se deduplican y quedan auditados |
| Diagnósticos del sistema | observability-diagnostics-v1.md | packages/system-observability/__tests__/DiagnosticsService.test.ts | pps/api/__tests__/SystemRoutes.diagnostics.test.ts — snapshot y timeline requieren autenticación y delegan al servicio |
| Local durable persistence | `local-durable-persistence-v1.md` | `packages/shared/infrastructure/database/__tests__/SqliteDatabaseManager.test.ts` | Journal DELETE no crea sidecars WAL/SHM en bind mount Windows |
| Scenes | `scene-lifecycle-v1.md` | `packages/devices/__tests__/SceneExecutionService.test.ts` | Ejecución paralela de una escena |
| Assistant | `assistant-v1.md` + `nezu-domestic-assistant-v1.md` | `assistant_execution.test.ts` + `assistant_conversation_service.test.ts` | Resolución, ejecución y matriz conversacional residencial |
| Local voice conversation | `home-conversation-natural-voice-v1.md` | `homeConversationVoice.test.ts` + `apps/api/__tests__/AssistantRoutes.test.ts` | Activador canónico, STT Whisper local, TTS Piper y error seguro |
| Operator Console | `operator-console-v1.md` | `apps/operator-console/src/lib/__tests__/assistantApi.test.ts` | Envío de conversación desde la consola |
| App shell | `operator-console-v1.md` | `apps/operator-console/src/config/__tests__/appDemoSteps.test.ts` | Guía de demostración con selectores y vistas estables |
| Dashboard sections | `dashboard-layout-and-widgets-v1.md` | `apps/operator-console/src/views/dashboards/widgets/__tests__/sectionCardCatalog.test.ts` | Normalización de tarjetas y compatibilidad de layout |
| User dashboard navigation | `user-dashboard-navigation.md` | `apps/operator-console/tests/responsive-shell.spec.ts` | Grupo de dashboards colapsable y navegación al dashboard hijo autenticado |

Esta matriz inicia el criterio AC2 de `engineering-quality-compliance-v1`: cada fila se mantiene con pruebas automatizadas, y se ampliará antes de declarar el contexto Implementado.