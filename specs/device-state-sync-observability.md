# Especificación: Sincronización de Estado de Dispositivos y Observabilidad Básica
*(Device State Synchronization & Basic Observability)*

---

## 1. Problema
HomePilot ya es capaz de descubrir dispositivos y enviar comandos unidireccionales (`turn_on`, `turn_off`, `toggle`). Sin embargo, el sistema "anda a ciegas" respecto al estado real y actual de los dispositivos en el hogar. No existe un mecanismo para que los dispositivos (o sus gateways) reporten cambios de estado de forma proactiva, ni para que el usuario consulte el estado almacenado o vea una traza de actividad reciente. Esto impide tanto una experiencia de usuario fluida en la UI como la futura toma de decisiones por parte de motores de automatización o IA.

## 2. Alcance
*   **Ingesta de Estado (M2M)**: Permitir que capas de integración externas (Edge Gateways) notifiquen cambios en el estado de un dispositivo.
*   **Snapshot Persistente**: Almacenar la "fotografía" más reciente del estado dentro de la entidad `Device`.
*   **Consulta de Estado Actual**: Proveer un endpoint para que la UI/App consulte el estado conocido de un dispositivo específico.
*   **Historial de Actividad (Observabilidad)**: Mantener un registro efímero de los últimos eventos (cambios de estado y comandos enviados) para propósitos de debugging y visualización.
*   **Seguridad Zero-Trust**: Validar propiedad del hogar en todas las consultas de lectura desde la API de usuario.

## 3. Fuera de Alcance
*   Automatizaciones (vatios, temperatura, etc.).
*   IA (análisis predictivo o detección de anomalías).
*   Telemetría de alto volumen (no diseñado para tráfico intensivo tipo graficador de tiempo real).
*   Alertas y Notificaciones Push ante cambios de estado.
*   Modelado profundo por tipo de dispositivo en V1.

## 4. Requisitos Funcionales (FR)

### Ingesta y Persistencia
*   **FR-01: Ingesta de Estado M2M**: El sistema debe exponer un canal donde el integrador reporte un `state_update`. Solo se permite para dispositivos ya registrados o en `PENDING`.
*   **FR-02: Actualización de la Entidad Device**: El campo `lastKnownState` pasará a vivir dentro de la entidad `Device`. Una actualización de estado implica:
    *   Actualizar `lastKnownState`.
    *   Incrementar `entityVersion`.
    *   Actualizar `updatedAt`.
*   **FR-03: Atomicidad del Snapshot**: La persistencia del nuevo estado debe ser una operación atómica. Si falla la escritura en base de datos, no se deben emitir eventos ni generar registros de actividad.
*   **FR-04: Idempotencia de Ingesta**: Si el estado reportado (`JSON`) es estructuralmente idéntico al actual, el sistema debe responder con `200 OK` pero **no debe realizar ninguna acción secundaria** (no incremente versión, no emite eventos, no guarda en historial).

### Observabilidad
*   **FR-05: Consulta de Estado con Propiedad**: Un usuario solo puede consultar el estado de un dispositivo si `TopologyReferencePort` confirma que es dueño del `homeId` correspondiente.
*   **FR-06: Log de Actividad Unificado**: El sistema mantendrá un historial cronológico que incluya:
    *   **Cambios de estado exitosos** (registrados tras persistencia).
    *   **Comandos enviados** (registrados tras el envío exitoso al dispatcher).
    *   **Fallos de comando** (registrados desde el `DeviceCommandFailedEvent`).
*   **FR-07: Soporte para Dispositivos PENDING**: Se permite recibir y consultar el estado de dispositivos en el Inbox (`PENDING`).

## 5. Requisitos No Funcionales (NFR)
*   **NFR-01: Persistencia Efímera del Log**: El historial de actividad se modela como una persistencia derivada (read-model o tabla de auditoría). En V1 puede ser volátil o manejarse mediante un repositorio simple en memoria compartida.
*   **NFR-02: Ordenación Cronológica**: La respuesta del historial debe devolver los eventos de más reciente a más antiguo (LIFO).
*   **NFR-03: Latencia en Lectura**: La consulta de estado debe ser inmediata (O(1)) resolviendo directamente desde el registro del dispositivo.

