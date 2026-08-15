# Plan de Implementación: Directorio Central de Cuentas y Casas

**Base:** `/specs/multi-home-account-directory-v1.md`
**Objetivo:** Desglosar la especificación en tareas operativas, ordenadas y dimensionadas para Pull Requests (PR) individuales. El Directorio es un servicio nuevo, independiente del código de cada Edge; ninguna tarea de este plan debe tocar `packages/auth`, `packages/topology` ni `AuthGuard` de un Edge.

---

## 0. Decisiones previas (resueltas — ver spec sección 8.1)

- **0.1** Alojamiento: servicio cloud gestionado por Nezu. **Resuelto.**
- **0.2** Autenticación: email/contraseña propios del Directorio. **Resuelto.**
- **0.3** Ubicación del selector: landing/app propia, separada de `operator-console`. **Resuelto.**

Las capas 1–6 pueden iniciarse. Queda pendiente únicamente la elección concreta de proveedor de hosting/DB (infraestructura, no arquitectura — spec sección 8.2), que no bloquea el desarrollo del código de dominio/aplicación/API.

---

## 1. CAPA: Dominio (Modelos Principales)

### 1.1 Entidades `DirectoryAccount`, `DirectoryHome`, `DirectoryHomeMembership`
- **Objetivo:** Definir los tipos base del Directorio, agnósticos de framework.
- **Alcance:** Interfaces según sección 7 de la spec (`DirectoryAccount`, `DirectoryHome`, `DirectoryHomeMembership`).
- **Dependencia previa:** Ninguna.
- **Criterio de terminado:** Tipos declarados sin acoplamiento a persistencia ni HTTP.

### 1.2 Factories y validación de invariantes
- **Objetivo:** Instanciar entidades con reglas de negocio mínimas.
- **Alcance:** `createHome(name, hostname, ownerAccountId)`, `createMembership(homeId, accountId, role, invitedBy)` con `status` inicial correcto (`active` para el owner al crear la casa, `pending` para invitados).
- **Dependencia previa:** 1.1
- **Criterio de terminado:** Unit tests validando UUID, timestamps y estado inicial de cada entidad.

---

## 2. CAPA: Persistencia

### 2.1 Puertos de Repositorio
- **Objetivo:** Definir operaciones de entrada/salida sin atarse a un motor de base de datos.
- **Alcance:** `AccountRepository` (crear, buscar por email/id), `HomeRepository` (crear, buscar por id, listar por owner), `HomeMembershipRepository` (crear, listar por cuenta activa, actualizar estado).
- **Dependencia previa:** 1.1
- **Criterio de terminado:** Interfaces agnósticas declaradas.

### 2.2 Adaptador de base de datos del Directorio
- **Objetivo:** Implementar persistencia física, en una base de datos propia y separada de cualquier SQLite de Edge.
- **Alcance:** Migraciones para `accounts`, `homes`, `home_memberships`; implementación concreta de los repositorios de 2.1.
- **Dependencia previa:** 2.1, 0.1
- **Criterio de terminado:** Integration tests contra BD efímera validando alta de cuenta, casa y membresía, y que un `findHomesForAccount` nunca devuelve membresías `pending`/`revoked`.

---

## 3. CAPA: Aplicación (Casos de Uso)

### 3.1 Autenticación de cuenta
- **Objetivo:** Alta e inicio de sesión de cuentas del Directorio.
- **Alcance:** `registerAccountUseCase`, `loginAccountUseCase` (según decisión 0.2); emisión de un token de sesión propio del Directorio (independiente de cualquier token de Edge).
- **Dependencia previa:** 2.2, 0.2
- **Criterio de terminado:** Unit tests de alta exitosa, email duplicado (409) y credenciales inválidas (401).

### 3.2 Gestión de casas
- **Objetivo:** Alta, listado y baja de casas por su propietario.
- **Alcance:** `registerHomeUseCase` (crea casa + membresía `owner`/`active`), `listHomesForAccountUseCase` (solo membresías `active`), `deleteHomeUseCase` (solo el `owner`, no borra nada del Edge).
- **Dependencia previa:** 1.2, 2.1
- **Criterio de terminado:** Unit tests: creación válida, listado no filtra por dueño solamente (incluye membresías de invitado activas), intento de borrado por no-propietario rechazado.

