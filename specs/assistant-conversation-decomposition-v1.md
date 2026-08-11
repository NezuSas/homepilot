# SPEC: Assistant Conversation Decomposition V1

**Estado:** Implementado
**Autor:** HomePilot Engineering
**Fecha:** 2026-08-11

## Problema

`AssistantConversationService` concentra administración de aliases junto con la orquestación conversacional y ejecución de comandos. Esto mezcla responsabilidades y dificulta pruebas aisladas.

## Requisitos

- **REQ-01:** La gestión completa de aliases debe residir en un colaborador dedicado con dependencias explícitas.
- **REQ-02:** El orquestador conserva el contrato `AssistantConversationResponse` y delega las decisiones de aliases.
- **REQ-03:** La construcción de producción inyecta el colaborador desde el composition root.

## Criterios de aceptación

- [x] AC1: Creación, listado, significado y eliminación confirmada de aliases se delegan a `AssistantAliasManagementService`.
- [x] AC2: `AssistantConversationService` no conserva métodos privados de gestión de aliases.
- [x] AC3: Las suites existentes del asistente, typecheck, build y runtime Docker pasan sin cambios de comportamiento.