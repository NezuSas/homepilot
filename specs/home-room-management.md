# SPEC: Creación de Hogar y Habitaciones (Home & Room Management)

**Estado:** Aprobado  
**Autor:** Arquitecto Senior  
**Fecha:** 2026-03-28  

## 1. Declaración del Problema
El sistema HomePilot requiere una topología base para organizar dispositivos físicos. La entidad `Home` es el contenedor lógico principal, agrupando entidades `Room`. En una arquitectura multi-tenant, el sistema debe asignar cada `Home` a un propietario (`ownerId`), aislar los datos por usuario (`userId`) y denegar el acceso no autorizado.

## 2. Alcance
- Creación y consulta de entidades `Home`.
- Creación y consulta de entidades `Room` vinculadas a un `Home`.
- Relación 1:N (un `Home` puede contener múltiples `Room`).
- Validación del `userId` en cada petición HTTP.
- Aislamiento de datos: un usuario solo puede interactuar con su propia topología.

## 3. Fuera de Alcance
- Integración de hardware y control de dispositivos (Devices).
- Agrupaciones topológicas lógicas o adicionales (Zonas).
- Motores de automatización o IA.
- Actualización (Update) y eliminación (Delete) de `Home` y `Room`.
- Gestión de autenticación web (el `userId` es inyectado en la API por un middleware previo).

## 4. Requisitos Funcionales
- **REQ-01 (Crear Home)**: El sistema debe crear un `Home` recibiendo un campo `name`.
- **REQ-02 (Identidad)**: El sistema debe generar un UUID v4 al persistir `Home` y `Room`.
- **REQ-03 (Listar Homes)**: El sistema debe devolver los `Home` donde el `ownerId` coincide con el `userId` en contexto.
- **REQ-04 (Crear Room)**: El sistema debe crear un `Room` recibiendo `homeId` y `name`.
- **REQ-05 (Validar Referencia)**: El sistema debe rechazar la creación de un `Room` si el `homeId` referenciado no existe.
- **REQ-06 (Listar Rooms)**: El sistema debe devolver los `Room` asociados a un `homeId`, validando que el solicitante sea el propietario del `Home`.
- **REQ-07 (Contexto Requerido)**: La API requiere `userId` en cada operación. Si no está presente, la petición se rechaza estructuralmente.
- **REQ-08 (Propiedad de Home)**: Durante la creación de un `Home`, el campo `ownerId` se asigna con el valor del `userId` activo.
- **REQ-09 (Propiedad de Room)**: La entidad `Room` no contiene un campo `ownerId`. Su acceso se autoriza verificando que el `userId` actual coincida con el `ownerId` de su `Home` padre.

## 5. Requisitos No Funcionales
- **NFR-01 (Latencia Edge)**: Las operaciones de lectura y escritura en BD local deben tardar menos de 20ms bajo carga normal.
- **NFR-02 (Operación Offline)**: La creación y consulta topológica no requiere conectividad Cloud.
- **NFR-03 (Idempotencia V1)**: Las peticiones POST no son idempotentes en esta iteración. Peticiones repetidas crearán múltiples entidades.
- **NFR-04 (Consistencia Transaccional)**: Se utiliza el patrón "Write-Then-Publish". Se persiste en la BD local primero y, solo si el almacenamiento es exitoso, se publica el evento en el Event Bus.
- **NFR-05 (Gestión de Fallos)**:
  - **Fallo I/O en BD**: Si la inserción falla, se retorna HTTP 500 y no se emite ningún evento.
  - **Fallo en Event Bus**: Si la base de datos persiste correctamente el estado pero falla la publicación al Event Bus, la API responde HTTP 201 exitosamente. En esta versión no se implementan reintentos automáticos (Outbox Pattern).