### 3.3 Invitaciones y membresías
- **Objetivo:** Ciclo completo de invitación.
- **Alcance:** `inviteToHomeUseCase` (solo `owner`, genera token no adivinable con expiración, NFR-03), `acceptInvitationUseCase`, `revokeMembershipUseCase` (solo `owner`).
- **Dependencia previa:** 3.2
- **Criterio de terminado:** Unit tests: invitación expirada rechazada, aceptación duplicada idempotente, revocación deja de aparecer en el siguiente listado.

---

## 4. CAPA: Seguridad y API REST

### 4.1 Middleware de sesión del Directorio
- **Objetivo:** Validar el token de sesión del Directorio en cada petición.
- **Alcance:** Middleware que extrae `accountId` del token; rechaza con `401` si falta o es inválido. No debe reutilizar ni depender de `AuthGuard` de ningún Edge.
- **Dependencia previa:** 3.1
- **Criterio de terminado:** Unit tests de rechazo `401` y paso con `accountId` inyectado.

### 4.2 Controladores del Directorio
- **Objetivo:** Exponer los casos de uso por HTTP.
- **Alcance:** `POST /directory/accounts`, `POST /directory/session`, `POST /directory/homes`, `GET /directory/homes`, `DELETE /directory/homes/:id`, `POST /directory/homes/:id/invitations`, `POST /directory/invitations/:token/accept`, `DELETE /directory/homes/:id/memberships/:accountId`.
- **Alcance de errores:** mapear `NotFoundError` → 404, `ForbiddenError` → 403 (p. ej. invitar/revocar sin ser `owner`), validación de cuerpo → 400.
- **Dependencia previa:** 3.1, 3.2, 3.3, 4.1
- **Criterio de terminado:** Unit tests aislando cada controlador, verificando el mapeo HTTP-status.

---

## 5. CAPA: Frontend (Selector de Casa)

### 5.1 Pantalla de cuenta e inicio de sesión del Directorio
- **Objetivo:** Login/registro contra el Directorio, separado del login de cada Edge.
- **Alcance:** Formulario de cuenta; persistencia del token de sesión del Directorio en el cliente.
- **Dependencia previa:** 4.2, 0.3

### 5.2 Selector de casa
- **Objetivo:** Listar casas activas del usuario y navegar al hostname elegido.
- **Alcance:** Vista "Mis casas" (`GET /directory/homes`); al elegir una, `window.location.assign(edgeHostname)` — nunca un fetch autenticado automático hacia el Edge (cumple REQ-05/AC5).
- **Dependencia previa:** 5.1

### 5.3 Gestión de invitaciones (solo propietario)
- **Objetivo:** UI para invitar y revocar miembros de una casa propia.
- **Alcance:** Formulario de invitación por email; lista de miembros con acción de revocar.
- **Dependencia previa:** 5.2, 4.2

---

## 6. CAPA: Pruebas End-to-End (E2E)

### 6.1 E2E Alta y listado (AC1, AC2, AC3)
- **Alcance:** Registro de cuenta → registro de casa propia → invitación aceptada por segunda cuenta → ambas casas visibles para el invitado.
- **Dependencia previa:** Todo lo anterior.

### 6.2 E2E Aislamiento (AC4, AC6, AC8)
- **Alcance:** Cuenta B no puede ver ni listar casa de cuenta A sin membresía; revocar membresía la retira del listado; eliminar el registro de una casa no genera ninguna llamada ni efecto hacia el Edge real (verificar que no exista integración de red hacia el hostname en el borrado).
- **Dependencia previa:** Todo lo anterior.

### 6.3 E2E Independencia del Edge (AC5, AC7)
- **Alcance:** Simular Directorio caído: un cliente con hostname de Edge conocido y sesión local de ese Edge sigue operando. Verificar que seleccionar una casa en el selector nunca omite el login propio del Edge.
- **Dependencia previa:** Todo lo anterior.
