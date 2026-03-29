# Spec: Descubrimiento de Dispositivos y Bandeja (Device Discovery & Device Inbox)

## 1. Problema
Una vez que el usuario ha configurado su topología física (Hogares y Habitaciones), el ecosistema debe integrar dispositivos físicos provenientes de redes locales, puentes o plataformas externas (Hubs, MQTT, Zigbee, etc.). Sin embargo, un dispositivo recién descubierto no posee un contexto lógico inmediato dentro de la vivienda (desconoce en qué habitación se encuentra). Se requiere un paso de transición donde los dispositivos "huérfanos" aguarden en una bandeja temporal (Inbox) hasta que el usuario decida lógicamente a qué habitación (Room) pertenecen, garantizando que el modelo topológico se mantenga estricto y sin contaminación.

## 2. Alcance
Este documento especifica:
- La recepción pasiva de dispositivos físicos descubiertos por la capa de integración de Edge.
- El almacenamiento transicional de los dispositivos en un estado inactivo o "Pendiente de Asignación" (*Device Inbox*).
- La lectura (listado) de dicha bandeja de entrada, estrictamente clasificada por el ownership del tenant.
- La asignación inicial (*Claim/Assign*) de un dispositivo desde la bandeja de entrada hacia una Habitación (`roomId`) existente rigurosamente validada.

## 3. Fuera de Alcance
- Control, actuación o lectura de estado telemétrico continuo de los dispositivos (ej. Encender/Apagar).
- Definición de los protocolos iterativos de comunicación (Zigbee, Matter, MQTT). El spec asume que una capa orquestadora ya provee el *payload REST* normalizado.
- Automatizaciones, scripts o rutinas de inteligencia artificial asociadas al dispositivo.
- Sincronización explícita a la capa Cloud.
- Modificación compleja o edición de metadatos (ej. alteración de las capacidades técnicas expuestas por el hardware).

## 4. Requisitos Funcionales
1. **Recepción de Discovery:** El sistema debe proveer de una interfaz de ingesta para que los adaptadores de red reporten un dispositivo de hardware descubierto, acoplándolo contextualmente a un `homeId` específico.
2. **Listado de Bandeja (Inbox):** Un usuario debe poder obtener una vista consolidada de los dispositivos pendientes, siempre sujeta a una validación estricta de *ownership* territorial (Hogar Padre).
3. **Asignación a Habitación (Assign):** Un usuario debe poder trasladar un dispositivo del *Inbox* a una ubicación topológica final, adjuntando e instruyendo un `roomId` de destino.
4. **Validación de Propiedad Estricta:** La asignación requerirá que el repositorio cruce verificaciones demostrando que el `roomId` pertenece a un Hogar (`homeId`) del cual el usuario emisor sea propietario.

## 5. Requisitos No Funcionales (NFRs)
- **NFR-01 (Inmutabilidad del Identificador Origen):** El string de hardware provisto por la capa Edge (`externalId` o equivalente de `macAddress`) será preservado inmutablemente como llave única externa, independientemente de que el módulo asigne un UUID v4 de dominio al Device interno.
- **NFR-02 (Zero-Trust Inter-tenant):** Bajo ninguna condición un usuario listará la bandeja de descubrimientos perteneciente a otros *Homes*.
- **NFR-03 (Consistencia de Estados):** Un dispositivo asignado ya no puede reaparecer dentro de los listados de respuestas dirigidos a obtener el Inbox transitorio. Su migración es atómica.
- **NFR-04 (Eventos de Dominio):** Todo dispositivo descubierto topológicamente o asignado por el usuario debe emitir un Evento estructurado propagando el identificador originario de correlación y la firma temporal.
- **NFR-05 (Dependencias de Módulo Limpias):** El contexto lógico de *Device* opera sobre su propia agregación; no obstante, dependerá arquitectónicamente del módulo de *Topología* como proveedor de verdad (Source of Truth) para la verificación y autorización de los IDs habitacionales involucrados en la traslación de estado.

## 6. Semántica HTTP

### Endpoint de Ingreso (Integración Local Edge)
- `POST /integrations/discovery`
  - Body Fijo: `{ homeId, externalId, name, type, vendor }`
  - Success: `201 Created`
  - Fallbacks: `400 Bad Request`, `404 Not Found`, `409 Conflict` (Si el dispositivo ya existe).

### Endpoints de Visualización de Flujo (Inbox)
- `GET /homes/:homeId/inbox`
  - Success: `200 OK` (Matriz o Array conteniendo Objetos Device con flag `PENDING`).
  - Fallbacks: `400 Bad Request`, `401 Unauthorized`, `403 Forbidden` (Vulneración Auth Zero-Trust), `404 Not Found`.

### Endpoints de Asignación Accionable
- `POST /devices/:deviceId/assign`
  - Body Fijo: `{ roomId }`
  - Success: `200 OK`
  - Fallbacks: 
    - `400 Bad Request`
    - `403 Forbidden` (Riesgo: El `roomId` pertenece al Home de otro usuario vulnerando el Ownership parental del Device actual).
    - `404 Not Found` (El Device o Room referenciados son nulos/inexistentes).
    - `409 Conflict` (El dispositivo ya alcanzó la etapa de asignación previamente impidiendo reversiones involuntarias).

