# SPEC: Roles del hogar y acceso por habitación V1

**Estado:** Implementado
**Fecha:** 2026-10-11
**Dependencias:** `auth-rbac-v1-local-edge-security.md`, `operator-console-v1.md`

## Problema

HomePilot tiene cuatro roles (`admin`, `parent`, `child`, `guest`; el antiguo `operator` se retiró, ver REQ-10), pero el cliente no sabe qué permisos darle a cada persona de su casa: los nombres no explican nada, un invitado ve y controla toda la casa, y una cuenta temporal no caduca. Las plataformas comerciales (Apple Home, Google Home, SmartThings, Alexa) resuelven esto con pocos roles claros, un invitado muy acotado y con vencimiento, y un administrador que decide qué puede usar cada persona. HomePilot debe ofrecer lo mismo sin complicar la instalación.

## Alcance

- Cuatro roles visibles con nombre y descripción comprensibles: **Administrador**, **Familiar**, **Niño** e **Invitado**. Los identificadores de la API no cambian (`admin`, `parent`, `child`, `guest`).
- **Alcance por habitación** para Niño e Invitado: todo el hogar o solo las habitaciones elegidas.
- **Vencimiento** opcional para Niño e Invitado.
- Pantalla de usuarios que explica qué puede hacer cada rol y muestra un resumen por persona.
- Sin cambios para las cuentas existentes: conservan acceso a todo el hogar y no caducan.

Fuera de alcance: acceso por dispositivo individual, horarios por día y hora, acceso remoto por persona, invitaciones por enlace o QR, y permisos por defecto elegidos desde el instalador.

## Roles

| Rol (nombre visible) | Id | Qué puede hacer | Qué no puede hacer |
| :--- | :--- | :--- | :--- |
| Administrador | `admin` | Todo: personas, sistema, diagnóstico, dispositivos, automatizaciones, energía. | — |
| Familiar | `parent` | Usar todos los dispositivos, escenas y tableros; crear sus propias escenas y automatizaciones; ver la energía. | Ver el sistema, gestionar personas. |
| Niño | `child` | Usar los dispositivos de las habitaciones permitidas y ejecutar escenas que solo usen esas habitaciones. | Crear o editar automatizaciones, ver la energía o el sistema. |
| Invitado | `guest` | Usar los dispositivos de las habitaciones permitidas, hasta su vencimiento. | Todo lo demás. |

## Requisitos

- **REQ-01:** La consola nombra los roles como indica la tabla, con una descripción corta en el selector de rol y en la tarjeta de cada persona. `operator` ya no existe como rol (REQ-10).
- **REQ-02:** Cada usuario tiene un alcance: `all` (todo el hogar) o `rooms` (solo las habitaciones listadas). Solo `child` y `guest` pueden tener alcance `rooms`; `admin` y `parent` siempre tienen `all`. Un cambio de rol a uno de esos dos restablece el alcance a `all`.
- **REQ-03:** Un usuario con alcance `rooms` solo puede leer o actuar sobre dispositivos cuya habitación esté en su lista. Los dispositivos sin habitación (bandeja de entrada) son invisibles para él.
- **REQ-04:** Para un usuario con alcance `rooms`, la API aplica el alcance en todos los puntos de acceso a dispositivos y habitaciones: listas de dispositivos, habitaciones y destinos de acciones filtradas; lectura, estado, catálogo de control, historial de uso, comandos y acciones por id; acciones de habitación; sesiones de cámara y de reproductores; escenas (solo se listan y ejecutan las que usan únicamente dispositivos en su alcance); el asistente (solo resuelve y controla dispositivos en su alcance, y solo lista habitaciones en su alcance); y los eventos en tiempo real (solo los de dispositivos en su alcance). Un acceso fuera de alcance responde 403 `FORBIDDEN` sin revelar si el recurso existe.
- **REQ-05:** Un usuario puede tener fecha de vencimiento (`expiresAt`); solo `child` y `guest`. Pasada la fecha, el inicio de sesión y las sesiones abiertas responden 401 `ACCOUNT_EXPIRED` y las sesiones se revocan. El administrador puede cambiarla o quitarla.
- **REQ-06:** `PATCH /api/v1/admin/users/:id/access` (solo `admin`) recibe `{ accessScope, roomIds?, expiresAt? }`, valida que las habitaciones existan en el hogar y registra `USER_ACCESS_CHANGED` en el registro de actividad. `POST /api/v1/admin/users` acepta los mismos campos opcionales. El DTO de usuario y `GET /api/v1/auth/me` incluyen `accessScope`, `roomIds` y `expiresAt`.
- **REQ-07:** La pantalla de usuarios permite, al crear o editar una cuenta de Niño o Invitado, elegir «Toda la casa» o «Algunas habitaciones» (lista con casillas) y un vencimiento (sin vencimiento, 1 día, 7 días, 30 días o una fecha). Un Invitado nuevo parte con «Algunas habitaciones» sin ninguna seleccionada y vencimiento a 7 días, de modo que no ve nada hasta que el administrador elige.
- **REQ-08:** La consola de un usuario con alcance `rooms` solo muestra sus habitaciones y los dispositivos que recibe; no muestra errores por lo que no ve.
- **REQ-09:** Compatibilidad: los usuarios existentes quedan con alcance `all` y sin vencimiento. La migración es aditiva; revertir el código deja las columnas y la tabla nuevas sin uso, sin pérdida de datos.
- **REQ-10:** El rol `operator` se retira por completo: la API lo rechaza al crear usuarios o cambiar roles, el dominio y la consola dejan de reconocerlo, y la migración `038_retire_operator_role.sql` convierte cualquier cuenta existente con ese rol en `parent` (Familiar), que es el comportamiento que ya tenía. Quien necesite acceso al sistema usa `admin`.

