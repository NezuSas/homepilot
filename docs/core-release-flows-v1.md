# Core Release Flows V1 - HomePilot Edge

Este documento define los flujos críticos que deben ser validados para garantizar la estabilidad y seguridad del release V1.

---

## 1. First Boot Admin Generation
**Descripción**: El sistema detecta que no hay usuarios y genera un administrador inicial de forma determinista o via bootstrap.
**Criterio de Éxito**: Al arrancar por primera vez, el sistema permite login con las credenciales de bootstrap y `SqliteUserRepository.count()` devuelve 1.
**Idempotencia**: Si el admin ya existe, el proceso de bootstrap no debe duplicar el usuario ni fallar.

## 2. Onboarding Context
**Descripción**: El instalador configura la conexión con Home Assistant (URL + Token).
**Criterio de Éxito**: `POST /api/v1/system/setup-status/complete` solo retorna éxito si la validación viva contra HA es exitosa y persiste `isInitialized = true`.
**Idempotencia**: Si el sistema ya está inicializado, llamadas subsecuentes a `/complete` deben retornar el estado actual sin repetir validaciones costosas ni alterar el timestamp original de inicialización.

## 3. Identity Management
**Descripción**: Ciclo de vida de la sesión del usuario (Login, Logout, Change Password).
**Criterio de Éxito**: 
- Login genera una sesión opaca válida por 7 días.
- `change-password` revoca todas las sesiones previas del usuario.
- Logout invalida el token actual inmediatamente.
**Seguridad**: En ningún momento se transfiere el `passwordHash` al cliente.

## 4. Administrative Controls
**Descripción**: Un administrador gestiona otros usuarios desde el directory local.
**Criterio de Éxito**:
- Se pueden crear operadores y otros administradores.
- **Minimum Admin Rule**: El sistema bloquea atómicamente cualquier acción que deje 0 administradores activos.
- La suspensión de un usuario revoca todas sus sesiones activas instantáneamente.

## 5. Real-Time Continuity
**Descripción**: El puente con Home Assistant mantiene la sincronización de estados via WebSocket.
**Criterio de Éxito**: Los cambios de estado en HA se reflejan en la Topology local en < 500ms. Al reconectar tras una caída de red, el sistema realiza una reconciliación completa de estados.

## 6. Automation Engine Reliability
**Descripción**: Ejecución de reglas automáticas basadas en eventos de dispositivos.
**Criterio de Éxito**: Un cambio en un sensor HA dispara una acción en un actuador según las reglas definidas en `AutomationRepository`. Los fallos de ejecución se registran en el `ActivityLog`.

## 7. System Visibility
**Descripción**: Diagnóstico y auditoría para el mantenimiento del Edge.
**Criterio de Éxito**: 
- `GET /api/v1/diagnostics` devuelve un snapshot consistente de salud (memory, uptime, connectors).
- Audit Logs registran acciones administrativas con IDs de autor (`adminActorUserId`) sin filtrar secretos.

---
**Validación**: Estos flujos son el objetivo principal del script `verify_release_v1.ts`.
