# Plan de Implementación: Vinculación SSO Directorio↔Edge

**Base:** `/specs/directory-edge-sso-linking-v1.md`
**Objetivo:** Esta feature cruza dos repositorios. Las tareas 1-2 son del repo `homepilot` (este repo, cada Edge). Las tareas 3 son del repo `nezu-homepilot-directory`. Ningún cambio de este plan debe tocar el modelo de roles operativos existente (`admin/parent/child/guest/operator`) ni el flujo de login manual actual, que debe seguir funcionando exactamente igual.

---

## 1. CAPA: Dominio y Persistencia (Edge, repo homepilot)

### 1.1 Migración `028_create_directory_account_links.sql`
- Tablas `directory_account_links` y `directory_sso_used_tokens` (ver spec sección 7.1).
- Criterio de terminado: migración aplica limpio sobre una base existente con `users`/`sessions` ya pobladas.

### 1.2 Puertos de repositorio
- `DirectoryLinkRepository`: `findByDirectoryAccountId`, `create(directoryAccountId, localUserId)`, `delete(directoryAccountId)`, `listByLocalUserId`.
- `UsedSsoTokenRepository`: `isUsed(jti)`, `markUsed(jti, expiresAt)`, `purgeExpired()`.
- Criterio de terminado: interfaces agnósticas de SQLite, con implementación concreta e integration tests contra BD efímera.

## 2. CAPA: Aplicación y API (Edge, repo homepilot)

### 2.1 Verificación de token SSO
- Nuevo servicio `DirectorySsoVerifier` que recibe el token crudo, verifica firma Ed25519 contra `DIRECTORY_SSO_PUBLIC_KEY` (env var), valida `exp` y `jti` no usado.
- No debe hacer ninguna llamada de red — todo verificable localmente (NFR-02).
- Unit tests: firma inválida rechazada, expirado rechazado, `jti` repetido rechazado, token válido y fresco aceptado.

### 2.2 Endpoint `POST /api/v1/auth/sso/directory`
- Si hay vínculo para `directoryAccountId`: crea sesión local (reutiliza `AuthService.createSessionForUser` o método equivalente) para el `localUserId` vinculado y responde igual que un login exitoso.
- Si no hay vínculo: responde algo como `{ linked: false }` sin crear sesión (el frontend decide mostrar el login local).
- Marca el `jti` como usado en cuanto se verifica exitosamente (independientemente de si hay vínculo o no), para que no pueda reintentarse.
- Mapeo de errores: firma inválida / expirado / reutilizado → 401 con código explícito (`SSO_TOKEN_INVALID`, `SSO_TOKEN_EXPIRED`, `SSO_TOKEN_REPLAYED`).

### 2.3 Vinculación automática post-login
- Extiende el endpoint de login existente (`POST /api/v1/auth/login`) para aceptar opcionalmente un `ssoLinkToken` (el mismo token SSO original, aún no usado, reenviado por el frontend).
- Si el login es exitoso Y el `ssoLinkToken` es válido/no usado/no expirado: crea el vínculo `directory_account_links` para ese `directoryAccountId` ↔ el usuario recién logueado, y marca el `jti` como usado, en la misma transacción del login (no como una segunda petición separada que pueda fallar a medias).
- Unit tests: login exitoso + token SSO válido crea vínculo; login exitoso sin token SSO no crea nada (comportamiento actual intacto); login fallido no crea vínculo aunque el token SSO sea válido.

### 2.4 Gestión de vínculos (ajustes del Edge)
- `GET /api/v1/auth/sso/links` (requiere sesión activa): lista vínculos del usuario actual (sin exponer nada del Directorio salvo el `directoryAccountId` opaco y fecha de creación/último uso).
- `DELETE /api/v1/auth/sso/links/:directoryAccountId` (requiere sesión activa, solo puede borrar sus propios vínculos).
- Tests: un usuario no puede listar ni borrar vínculos de otro usuario local (403).

### 2.5 Purga de tokens usados
- Job/rutina que purga `directory_sso_used_tokens` con `expires_at` vencido (reutiliza el patrón de limpieza periódica que ya exista en el proyecto para sesiones expiradas, si aplica).

## 3. CAPA: Frontend (Edge, repo homepilot — operator-console)

### 3.1 Ruta `/sso/directory`
- Detecta `?token=...` en la URL, lo guarda en memoria (nunca `localStorage`), limpia la URL con `history.replaceState` inmediatamente.
- Llama a `POST /api/v1/auth/sso/directory`.
- Si `linked: true` con sesión: guarda el token de sesión normal y navega a la app (como tras un login exitoso).
- Si `linked: false`: muestra el formulario de login normal, reteniendo el token SSO en memoria para reenviarlo junto con el intento de login (tarea 2.3).

### 3.2 Ajustes de cuenta: gestión de vínculos
- Sección nueva en ajustes de usuario: lista de cuentas del Directorio vinculadas (mostrar solo fecha, no el ID crudo si se puede evitar) con botón "Desvincular".

## 4. CAPA: Directorio (repo nezu-homepilot-directory)

### 4.1 Par de llaves Ed25519 del Directorio
- Generar par de llaves al desplegar (o vía script `npm run generate:sso-keys`), guardar la privada como secreto de entorno (`DIRECTORY_SSO_PRIVATE_KEY`), exponer la pública en `GET /directory/sso/public-key` (sin autenticación).

### 4.2 Emisión de token al elegir casa
- Al hacer click en una casa del selector, en vez de solo `window.location.assign(edgeHostname)`, llamar primero a un nuevo endpoint autenticado `POST /directory/homes/:homeId/sso-token` que devuelve `{ token }` firmado (payload: `directoryAccountId`, `homeId`, `iat`, `exp` +60s, `jti` aleatorio).
- Navegar a `${edgeHostname}/sso/directory?token=${token}`.
- Tests: token incluye los campos esperados, expira a los 60s, `jti` distinto en cada llamada.

### 4.3 Documentación de aprovisionamiento
- README: cómo obtener la llave pública (`GET /directory/sso/public-key`) y configurarla como `DIRECTORY_SSO_PUBLIC_KEY` en un Edge nuevo, como paso manual del onboarding de cada casa.

---

## 5. CAPA: Pruebas End-to-End

### 5.1 E2E primer acceso (AC1, AC2)
Cuenta sin vínculo llega con token SSO válido → ve login local → login manual exitoso → vínculo creado → segunda visita con nuevo token SSO entra sin pedir contraseña.

### 5.2 E2E anti-replay y expiración (AC3, AC4, AC5)
Reutilizar el mismo token dos veces → segunda falla. Token con `exp` vencido → falla. Token firmado con otra llave → falla.

### 5.3 E2E desvinculación (AC6)
Usuario vinculado desvincula desde ajustes → siguiente llegada por SSO vuelve a pedir login manual.

### 5.4 E2E independencia (AC7, AC8)
Login manual funciona igual con el Directorio inalcanzable (simulado). Un login vía SSO produce el mismo `role`/permisos que un login manual del mismo usuario (comparar respuesta de `/api/v1/auth/me`).