## 7. Eventos de Dominio
Ambos heredarán campos core (`eventId`, `timestamp`, `schemaVersion`, `source`, `correlationId`).

- **`DeviceDiscoveredEvent`**
  - Payload Interno: `{ deviceId, homeId, externalId, type, vendor, name }`
- **`DeviceAssignedToRoomEvent`**
  - Payload Interno: `{ deviceId, roomId, previousState: "PENDING" }`

## 8. Modelo Conceptual de Datos

### Device (Domain Entity)
| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `id` | UUID | Identificador interno absoluto derivado. |
| `homeId` | UUID | Nodo raíz Topológico de herencia territorial. |
| `roomId` | UUID \| null | Un valor *null* define la pertenencia contextual actual al INBOX del Home. |
| `externalId` | String | Llave extranjera fija provista por hardware nativo (Ej. BLE Mac, Identificador Zigbee). |
| `name` | String | Nombre sugerido por el protocolo, o posteriormente inyectable por el usuario. |
| `type` | String | Calificación del transceptor (*Sensor, Light, Switch, Lock, etc.*). |
| `vendor` | String | Ensamblador o Proveedor Tecnológico (*Philips, Tuya, Native, etc.*). |
| `status` | ENUM | `PENDING` (en ciclo Inbox) \| `ASSIGNED`. |
| `entityVersion` | Integer | Control de transacciones concurrentes (Optimistic Locking). |
| `createdAt` | ISO | Timestamp nativo del backend. |
| `updatedAt` | ISO | Interacción mutacional más reciente documentada. |

## 9. Criterios de Aceptación Claves (AC)
- **AC1:** Un `POST /integrations/discovery` con un payload de hardware sólido enlazado a un `homeId` activo formará en memoria persistida un dispositivo con estado `PENDING` (`roomId = null`) resolviendo HTTP `201`.
- **AC2:** Un `GET /homes/:homeId/inbox` emitido legalmente por el Titular (Tenant) arrojará exclusivamente en Array los dispositivos donde el valor `roomId` sea explícitamente `null` con código HTTP `200`.
- **AC3:** Un `GET /homes/:homeId/inbox` emitido maliciosamente por un atacante o usuario interceptado (`userId` distinto al `owner` del parent) blindará el proceso arrojando de raíz HTTP `403 Forbidden`.
- **AC4:** Proyectar la tarea `POST /devices/:deviceId/assign` indicando un `roomId` en posesión validada en el backend alterará permanentemente el enumerado del Entity a `ASSIGNED`, adscribirá en firme el ID y devovlerá HTTP `200` y subsecuentemente la respuesta GET extraída en AC2 estará vacía u omitirá a dicho Device explícitamente.
- **AC5:** Intentar la sobre-escritura `POST /devices/:deviceId/assign` utilizando un target `roomId` verificado como propiedad de un Hogar Secundario `B`, mientras que la petición original (y el Device pre-anclado en Home `A`) pertenecen al primero, bloqueará matemáticamente la base abortando en un HTTP `403 Forbidden`.

## 10. Notas Técnicas y Arquitectura
- **Inyección Trans-Módulo Segura:** Para validar de manera correcta la integridad solicitada en AC5 y repeler la inyección transversal, el Orquestador o Caso de Uso implementado demandará que verifiquemos a través de un puerto perimetral (Ej. `TopologyService`) que el identificador intermedio (ID de Room) esté formalmente enrastrado por debajo del `homeId` matriz registrado tras el Discovery original.
- **Restricción Edge Arquitectónica V1:** En su iteración primaria, `/integrations/discovery` no procesará JWT frontales para inyección; utilizará firmas pasivas locales M2M o claves internas de red (API KEYs), ya que los componentes que impulsan y notifican hardwares nuevos a la API backend no son las capas Vistas/Móviles gestionables por un token clásico.
- **Idempotencia Transaccional Constante:** La colisión (AC1) por rebotes físicos de red (El Hub expulsa 3 UDP packets de Discovery en cascada de un mismo Sensor) se neutralizará a nivel de restricción relacional persistente usando una clave compuesta híbrida `(homeId, externalId)`. Dejándose absorber sin crear múltiples instancias derivando de ser necesario en un simple 200/409 aséptico al integrador.

## 11. Preguntas Abiertas / TODOs
- **[TODO: Roadmap V2 - Release Cycle Tracker]:** ¿Integraremos de forma colindante un endpoint semántico de des-asignación (ej. retornar lógicamente a PENDING) o será suficiente dictaminar el borrado duro por comando "Eliminar Dispositivo" obligando al redescubrimiento total si un usuario se equivoca de habitación?.
- **[TODO: Stack Architecture Review]:** Se requiere evaluación inmediata sobre si la ingesta proveniente del Local Gateway / MQTT Broker deberá llamar a este spec REST vía HTTP Loopback (`/integrations/discovery`) o será inyectado de forma agnóstica a la web bypassando los controllers nativos e interfiriendo de manera directa al *Application Service* en capas internas Edge.
