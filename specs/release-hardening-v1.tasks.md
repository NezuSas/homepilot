## Phase 1: Documentation & Flows
- [ ] Crear `docs/core-release-flows-v1.md` definiendo flujos críticos e idempotencia. [id: 1.1]
- [ ] Definir shape de DTOs para todos los endpoints (incl. setup-status/diagnostics). [id: 1.2]

## Phase 2: API & DTO Hardening
- [ ] Implementar estándar `{ error: { code, message } }` en `sendError`. [id: 2.1]
- [ ] Refactorizar handlers en `OperatorConsoleServer.ts` extrayendo validación/mapping. [id: 2.2]
- [ ] Endurecer validaciones y respuestas en Auth y User Management. [id: 2.3]
- [ ] Audit y Hardening de: Onboarding, Diagnostics, HA Settings, Setup-status. [id: 2.4]

## Phase 3: Debt Cleanup (Pragmatic)
- [ ] Eliminar `window.alert()` residuales en `UsersView.tsx`. [id: 3.1]
- [ ] Limpiar `any` en módulos `Auth`, `UserManagement` y `HA`. [id: 3.2]
- [ ] Auditoría de seguridad: verificar no existencia de bypass en Auth/RBAC. [id: 3.3]
- [ ] Eliminar logs/debug innecesarios. [id: 3.4]

## Phase 4: Readiness
- [ ] Implementar `scripts/verify_release_v1.ts` con alcance completo definido. [id: 4.1]
- [ ] Crear `docs/release-readiness-v1.md` con checklist de producción. [id: 4.2]
- [ ] Validar criterios de "Release Ready" y documentar en walkthrough. [id: 4.3]

