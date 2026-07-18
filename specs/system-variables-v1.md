# SPEC: System Variables V1

**Estado:** Implementado  
**Autor:** HomePilot Engineering  
**Fecha:** 2026-07-17  
**Código trazado:** `apps/api/routes/SystemVariableRoutes.ts`, `packages/system-vars`, `apps/operator-console/src/views/`

## 1. Declaración del Problema

HomePilot requiere variables persistentes globales o por hogar para configurar comportamientos locales sin introducir valores hardcodeados en interfaz, automatizaciones o runtime.

## 2. Alcance

- Crear, consultar, actualizar y eliminar variables persistentes.
- Asociarlas opcionalmente a un hogar y mantener su tipo explícito.
- Aplicar autorización administrativa a los cambios de configuración.
- Exponer contratos estables para automatizaciones y runtime.

## 3. Fuera de Alcance

- Secretos de integración; se gestionan por configuración segura.
- Variables Cloud compartidas entre instalaciones.

## 4. Requisitos Funcionales

- **REQ-01:** Cada variable tiene clave única dentro de su ámbito, tipo y valor validado.
- **REQ-02:** Un usuario sin permiso administrativo no puede modificar variables.
- **REQ-03:** Las operaciones dejan registro de auditoría.
- **REQ-04:** El consumidor debe recibir un error explícito para una clave o tipo inválido.

## 5. Requisitos No Funcionales

- **NFR-01:** Los valores se guardan en SQLite local mediante el contexto `system-vars`.
- **NFR-02:** Las rutas viven en `SystemVariableRoutes` y no en `ApiGateway`.
- **NFR-03:** Las variables no deben usarse como mecanismo para persistir credenciales.

## 6. Criterios de Aceptación

- [x] AC1: Una clave válida puede persistirse y recuperarse después de reiniciar API.
- [x] AC2: Dos hogares pueden usar la misma clave sin colisión de ámbito.
- [x] AC3: Un cambio no autorizado retorna error de permisos y no modifica valor.
- [x] AC4: Los valores inválidos no se persisten.

## 7. Notas Técnicas y Arquitectura

- API: `/api/v1/system-variables/*` a través de `SystemVariableRoutes`.
- La validación y persistencia pertenecen a `packages/system-vars`; la consola es consumidora.

## 8. Preguntas Abiertas y TODOs

- TODO: Catálogo declarativo de claves reservadas y sus esquemas de valor.
