# Desglose de Tareas: Ejecución de Comandos de Dispositivo
*(Basado en `device-command-execution.md`)*

Este documento define la secuencia estricta de tareas de implementación técnica (Task Breakdown) garantizando la trazabilidad hacia el Spec aprobado, protegiendo las arquitecturas limpias y previniendo regresiones de abstracción.

---

## 🏗️ FASE 1: CAPA DE DOMINIO (Domain Layer)
El aislamiento del diccionario de comportamientos estrictos protegiendo la entidad.

### Tarea 1.1: Diccionario V1 y Validadores Puros
*   **Archivo Sugerido**: `packages/devices/domain/commands.ts`
*   **Objetivo**: Establecer y amurallar los tipos literales permitidos.
*   **Reglas**:
    *   Crear el tipo inmutable: `type DeviceCommandV1 = 'turn_on' | 'turn_off' | 'toggle';`
    *   Implementar una función pura `isValidCommand(cmd: string): cmd is DeviceCommandV1` que actúe como filtro restrictivo (type guard).
*   **Dependencias**: Ninguna.

### Tarea 1.2: Errores Nativos de Dominio
*   **Archivos Sugeridos**: `packages/devices/domain/errors.ts`, `packages/devices/application/errors.ts`
*   **Objetivo**: Trazar identificadores de error arrojables.
*   **Reglas**:
    *   Agregar `InvalidDeviceCommandError` a nivel Dominio para rebotar firmas que no casen con V1 (detonador de HTTP 400).
    *   Agregar `DevicePendingStateError` a nivel Aplicación/Dominio para rechazar peticiones sobre entidades aún en el Inbox (detonador de HTTP 409 Conflict).
*   **Dependencias**: Tarea 1.1

---

## 📡 FASE 2: CAPA DE EVENTOS (Events Layer)
Aislamiento auditable del comportamiento heurístico asíncrono (Side-effects).

### Tarea 2.1: Contratos de Eventos Externos
*   **Archivo Sugerido**: `packages/devices/domain/events/types.ts`
*   **Objetivo**: Agregar a la familia base (`DeviceDomainEvent`) los desenlaces de hardware.
*   **Reglas**:
    *   Definir interfaz `DeviceCommandDispatchedEvent` con `eventType: 'DeviceCommandDispatchedEvent'`, guardando: `deviceId`, `homeId`, `command`.
    *   Definir interfaz `DeviceCommandFailedEvent` con `eventType: 'DeviceCommandFailedEvent'`, guardando: `deviceId`, `homeId`, `command`, `reason`.
*   **Dependencias**: Tarea 1.1

### Tarea 2.2: Generadores Puros (Factories)
*   **Archivo Sugerido**: `packages/devices/domain/events/factories.ts`
*   **Objetivo**: Emitir instancias estáticas sin reventar relojes locales.
*   **Reglas**:
    *   Implementar `createDeviceCommandDispatchedEvent` y `createDeviceCommandFailedEvent`.
    *   Inyectar `Dependencies { idGenerator, clock }` obligatoriamente garantizando determinismo.
    *   El campo origen (`source`) debe seguir siendo `domain:devices:edge`.
*   **Dependencias**: Tarea 2.1

---

## 🔌 FASE 3: PUERTOS E INFRAESTRUCTURA (Ports & Infra Layer)
La delegatura al IoT Abstracto.

### Tarea 3.1: Puerto Abstracto Transaccional
*   **Archivo Sugerido**: `packages/devices/application/ports/DeviceCommandDispatcherPort.ts`
*   **Objetivo**: Cimentar la interfaz de inyección Hexagonal (Anti-Corruption Layer).
*   **Reglas**:
    *   Definir `export interface DeviceCommandDispatcherPort`.
    *   Debe contener el método síncrono: `dispatch(deviceId: string, command: DeviceCommandV1): Promise<void>`.
*   **Dependencias**: Tarea 1.1

### Tarea 3.2: Adaptador Mock en Memoria
*   **Archivo Sugerido**: `packages/devices/infrastructure/adapters/InMemoryDeviceCommandDispatcher.ts`
*   **Objetivo**: Emular el hardware externo para los Test Suites.
*   **Reglas**:
    *   Implementar una clase nativa cumpliendo con `DeviceCommandDispatcherPort`.
    *   Soportar una bandera inyectable o función simulada que permita forzar rechazos, emulando la caída sincrónica (Bad Gateway local).
*   **Dependencias**: Tarea 3.1

---

## ⚙️ FASE 4: CAPA DE APLICACIÓN (Application Layer)
Orquestación Síncrona y Zero-Trust.

### Tarea 4.1: Errores Perimetrales
*   **Archivo Sugerido**: `packages/devices/application/errors.ts`
*   **Objetivo**: Exponer las fallas transitorias de red.
*   **Reglas**:
    *   Crear la excepción `DispatchIntegrationError` para aislar cuando el `DeviceCommandDispatcherPort` levante fuego interno (detonador de HTTP 502).

