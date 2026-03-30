# SPEC: Motor de reglas de automatización V1 (Automation Rules Engine V1)

**Estado:** Borrador  
**Autor:** Antigravity (IA Architect)  
**Fecha:** 2026-03-29  

## 1. Declaración del Problema (Problem Statement)
HomePilot permite actualmente el control manual de dispositivos y la visualización de su estado. Sin embargo, para convertirse en un sistema de hogar inteligente real, necesita la capacidad de reaccionar de forma autónoma ante eventos del entorno sin intervención humana. El "Motor de Reglas V1" busca proveer una capa de automatización básica pero robusta, permitiendo encadenar el estado de un dispositivo (disparador) con la ejecución de un comando en otro (acción), manteniendo los principios de Zero-Trust y seguridad ya establecidos.

## 2. Alcance (Scope)
*   **Modelo de Regla de Automatización**: Definir la entidad `AutomationRule` que vincula una condición sobre un dispositivo con una acción sobre otro.
*   **Disparadores Basados en Estado**: Evaluación desacoplada basada en la observación de cambios de estado efectivos.
*   **Acciones de Comando**: Ejecutar comandos (`turn_on`, `turn_off`, `toggle`) de forma automática, pasando por todas las validaciones de ownership y capacidades.
*   **Gestión de Reglas (CRUD)**: Endpoints para crear, listar y eliminar reglas por hogar.
*   **Evaluación Determinista**: La evaluación ocurre como respuesta a un cambio de estado efectivo y confirmado en el sistema.

## 3. Fuera de Alcance (Out of Scope)
*   **Lógica Compleja**: No se soportan operadores AND/OR, reglas anidadas o múltiples condiciones.
*   **Programación Horaria (Cron/Schedules)**: Las reglas basadas en tiempo quedan para una versión posterior.
*   **Múltiples Acciones**: Una regla solo dispara una acción en un solo dispositivo objetivo.
*   **IA/Aprendizaje**: No hay sugerencias proactivas ni análisis de hábitos.
*   **Scripting**: No se permite código arbitrario (ej. JavaScript) dentro de las reglas.
*   **Escenas**: La agrupación de múltiples dispositivos en un solo "comando de escena" no forma parte de esta V1.

## 4. Requisitos Funcionales (Functional Requirements)

### Gestión de Reglas
*   **REQ-01: Creación de Regla**: Un usuario dueño de un hogar puede crear una regla definiendo un nombre, un disparador (`trigger`) y una acción (`action`). El trigger debe incluir `deviceId`, `stateKey` y `expectedValue`.
*   **REQ-02: Validación de Existencia**: No se puede crear una regla si los dispositivos involucrados no existen o no pertenecen al mismo hogar.
*   **REQ-03: Listado por Hogar**: El usuario puede ver todas las reglas configuradas para un hogar específico.
*   **REQ-04: Eliminación**: El usuario puede revocar una automatización eliminando la regla. Se debe validar ownership antes del borrado.

### Ejecución y Evaluación
*   **REQ-05: Estrategia de Evaluación Desacoplada**: El sistema DEBE evaluar las reglas como un suscriptor (EventHandler) del evento `DeviceStateUpdatedEvent`. La evaluación no ocurre inline dentro del caso de uso de sincronización para no penalizar la latencia de ingesta M2M.
*   **REQ-06: Verificación de Condición**: La regla solo se ejecuta si el nuevo estado del dispositivo disparador coincide exactamente con el `expectedValue` para la `stateKey` configurada.
*   **REQ-07: Ejecución Segura de Acción**: Al dispararse la regla, el sistema invoca el caso de uso `executeDeviceCommand`. Esto garantiza que se apliquen todas las capas de seguridad:
    *   Verificación de Ownership (vía `TopologyReferencePort`).
    *   Verificación de estado `ASSIGNED` del dispositivo objetivo.
    *   Verificación de compatibilidad de hardware (Capabilities).
*   **REQ-08: Identidad de Ejecución**: Las acciones automáticas se ejecutan utilizando la identidad (User ID) del dueño original que configuró la regla, asegurando la consistencia del modelo de seguridad.
*   **REQ-09: Trazabilidad (Audit Log)**: La ejecución automática de una regla debe registrarse en el `ActivityLog` del dispositivo objetivo:
    *   Si es **exitosa**: Tipo `COMMAND_DISPATCHED`, descripción indicando obligatoriamente el prefijo "Triggered by Automation: [Rule Name]".
    *   Si es **fallida**: Tipo `AUTOMATION_FAILED`, descripción con el motivo del fallo (ej. "Incompatible hardware").