## 6. Semántica de Respuestas HTTP
- **`200 OK`**: Petición GET completada exitosamente. Devuelve un array JSON de resultados.
- **`200 OK` con `[]`**: Petición GET procesada correctamente donde el usuario no tiene registros asociados a la consulta.
- **`201 Created`**: Petición POST completada. Devuelve la entidad recién creada.
- **`400 Bad Request`**: Payload inválido (ej. campo `name` ausente o UUID mal formado).
- **`401 Unauthorized`**: Falta de identidad (`userId` ausente).
- **`403 Forbidden`**: El recurso padre existe, pero no pertenece al usuario solicitante.
- **`404 Not Found`**: El recurso padre referenciado no existe.
- **`500 Internal Server Error`**: Error interno, como falla de persistencia en disco o caída de red hacia la BD.

## 7. Criterios de Aceptación
- [ ] **AC1**: Dado un `userId` "U-1", al enviar `POST /homes` con `{"name": "Casa"}`, el sistema retorna `201 Created` incluyendo un nuevo `id`, `ownerId` "U-1" y `entityVersion` 1.
- [ ] **AC2**: Dado un `userId` "U-1" dueño de "H-1", al enviar `GET /homes`, el sistema retorna `200 OK` con un array conteniendo "H-1".
- [ ] **AC3**: Dado un `userId` "U-2" sin hogares creados, al enviar `GET /homes`, el sistema retorna `200 OK` con un array vacío `[]`.
- [ ] **AC4**: Dado el `userId` "U-1" dueño de "H-1", al enviar `POST /rooms` con `{"homeId": "H-1", "name": "Salón"}`, persiste el registro BD, retorna `201 Created` y emite `RoomCreatedEvent`.
- [ ] **AC5**: Dado el `userId` "U-2", al enviar `POST /rooms` referenciando "H-1" (propiedad de U-1), el sistema retorna `403 Forbidden` sin guardar datos ni emitir eventos.
- [ ] **AC6**: Dado un `userId` "U-1", al enviar `POST /rooms` referenciando un id "H-99" inexistente, el sistema retorna `404 Not Found` sin guardar datos ni emitir eventos.

## 8. Notas Técnicas y Arquitectura

**Modelo de Datos**
- Se utiliza `entityVersion` para manejo de concurrencia optimista en BD local.
- Se utiliza `schemaVersion` para versionado de contrato en el payload del Event Bus.

```typescript
interface Home {
  id: string;
  ownerId: string;
  name: string;
  entityVersion: number;
  createdAt: string;     // ISO-8601 UTC
  updatedAt: string;     // ISO-8601 UTC
}

interface Room {
  id: string;
  homeId: string;
  name: string;
  entityVersion: number; 
  createdAt: string; 
  updatedAt: string; 
}
```

**Modelo de Eventos**

- **`HomeCreatedEvent`**
```json
{
  "eventId": "uuid-v4-evento",
  "eventType": "HomeCreatedEvent",
  "schemaVersion": "1.0",
  "source": "domain:topology:edge",
  "timestamp": "YYYY-MM-DDThh:mm:ss.mssZ",
  "correlationId": "uuid-v4-request",
  "payload": {
    "id": "uuid-home",
    "ownerId": "uuid-user",
    "name": "Casa Central"
  }
}
```

- **`RoomCreatedEvent`**
```json
{
  "eventId": "uuid-v4-evento",
  "eventType": "RoomCreatedEvent",
  "schemaVersion": "1.0",
  "source": "domain:topology:edge",
  "timestamp": "YYYY-MM-DDThh:mm:ss.mssZ",
  "correlationId": "uuid-v4-request",
  "payload": {
    "id": "uuid-room",
    "homeId": "uuid-home",
    "name": "Baño Principal"
  }
}
```

## 9. Preguntas Abiertas y TODOs
- **TODO**: Implementar soporte de `Idempotency-Key` en headers HTTP para evitar duplicados en operaciones POST.
- **TODO**: Implementar el patrón Outbox transaccional para evitar inconsistencias entre la BD y el Event Bus.
