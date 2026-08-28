## Phase 1: Documentation & Flows
- [x] Crear `docs/core-release-flows-v1.md` definiendo flujos críticos e idempotencia. Evidencia: `docs/core-release-flows-v1.md`. [id: 1.1]
- [ ] Definir shape de DTOs para todos los endpoints (incl. setup-status/diagnostics). [id: 1.2]

## Phase 2: API & DTO Hardening
- [x] Implementar estándar `{ error: { code, message } }` en `sendError`. Evidencia: `apps/api/routes/ApiRoutes.ts` y `apps/api/__tests__/ApiRoutes.error-sanitization.test.ts`. [id: 2.1]
- [ ] Refactorizar handlers en `OperatorConsoleServer.ts` extrayendo validación/mapping. [id: 2.2]
- [x] Endurecer validaciones y respuestas en Auth y User Management. Evidencia: `apps/api/__tests__/AuthRoutes.security.test.ts` y `AdminRoutes.test.ts`. [id: 2.3]
- [ ] Audit y Hardening de: Onboarding, Diagnostics, HA Settings, Setup-status. [id: 2.4]

## Phase 3: Debt Cleanup (Pragmatic)
- [x] Eliminar `window.alert()` residuales en `UsersView.tsx`. Evidencia: búsqueda de producción sin `window.alert` y notificación basada en estado. [id: 3.1]
- [x] Limpiar `any` en módulos `Auth`, `UserManagement` y `HA`. Evidencia: `npm run check:no-production-any`. [id: 3.2]
- [x] Auditoría de seguridad: verificar no existencia de bypass en Auth/RBAC. Evidencia: `apps/api/__tests__/AuthRoutes.security.test.ts` y `AdminRoutes.test.ts`. [id: 3.3]
- [x] Eliminar logs/debug innecesarios. Evidencia: SQLite no registra SQL por defecto en `buildDatabase.ts`/`bootstrap.ts`. [id: 3.4]

## Phase 4: Readiness
- [x] Implementar `scripts/verify_release_v1.ts` con alcance completo definido. Evidencia: valida contrato público, autenticación, setup, diagnósticos, HA, directorio y revocación sin imprimir secretos. [id: 4.1]
- [x] Crear `docs/release-readiness-v1.md` con checklist de producción. Evidencia: `docs/release-readiness-v1.md`. [id: 4.2]
- [x] Añadir workflow manual de validación de oficina con runner dedicado, checkout fijo de main, entorno protegido y secretos acotados al paso de release. Evidencia: .github/workflows/office-release-validation.yml y docs/release-readiness-v1.md. [id: 4.3]
- [ ] Validar criterios de "Release Ready" y documentar en walkthrough. [id: 4.4]

- [x] Excluir el directorio del runner local del contexto Docker para evitar que sus archivos internos entren en capas de compilación. Evidencia: `.gitignore`, `.dockerignore` y `docs/release-readiness-v1.md`. [id: 4.5]

- [x] Alinear la verificación de ruta inexistente y autenticación con los contratos del API: probar `404 NOT_FOUND` con una sesión válida, `401 MISSING_TOKEN` sin sesión y `401 INVALID_TOKEN` tras revocación. Evidencia: `scripts/verify_release_v1.ts`. [id: 4.6]