### Tarea 4.2: Caso de Uso Core (`executeDeviceCommandUseCase`)
*   **Archivo Sugerido**: `packages/devices/application/executeDeviceCommandUseCase.ts`
*   **Objetivo**: Coordinar la transaccionalidad sin mutaciones.
*   **Reglas del Flujo Funcional Obligatorio**:
    1.  Extraer el device vía `DeviceRepository`. Si no existe -> throw `DeviceNotFoundError`.
    2.  Aplicar control *Zero-Trust*: Invocar a `TopologyReferencePort.validateHomeOwnership(device.homeId, userId)`.
    3.  Filtro Inbox: Si `device.status === 'PENDING'`, bloquear inmediatamente haciendo un throw de `DevicePendingStateError`.
    4.  Auditoría V1: Validar `command` contra el proxy estricto de la V1. De fallar -> throw `InvalidDeviceCommandError`.
    5.  Resolución (Happy Path): Tramitar bloqueo síncrono atómico `await dispatcherPort.dispatch(...)`. Tras éxito, generar `DeviceCommandDispatchedEvent` en el Publisher.
    6.  Defensa Resiliente (Sad Path): Interceptar asíncronamente (try/catch del dispatcher). Tras el catch emitir residualmente mediante Event Publisher el `DeviceCommandFailedEvent` e interrumpir el hilo devolviendo el `DispatchIntegrationError` (No reintentar).
*   **Dependencias**: Tareas 3.1, 4.1, 1.2.

---

## 🌐 FASE 5: CAPA DE API REST (Transport Layer)
Mapeo puro agnóstico y semántica.

### Tarea 5.1: Mapeo de Excepciones Extendido
*   **Archivo Sugerido**: `packages/devices/api/core/errorHandler.ts`
*   **Objetivo**: Enlazar los nuevos errores generados al dialecto REST.
*   **Reglas**:
    *   Mapear `DevicePendingStateError` devolviendo estatús `409 Conflict`.
    *   Mapear `InvalidDeviceCommandError` reciclando el bloque base devolviendo `400 Bad Request`.
    *   Mapear `DispatchIntegrationError` inyectando un atrapamiento resolviendo en `502 Bad Gateway`.

### Tarea 5.2: Ingestion Controller
*   **Archivo Sugerido**: `packages/devices/api/controllers/CommandController.ts`
*   **Objetivo**: Levantar el puerto lateral expuesto de HTTP.
*   **Reglas**:
    *   Crear la clase con la firma `async executeCommand(req: AuthenticatedHttpRequest)`.
    *   Recuperar `deviceId` (de params), `command` (del body) y `userId` del proxy Zero-Trust interceptado.
    *   Invocar `executeDeviceCommandUseCase`. Si fue libre de fallos locales asimétricos, resolver explícitamente y con certeza en `202 Accepted` (Fire and Forget Transaccional).
*   **Dependencias**: Tarea 4.2 y Tarea 5.1

---

## 🧪 FASE 6: ECOSISTEMA DE PRUEBAS (Testing Layer)
Certeza del Spec bajo estrictos Criterios de Aceptación (AC1-AC5).

### Tarea 6.1: Unit Tests
*   **Archivos Sugeridos**: `__tests__/domain.test.ts`, `__tests__/application.test.ts`, `__tests__/api.test.ts`
*   **Objetivo**: Comprobar el Aislamiento Restrictivo Unitariamente.
*   **Reglas**:
    *   Testear el type guard limitante de *V1*.
    *   Acreditar intercepción de `PENDING` states aislando mutaciones indeseables.
    *   Cotejar el mapper nativo reconfirmando 202, 400, 403, 404, 409 y 502.

### Tarea 6.2: Acceptance Criteria Test Suite (Full Slice)
*   **Archivo Sugerido**: `__tests__/e2e.test.ts`
*   **Objetivo**: Orquestar de punta a punta replicando el ambiente transaccional exterior.
*   **Reglas de Confirmación Obligatorias**:
    *   **AC1**: Generar 403 arrojando `turn_on` tras denegatoria de Topología inyectada.
    *   **AC2**: Generar 409 al enviar cualquier payload funcional sobre entidad mockeada en Inboxing (`PENDING`).
    *   **AC3**: Ejecutar y asegurar HTTP 400 Bad Request tras dictar verbos como `"set_color"` rebotando el type guard.
    *   **AC4**: Ejecutar flujo central asertando un `202 Accepted` de confirmación garantizando emisión pasiva de `DeviceCommandDispatchedEvent`.
    *   **AC5**: Orquestar un colapso en la promesa Mock de `DeviceCommandDispatcherPort`, interceptar flujo garantizando absorción controlada rebotando en un 502 explícito pero firmando exitosamente el correlato transaccional pasivo `DeviceCommandFailedEvent`. No se debe registrar colapso en la App local.
