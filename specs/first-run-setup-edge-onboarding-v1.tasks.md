# First-Run Setup & Edge Onboarding V1 - Tasks

## Implementación validada

- [x] Persistir `SystemSetupState` y exponer `SystemSetupRepository` para el estado local.
- [x] Implementar `SystemSetupService.getSetupStatus()` con señales de administrador, perfil de instalación y Home Assistant.
- [x] Implementar `completeOnboarding(userId)` con validación viva para perfiles que requieren Home Assistant, creación de hogar local y auditoría estructurada.
- [x] Mantener idempotencia: un appliance inicializado no vuelve a validar ni mutar estado.
- [x] Inyectar repositorios y servicios desde `bootstrap.ts`.
- [x] Cubrir perfil nativo, onboarding bridge exitoso e idempotencia en `packages/system-setup/__tests__/SystemSetupService.test.ts`.

## Evidencia de integración pendiente

- [ ] Verificar persistencia SQLite después de reiniciar el proceso.
- [ ] Verificar por HTTP los roles de `GET /api/v1/system/setup-status` y `POST /api/v1/system/setup-status/complete`.
- [ ] Ejercer el flujo completo de la consola: creación del primer administrador, diagnóstico, prueba de Home Assistant y finalización.