## Criterios de aceptación

- [x] **AC1:** Pruebas del dominio y del repositorio cubren alcance, vencimiento y la regla de que solo `child` y `guest` pueden estar restringidos.
- [x] **AC2:** Pruebas de la API cubren cada punto de REQ-04 con un usuario restringido y uno sin restricción.
- [x] **AC3:** Una prueba de extremo a extremo con la API real crea un Invitado con una habitación y comprueba lista, lectura, comando, escena y evento fuera y dentro de su alcance, y que tras el vencimiento todo responde 401 `ACCOUNT_EXPIRED`.
- [x] **AC4:** Pruebas de la consola cubren los nombres de rol, el selector de alcance y el de vencimiento, y que `operator` no es elegible.
- [x] **AC5:** La migración se aplica sobre una base existente sin cambiar usuarios previos.
- [x] **AC6:** Ningún rol `operator` es aceptado por la API, el dominio ni la consola, y la migración 038 convierte las cuentas existentes en `parent` sin tocar a los demás usuarios.

## Estrategia de compatibilidad y reversión

Migración `036_user_access_scope.sql`, aditiva: columnas `access_scope` (por defecto `'all'`) y `expires_at` (nulo) en `users`, y tabla `user_room_access(user_id, room_id)`. Para revertir basta desplegar la versión anterior: ignora las columnas y la tabla. Ningún dato existente se modifica.

## Evidencia

- Dominio y reglas: `packages/auth/domain/roomAccess.ts`, `packages/auth/application/RoomAccessRules.ts`, `UserManagementService.ts`, `AuthService.ts`, `AuthGuard.ts`, `SqliteUserRepository.ts` y `migrations/036_user_access_scope.sql`.
- API: `apps/api/routes/roomScope.ts` (listas y escenas), `AdminRoutes.ts` (`PATCH /admin/users/:id/access`), `AuthRoutes.ts` (`ACCOUNT_EXPIRED`), `ApiGateway.ts` (eventos en tiempo real) y `packages/assistant/application/PermissionGate.ts` (asistente).
- Consola: `lib/userAccess.ts`, `UserAccessFields.tsx`, `UserAccessModal.tsx`, `UserCreateForm.tsx`, `UsersTable.tsx` y `views/UsersView.tsx`.
- Pruebas: `roomAccess.test.ts`, `UserManagementService.access.test.ts`, `RoomScopedRoutes.test.ts`, `permission_gate_room_scope.test.ts`, `ApiGateway.test.ts`, `userAccess.test.ts`, `UserAccessFields.test.tsx`, `household-access.spec.ts` y una prueba de extremo a extremo contra la API real con los cinco roles.
