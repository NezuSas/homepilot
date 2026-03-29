# Plan de Implementación Técnica (Task Breakdown)
**Spec:** "Descubrimiento de dispositivos y bandeja de dispositivos (Device Discovery & Device Inbox)"

Este documento desglosa el trabajo en tareas atómicas diseñadas para flujos de Pull Requests (PRs) independientes. Respeta completamente la Inversión de Dependencias (SDD) y el diseño *Edge-First* del proyecto.

> **Nota de Arquitectura:** Asumimos que las entidades residirán en un Bounded Context propio (ej. `packages/devices/`) independiente del directorio actual de `topology`, pero respetando 1:1 su estructura y dependencias de directorio interno limpio.

---

## Fase 1: Capa de Dominio (Domain)
Diseño del corazón de la regla de negocio, aislado de frameworks.

- **[ ] Tarea 1.1: Definir los Tipos de Entidad (Types)**
  - **Acción:** Crear interfaz inmutable `Device` con UUID, timestamps, `status` (PENDING, ASSIGNED) y `externalId`.
  - **Archivos:** `domain/types.ts`.
- **[ ] Tarea 1.2: Modelar Errores del Dominio (Errors)**
  - **Acción:** Crear clases de error explícitas como `InvalidDeviceExternalIdError`, `InvalidTopologyReferenceError` (si falta homeId), y el crucial `DeviceAlreadyAssignedError` para proteger transiciones accidentales de estado.
  - **Archivos:** `domain/errors.ts`.
- **[ ] Tarea 1.3: Factoría de Descubrimiento (Discover)**
  - **Acción:** Función pura `createDiscoveredDevice(payload, deps)`. Recibe dependencias externas `IdGenerator/Clock`. Retorna la entidad inherentemente en estado `PENDING` y con `roomId: null`.
  - **Archivos:** `domain/createDiscoveredDevice.ts`.
- **[ ] Tarea 1.4: Mutador de Estado de Asignación (Assign)**
  - **Acción:** Función pura `assignDeviceToRoom(device, roomId, clock)` que aplique el patrón *shallow copy + Object.freeze* alterando el status a `ASSIGNED` y adscribiendo el identificador de la habitación.
  - **Archivos:** `domain/assignDeviceToRoom.ts`.
- **[ ] Tarea 1.5: Enrutamiento del Módulo (Index)**
  - **Acción:** Exportar las funciones de módulo limpio.
  - **Archivos:** `domain/index.ts`.

---

## Fase 2: Capa de Eventos (Domain Events)
Asentamiento del contrato de comunicación asíncrona (*Write-Then-Publish*).

- **[ ] Tarea 2.1: Definición Lógica de Relés (Contracts)**
  - **Acción:** Declarar genéricamente `DeviceDiscoveredEvent` y `DeviceAssignedToRoomEvent` junto a sus respectivos Types / Payloads (con campos nativos de hardware / migración pendiente).
  - **Archivos:** `domain/events/types.ts`.
- **[ ] Tarea 2.2: Factorías Deterministas de Eventos (Event Factories)**
  - **Acción:** Crear funciones generadoras puras inyectando el `correlationId`, `eventId` y `timestamp`.
  - **Archivos:** `domain/events/factories.ts`.
- **[ ] Tarea 2.3: Puertos de Salida & Adaptadores de Regresión (Publishers)**
  - **Acción:** Establecer la Interfaz `DeviceEventPublisher` y fabricar la versión `InMemoryDeviceEventPublisher` aislando colisiones entre módulos topológicos.
  - **Archivos:** `domain/events/DeviceEventPublisher.ts`, `domain/events/InMemoryDeviceEventPublisher.ts`, `domain/events/index.ts`.

---

## Fase 3: Capa de Persistencia (Infrastructure)
Separación temporal sin comprometer BD real de Cloud/Gateway.

- **[ ] Tarea 3.1: Puerto Abstracto de DB (Port)**
  - **Acción:** Especificar `DeviceRepository` con rutinas: `saveDevice`, `findDeviceById`, `findInboxByHomeId` (retorna Devices cuyo roomId es nulo), y `findByExternalIdAndHomeId`.
  - **Archivos:** `domain/repositories/DeviceRepository.ts`.
- **[ ] Tarea 3.2: Adaptador Temporal en Memoria (Adapter)**
  - **Acción:** Crear la clase `InMemoryDeviceRepository` inyectable por el contendor implementando Map estático interno.
  - **Archivos:** `infrastructure/repositories/InMemoryDeviceRepository.ts` & `index.ts`.

---

## Fase 4: Capa de Aplicación (Use Cases)
Intercepción contextual (Zero-Trust) y orquestación de lógicas complejas sobre los Puertos.

- **[ ] Tarea 4.1: Interfaz de Proxy Perimetral (`TopologyService` Port)**
  - **Acción:** Establecer un Dependency Port en la aplicación de Devices que provea funciones explícitas de validación cruzada con Topología (ej. buscar el Home y validar el userId originario, buscar un Room verificando su parent).
  - **Archivos:** `application/ports/TopologyReferencePort.ts`.
- **[ ] Tarea 4.2: Excepciones de Caso de Uso (Errors)**
  - **Acción:** Establecer los manejos transaccionales directos: `DeviceNotFoundError`, `ForbiddenOwnershipError` y `DeviceConflictError`.
  - **Archivos:** `application/errors.ts`.
