# Plan de Implementación: Home & Room Management

**Base:** `/specs/home-room-management.md`  
**Objetivo:** Desglosar la especificación en tareas operativas, ordenadas y dimensionadas para Pull Requests (PR) individuales.

---

## 1. CAPA: Dominio (Modelos Principales)

### 1.1 Entidades Estáticas `Home` y `Room`
- **Objetivo**: Definir los tipos base de la topología.
- **Alcance**: 
  - Interfaz `Home` (`id`, `ownerId`, `name`, `entityVersion`, `createdAt`, `updatedAt`).
  - Interfaz `Room` (`id`, `homeId`, `name`, `entityVersion`, `createdAt`, `updatedAt`).
- **Dependencia previa**: Ninguna.
- **Criterio de terminado**: Tipos declarados sin acoplamiento a frameworks.

### 1.2 Factory de `Home`
- **Objetivo**: Instanciar la entidad `Home`.
- **Alcance**: 
  - Función `createHome(name, userId)`.
  - Asigna UUID v4, `ownerId` = `userId`, `entityVersion` = 1, y timestamps actuales.
- **Dependencia previa**: 1.1
- **Criterio de terminado**: Unit tests validando la correcta asignación de UUID, timestamps y `ownerId`.

### 1.3 Factory de `Room`
- **Objetivo**: Instanciar la entidad `Room`.
- **Alcance**: 
  - Función `createRoom(name, homeId)`.
  - Asigna UUID v4, `homeId`, `entityVersion` = 1, y timestamps actuales.
- **Dependencia previa**: 1.1
- **Criterio de terminado**: Unit tests comprobando la inyección pura de datos.

---

## 2. CAPA: Eventos de Dominio

### 2.1 Esquemas de Evento
- **Objetivo**: Definir la carga útil de los eventos asíncronos.
- **Alcance**: 
  - Interfaces `HomeCreatedEvent` y `RoomCreatedEvent`.
  - Incluir campos: `eventId` (UUID), `eventType`, `schemaVersion` ("1.0"), `source`, `timestamp`.
- **Dependencia previa**: 1.1
- **Criterio de terminado**: DTOs definidos estáticamente.

### 2.2 Puerto de Interfaz: `EventPublisher`
- **Objetivo**: Abstraer la publicación de eventos.
- **Alcance**: 
  - Interfaz `TopologyEventPublisher` con método `publish(event)`.
  - Implementación temporal `InMemoryEventPublisher` para desarrollo y pruebas.
- **Dependencia previa**: 2.1
- **Criterio de terminado**: Interfaz abstracta y Mock en-memoria creados.

---

## 3. CAPA: Persistencia

### 3.1 Puertos de Repositorio
- **Objetivo**: Definir las operaciones de entrada/salida de base de datos.
- **Alcance**: 
  - Interfaz `IHomeRepository`: `saveHome`, `findHomesByUserId`, `findHomeById`.
  - Interfaz `IRoomRepository`: `saveRoom`, `findRoomsByHomeId`.
- **Dependencia previa**: 1.1
- **Criterio de terminado**: Interfaces agnósticas declaradas.

### 3.2 Adaptadores de Base de Datos Local
- **Objetivo**: Implementar persistencia física para `Home` y `Room`.
- **Alcance**: 
  - Implementar métodos de la interfaz (3.1) en un adaptador concreto.
  - Asegurar que errores de I/O lancen excepciones capturables.
- **Dependencia previa**: 3.1
- **Criterio de terminado**: Integration tests contra BD efímera validando inserción y búsqueda de Homes y Rooms.

---

## 4. CAPA: Aplicación (Casos de Uso)

### 4.1 Validador de Autorización: `OwnershipValidator`
- **Objetivo**: Centralizar la validación de propiedad de `Home`.
- **Alcance**: 
  - Función `validateHomeOwnership(homeId, userId, repository)`.
  - Lanza `NotFoundError` si `homeId` no existe.
  - Lanza `ForbiddenError` si `home.ownerId` no coincide con `userId`.