## 6. Semántica HTTP

### Ingesta (M2M / Interna)
`POST /integrations/state-sync`
*   **Payload**: `{ "deviceId": "...", "state": { "status": "on" } }`
*   **Respuestas**:
    *   `200 OK`: Estado procesado (o ignorado por ser idéntico al actual).
    *   `404 Not Found`: Si el `deviceId` no existe.
*   **Política de Idempotencia**: Si el estado es igual al almacenado, retorna `200 OK` inmediatamente sin efectos colaterales.

### Observabilidad (Usuario Autenticado)
`GET /devices/:deviceId/state`
*   **Respuestas**:
    *   `200 OK` + JSON con `lastKnownState`.
    *   `403 Forbidden`: El dispositivo no pertenece al `homeId` del usuario.
    *   `404 Not Found`: El dispositivo no existe.

`GET /devices/:deviceId/history`
*   **Respuestas**:
    *   `200 OK` + Lista de registros de actividad.
    *   `403 Forbidden`: No pertenece al usuario.
    *   `404 Not Found`: El dispositivo no existe.

## 7. Eventos de Dominio Relevantes
*   **DeviceStateUpdatedEvent**: Emitido únicamente cuando el valor de `lastKnownState` ha cambiado efectivamente en la persistencia.
*   **DeviceActivityLoggedEvent**: (Interno/Opcional en V1) Utilizado para gatillar la inserción en el historial de observabilidad. El historial es una **persistencia derivada** de los eventos del sistema.

## 8. Modelo Conceptual de Datos
*   **Device (Extensión)**:
    *   `lastKnownState`: `Record<string, unknown> | null`.
*   **ActivityRecord**:
    *   `timestamp`: `string`.
    *   `deviceId`: `string`.
    *   `type`: `STATE_CHANGED | COMMAND_DISPATCHED | COMMAND_FAILED`.
    *   `description`: `string`.
    *   `data`: `Record<string, unknown>`.

## 9. Criterios de Aceptación (AC)
*   **AC1: Ingesta Exitosa**: Dado un dispositivo, cuando recibe un estado diferente al actual, el dispositivo incrementa su `entityVersion`, actualiza `updatedAt` y emite un `DeviceStateUpdatedEvent`.
*   **AC2: Deduplicación Silenciosa**: Si el estado entrante es igual al actual, la API retorna `200 OK`, pero la base de datos no se toca y el historial de actividad no crece.
*   **AC3: Seguridad Zero-Trust**: Un usuario autenticado intenta leer el `/state` de un dispositivo de otro hogar y recibe un `403 Forbidden`.
*   **AC4: Historial Combinado**: El `/history` debe mostrar tanto el reporte de estado enviado desde el gateway como los comandos previos enviados desde la UI, ordenados por fecha.
*   **AC5: Visibilidad en Inbox**: Un dispositivo en el Inbox (`PENDING`) muestra su estado actual correctamente al dueño del hogar asignado.

## 10. Notas Técnicas y Arquitectura
*   **Atomicidad**: La actualización del estado en la entidad `Device` debe realizarse mediante el repositorio existente, asegurando que `entityVersion` y `updatedAt` se gestionen en la misma transacción o comando de guardado.
*   **Persistencia del Log**: El log de actividad actua como un "sink" de eventos. En V1, el caso de uso de sincronización de estado y el de ejecución de comandos pueden llamar al repositorio de actividad (o emitir un evento que este escuche) para registrar la traza.
*   **Formato de Estado**: Se asume un objeto plano de un nivel en V1 para simplificar las comparaciones por igualdad profunda en la deduplicación.

## 11. Preguntas Abiertas / TODOs
*   ¿Qué ventana de tiempo o cantidad de registros máxima queremos en el historial de V1 (ej. últimos 50 eventos)?
*   ¿El integrador M2M requiere autenticación de API Key específica en este slice o se asume canal seguro perimetral?