- **[ ] Tarea 4.3: Discovery Use Case (Ingreso)**
  - **Acción:** Crear la ingesta interna `discoverDeviceUseCase`. Orquesta `findByExternalIdAndHomeId`. Si el dispositivo ya existe en ese hogar: lanza explícitamente `DeviceConflictError` abortando el flujo (resolviendo en HTTP 409 Conflict puro). Si es nuevo: Fábrica Device PENDING -> Guarda -> Emite Evento Discovery -> Retorna la entidad limpia (resolviendo en HTTP 201 Created).
  - **Archivos:** `application/discoverDeviceUseCase.ts`.
- **[ ] Tarea 4.4: List Inbox Use Case (Agregador Restrictivo)**
  - **Acción:** Crea `listPendingInboxUseCase`. Aplica validación cruzada explícita consultando el `TopologyReferencePort`: Valida formalmente que el `homeId` proveído exista y que su `ownerId` coincida exactamente con el `userId` de la petición. De fallar la validación perimetral topológica, aborta el listado lanzando inmediatamente `NotFoundError` o `ForbiddenOwnershipError` respectivamente. Sólo si es válido y seguro, consulta al `DeviceRepository` recuperando los Devices de dicho hogar con estado PENDING.
  - **Archivos:** `application/listPendingInboxUseCase.ts`.
- **[ ] Tarea 4.5: Assignment Use Case (Migración Estricta Topológica)**
  - **Acción:** Crear `assignDeviceUseCase`. Resuelve extrayendo el device por ID para determinar su `homeId` nativo original. Valida estrictamente a través del puerto de topología que el `roomId` de destino pertenezca lógicamente a ese EXACTO mismo `homeId`, y adicionalmente que el usuario emisor sea el dueño. Aborta firmemente cualquier intento de cruzar/asignar dispositivos originados en un Home 'A' hacia un Habitación contenida en un Home 'B', independientemente de que ambos Hogares pertenezcan al mismo usuario. Muta el estado a `ASSIGNED`, asocia permanentemente en Repositorio y transfiere asíncronamente el `DeviceAssignedToRoomEvent`.
  - **Archivos:** `application/assignDeviceUseCase.ts`.

---

## Fase 5: Capa Perimetral HTTP (API REST)
Filtros finales a Internet asíncronos y mapeo estandarizado de estado HTTP al cliente.

- **[ ] Tarea 5.1: Mapeador de Excepciones Extendidas (Exception Handler)**
  - **Acción:** Mapear explícitamente `DeviceConflictError` (Capturado desde la fase 4.3) al estatus nativo HTTP `409 Conflict`. Mantener la traducción idéntica de 404s/403s existente y genérica.
  - **Archivos:** `api/core/errorHandler.ts` o equivalente en el namespace de Devices.
- **[ ] Tarea 5.2: Discovery Ingest Controller**
  - **Acción:** Levantar manejador `POST /integrations/discovery` inyectado. Controla que un Device nuevo responda `201` y que el intento duplicado responda explícitamente `409`.
  - **Archivos:** `api/controllers/IntegrationsController.ts`.
- **[ ] Tarea 5.3: Inbox Manager Controller**
  - **Acción:** Levantar `GET /homes/:homeId/inbox` utilizando identity validation perimétrica (`AuthenticatedHttpRequest`). Responde `200` entregando tranquilamente la matriz purificada por la capa Applicativa o permitiendo escalar el 403.
  - **Archivos:** `api/controllers/InboxController.ts`.
- **[ ] Tarea 5.4: Action Device Controller**
  - **Acción:** Levantar `POST /devices/:deviceId/assign` aislando la sintaxis `roomId` mediante verificaciones estrictas HTTP 400 antes de delegar los tokens verificados al Use Case final. Reacciona `200 OK` finalizado el ciclo atómico de asimilación.
  - **Archivos:** `api/controllers/DeviceController.ts`.

---

## Fase 6: Pruebas Globales (Testing Layer)
Aseguramiento del Slice (TDD Asimétrico Final).

- **[ ] Tarea 6.1: Unit Test - Domain**
  - **Objetivo:** Exigir validaciones sobre Strings nulos, asegurar variables Status de salida por defecto (PENDING).
  - **Archivos:** `__tests__/domain.test.ts`.
- **[ ] Tarea 6.2: Unit Test - Application y Ports**
  - **Objetivo:** Demostrar de forma determinista mediante mocks puros en `TopologyReferencePort` que un actor o integrador es repelido. Probar exhaustivamente que la migración cruzada de dispositivos prohibida entre Homes del mismo dueño rebota limpiamente validando el Parent Node original. Probar bifurcación de descubrimiento arrojando explícitamente 409 Conflict.
  - **Archivos:** `__tests__/application.test.ts`.
- **[ ] Tarea 6.3: E2E Spec AC1-AC5 Verification**
  - **Objetivo:** Trazar uno a uno de forma determinista (sin Randoms ni Fechas volátiles) exactamente los 5 Acceptance Criterias vigentes del document spec (AC1 al AC5): Creación de Descubrimiento (201), Lectura Exclusiva (200), Aserciones autorizatorias de Tenantes Ajenos (403), Cruces Nulos Inexistentes (404), mitigando la interferencia.
  - **Archivos:** `__tests__/e2e/device-inbox.e2e.test.ts`.