## 5. Requisitos No Funcionales (Non-Functional Requirements)
*   **NFR-01: Local-First Execution**: La evaluación y ejecución de reglas ocurre íntegramente en el Edge, sin dependencia de Cloud.
*   **NFR-02: Prevención de Bucles Infinitos (Básico)**: El sistema debe rechazar la creación de una regla donde `trigger.deviceId == action.targetDeviceId` si el comando de acción altera la misma propiedad (`stateKey`) que el disparador.
*   **NFR-03: Latencia de Reacción**: El sistema debe disparar la acción en menos de 200ms (p95) tras la persistencia del estado disparador en condiciones de carga normales.
*   **NFR-04: Persistencia de Reglas**: Las reglas deben persistir en un repositorio dedicado (`AutomationRuleRepository`).

## 6. Semántica HTTP

### Rules Management
`POST /homes/:homeId/rules`
*   **Payload**: 
    ```json
    {
      "name": "Luz pasillo al abrir puerta",
      "trigger": { 
        "deviceId": "sensor-puerta", 
        "stateKey": "contact", 
        "expectedValue": "open" 
      },
      "action": { 
        "deviceId": "luz-pasillo", 
        "command": "turn_on" 
      }
    }
    ```
*   **Respuestas**: `201 Created`, `400 Bad Request`, `403 Forbidden` (no es dueño del hogar).

`GET /homes/:homeId/rules`
*   **Respuestas**: `200 OK` (lista de reglas), `403 Forbidden`.

`DELETE /rules/:ruleId`
*   **Respuestas**: `204 No Content`, `403 Forbidden` (si el usuario no es dueño del hogar asociado a la regla), `404 Not Found`.

## 7. Eventos de Dominio Relevantes
*   **V1 Simplificada**: No se definen eventos de dominio específicos para el motor de reglas en V1. El sistema se apoya en los eventos existentes (`DeviceStateUpdatedEvent`, `DeviceCommandDispatchedEvent`) y en el `ActivityLog` para la trazabilidad.

## 8. Modelo Conceptual de Datos

### AutomationRule
*   `id`: `string`
*   `homeId`: `string`
*   `userId`: `string` (ID del creador para validación de ejecución)
*   `name`: `string`
*   `enabled`: `boolean`
*   `trigger`: 
    *   `deviceId`: `string`
    *   `stateKey`: `string`
    *   `expectedValue`: `string | number | boolean`
*   `action`:
    *   `targetDeviceId`: `string`
    *   `command`: `turn_on | turn_off | toggle`

## 9. Criterios de Aceptación (Acceptance Criteria)
*   **AC1: Creación Válida**: Dado un hogar con un sensor y una lámpara, cuando el dueño crea una regla con el payload unificado, esta se persiste y se retorna 201.
*   **AC2: Ejecución por Estado**: Dado un dispositivo con una regla, cuando se emite `DeviceStateUpdatedEvent`, el motor evalúa la condición y dispara el comando en el dispositivo objetivo si coincide.
*   **AC3: Gestión de Fallos de Acción**: Si una regla intenta ejecutar un comando no soportado, el sistema debe registrar un registro de tipo `AUTOMATION_FAILED` en el `ActivityLog` del dispositivo objetivo.
*   **AC4: Protección Zero-Trust**: Un usuario intenta borrar o crear una regla en un hogar que no le pertenece y recibe un `403 Forbidden`.
*   **AC5: Prevención de Auto-Bucle**: El sistema rechaza la creación de una regla que use el mismo dispositivo para trigger y action sobre la misma clave de estado.

## 10. Notas Técnicas y Arquitectura
*   **Suscriptor de Eventos**: El componente `AutomationEngine` escucha `DeviceStateUpdatedEvent`.
*   **Contexto de Seguridad**: La ejecución de la regla debe recuperar el `userId` guardado en la regla para invocar el caso de uso de ejecución de comandos.
*   **Inmutabilidad**: Las condiciones de disparador en V1 son estrictamente de igualdad (`==`).

## 11. Preguntas Abiertas / TODOs
*   ¿Cómo manejamos la invalidez de reglas cuando un dispositivo es eliminado del hogar?
*   ¿Debería el sistema pausar automáticamente una regla tras X fallos consecutivos de ejecución?
