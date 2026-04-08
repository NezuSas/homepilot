# Release Hardening V1 (Test, Validation & Production Readiness)

## Contexto
El sistema HomePilot Edge cuenta con las funcionalidades core de automatización, integración con Home Assistant, gestión de usuarios y onboarding. Sin embargo, para transicionar a un estado de "Production Ready", se requiere una fase de endurecimiento que consolide la seguridad, la estabilidad de los contratos (APIs) y la verificabilidad de los procesos críticos.

## Objetivos
- **Consolidar la robustez**: Eliminar comportamientos erráticos, validaciones débiles y deuda técnica residual (acotada).
- **Validar flujos core**: Garantizar que los procesos críticos sean idempotentes, consistentes y seguros.
- **Estandarizar la comunicación**: Implementar un formato de error único y seguro para toda la API.
- **Preparar el despliegue**: Documentar requisitos y pasos de verificación operativa.

## Alcance
- Creación de `docs/core-release-flows-v1.md` para definición de flujos clave.
- Auditoría y hardening de APIs (Auth, Users, Onboarding, HA Settings, Setup-status).
- Limpieza de deuda técnica acotada (alerts, any críticos, logs innecesarios).
- Implementación de `scripts/verify_release_v1.ts`.
- Checklist de preparación para release (`docs/release-readiness-v1.md`).

## Estándar de Error Público
Todas las respuestas de error deben seguir este esquema:
```json
{
  "error": {
    "code": "STRING_IDENTIFIER",
    "message": "Human readable message"
  }
}
```

## Requerimientos Técnicos

### Hardening de APIs e Inputs
- Los endpoints de **onboarding, diagnostics, HA settings y setup-status** deben implementar validación de payloads y sanitización de respuestas.
- El flujo de `onboarding` debe ser **idempotente y consistente**.
- Los mensajes de error deben ser útiles para el operador pero seguros (sin filtrar detalles internos).

### Calidad de Código y Deuda
- Eliminar `any` en módulos críticos (`Auth`, `UserManagement`, `HA`).
- Reemplazar `alert()` residuales en el frontend.
- En `OperatorConsoleServer.ts`, extraer parsing, validación y mapping de errores en handlers complejos. Evitar lógica de negocio en la capa de transporte.
- Eliminar logs de depuración y mensajes "verbose" no aptos para producción.

### Verificación Pragmática
El script `verify_release_v1.ts` debe validar:
- Setup status y flujo de onboarding.
- Path de autenticación e identidad.
- Conectividad y test de configuración de HA.
- Consistencia del snapshot de diagnósticos.
- Operaciones básicas de gestión de usuarios.

## Criterios de "Release Ready"
Se considera la V1 lista para release cuando:
1. Todos los **Core Release Flows** han sido validados exitosamente.
2. No existen **bypass conocidos** en Auth/RBAC.
3. No hay **exposición de secretos** (hashes, tokens) en APIs de diagnóstico o manejo.
4. Se han eliminado todos los `alert()` nativos.
5. El documento `docs/release-readiness-v1.md` ha sido completado.
6. El script `scripts/verify_release_v1.ts` se ejecuta con éxito en el entorno objetivo.