- **Dependencia previa**: 3.1
- **Criterio de terminado**: Unit tests validando las tres rutas: éxito, no encontrado (404) y prohibido (403).

### 4.2 Caso de Uso: Gestor `Home`
- **Objetivo**: Orquestar la creación y listado de hogares.
- **Alcance**: 
  - `createHomeUseCase`: Instancia Factory (1.2) -> `saveHome()` -> `publish()`. 
  - `listHomesUseCase`: Retorna `findHomesByUserId()`.
- **Dependencia previa**: 1.2, 2.2, 3.1
- **Criterio de terminado**: Unit test (Mock repo/publisher) validando que un fallo en `saveHome()` evita ejecutar `publish()`.

### 4.3 Caso de Uso: Gestor `Room`
- **Objetivo**: Orquestar la creación y listado de habitaciones con autorización.
- **Alcance**: 
  - `createRoomUseCase`: `validateHomeOwnership()` (4.1) -> Factory (1.3) -> `saveRoom()` -> `publish()`.
  - `listRoomsUseCase`: `validateHomeOwnership()` (4.1) -> `findRoomsByHomeId()`.
- **Dependencia previa**: 4.1, 1.3, 2.2, 3.1
- **Criterio de terminado**: Unit tests probando que el rechazo en pre-vuelo (Validador) evita acceder a la BD.

---

## 5. CAPA: Seguridad y API REST

### 5.1 Middleware de Autenticación
- **Objetivo**: Validar el inicio de sesión y bloquear peticiones anónimas.
- **Alcance**: 
  - Middleware para interceptar `/homes` y `/rooms`.
  - Extrae `userId` de la petición. Retorna HTTP `401 Unauthorized` si está ausente.
- **Dependencia previa**: Ninguna.
- **Criterio de terminado**: Unit tests comprobando rechazo `401` y pase libre con `userId` inyectado.

### 5.2 Controladores Topology
- **Objetivo**: Exponer las operaciones por HTTP GET y POST.
- **Alcance**: 
  - Operaciones: `POST /homes`, `GET /homes`, `POST /rooms`, `GET /rooms`.
  - Valida cuerpo de petición (`name` faltante -> `400 Bad Request`).
  - Mapear excepciones de Casos de Uso: `NotFoundError` -> 404, `ForbiddenError` -> 403, Fallo I/O -> 500.
  - Responder HTTP `200 []` si no hay resultados y `201 Created` en POST exitosos.
- **Dependencia previa**: 4.2, 4.3, 5.1
- **Criterio de terminado**: Unit tests aislando el controlador demostrando el correcto mapeo HTTP-status.

---

## 6. CAPA: Pruebas End-to-End (E2E)

### 6.1 E2E Funcional `Home` (AC1, AC2, AC3)
- **Objetivo**: Comprobar funcionalidades principales de `Home` vía red.
- **Alcance**: 
  - Servidor/BD integrada, peticiones reales/simuladas tipo Supertest.
  - Test E2E `POST /homes`: Verifica éxito HTTP 201 y formato de respuesta.
  - Test E2E `POST /homes` sin argumentos: Verifica retorno HTTP 400.
  - Test E2E `GET /homes` sin inserts previos: Verifica retorno HTTP 200 y array vacío `[]`.
- **Dependencia previa**: Todo lo anterior.
- **Criterio de terminado**: Todos los tests en verde para Home.

### 6.2 E2E Seguridad Cruzada `Room` (AC4, AC5, AC6)
- **Objetivo**: Comprobar seguridad Zero-Trust sobre topología.
- **Alcance**: 
  - Test E2E POST: Creación validada vinculando `userId` con su propio `homeId` (HTTP 201).
  - Test E2E Ataque: Intento de `POST /rooms` con sesión de "User B" en `homeId` de "User A" (Verifica interrupción HTTP 403 y base de datos sin cambios).
  - Test E2E Inexistente: `POST /rooms` a un `homeId` inventado (Verifica HTTP 404).
- **Dependencia previa**: Todo lo anterior.
- **Criterio de terminado**: Pruebas de seguridad validadas positivamente en el flujo integrado sin logs de excepciones no controladas.
