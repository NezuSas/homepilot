# SPEC: Vinculación SSO Directorio↔Edge (Directory-Edge SSO Linking) V1

**Estado:** Implementado
**Nota de evolución:** Para nuevas implementaciones, usar directory-home-bound-access-v2.md; esta V1 queda como compatibilidad de enlaces locales.
**Autor:** Claude (análisis solicitado por Oscar)
**Fecha:** 2026-08-15

## 1. Declaración del Problema

`multi-home-account-directory-v1.md` (repo `nezu-homepilot-directory`) resolvió que una cuenta central pueda listar varias casas y navegar al hostname del Edge correspondiente, dejando explícitamente **fuera de alcance** cualquier SSO: al llegar a un Edge, el usuario debe loguearse de nuevo con su cuenta local de ese Edge. En uso real esto resultó en **doble login por cada cambio de casa**, una experiencia notablemente peor que Google Home (donde cambiar de casa no vuelve a pedir contraseña). Esta spec reemplaza esa limitación con un mecanismo de vinculación de cuentas que permite iniciar sesión automáticamente en un Edge ya vinculado, sin comprometer el aislamiento de seguridad de cada instalación.

Esta spec afecta **dos repositorios**:
- `homepilot` (este repo): cada Edge debe aprender a **verificar** un token de acceso emitido por el Directorio y resolverlo a una sesión local existente.
- `nezu-homepilot-directory`: debe aprender a **emitir** ese token al seleccionar una casa, en vez de solo hacer `window.location.assign`.

## 2. Alcance

- El Directorio firma un token de acceso de un solo uso y muy corta duración (~60s) con una llave privada propia, cuando el usuario elige una casa desde el selector.
- Cada Edge verifica ese token con la llave pública del Directorio (no un secreto compartido), confirma que no fue usado antes (anti-replay) y que no expiró.
- La primera vez que una cuenta del Directorio llega a un Edge sin vínculo previo, el Edge exige el login local normal (usuario/contraseña existente); al autenticarse con éxito, el Edge crea automáticamente el vínculo `directoryAccountId ↔ localUserId` (vinculación automática y silenciosa, sin pantalla de confirmación adicional — decisión de producto tomada explícitamente para esta v1).
- Las siguientes veces, el Edge resuelve el vínculo y abre sesión local automáticamente sin pedir contraseña, usando el token firmado como única prueba.
- Un usuario local del Edge (`admin`/`parent`/etc.) debe poder ver y **desvincular** una cuenta del Directorio ya asociada, desde los ajustes del Edge.
- El Directorio debe poder recordar, por conveniencia de UI (no como control de acceso), que una casa ya fue usada exitosamente antes.

## 3. Fuera de Alcance

- Cambiar el modelo de roles operativos del Edge (`admin/parent/child/guest/operator`) o su jerarquía — no se toca.
- Que el Directorio conozca o almacene contraseñas, hashes o tokens de sesión de ningún Edge — el vínculo solo guarda una referencia opaca (`localUserId`), nunca credenciales.
- Vinculación explícita con pantalla de consentimiento — se decidió vinculación automática silenciosa tras el primer login exitoso (ver sección 8 para el registro de esta decisión).
- Comunicación servidor-a-servidor entre el Directorio y un Edge. El token viaja únicamente a través del navegador del usuario (redirect), nunca por una llamada backend-a-backend — el Directorio no necesita conectividad saliente hacia hostnames de clientes.
- Revocación remota desde el Directorio de un vínculo hecho en un Edge (la desvinculación es una acción local del Edge; el Directorio solo puede "olvidar" la conveniencia de UI, no forzar el borrado de un vínculo en una instalación que no controla).

## 4. Requisitos Funcionales

### 4.1 Lado Directorio (`nezu-homepilot-directory`)
- **REQ-D01:** Al elegir una casa en el selector, el Directorio debe generar un token firmado (JWT o equivalente) con: `{ directoryAccountId, homeId, iat, exp (60s), jti (nonce único) }`, firmado con una clave privada Ed25519 (o RS256) propia del Directorio.
- **REQ-D02:** Al elegir una casa, el Directorio debe entregar el token mediante un formulario HTML de nivel superior, `POST ${edgeHostname}/sso/directory`, con el token en el cuerpo. Nunca debe hacer un `fetch` hacia el Edge ni poner el token en URL, historial, `Referer` o logs de proxy.
- **REQ-D03:** El Directorio debe exponer su llave pública en un endpoint estable y sin autenticación, p. ej. `GET /directory/sso/public-key`, para que cada Edge pueda obtenerla al aprovisionarse (una vez, manualmente o vía script) y guardarla localmente — el Edge no debe consultar este endpoint en cada verificación de token (debe funcionar aunque el Directorio esté caído en ese instante, cumpliendo NFR-01 de la spec base).

### 4.2 Lado Edge (`homepilot`)
- **REQ-E01:** Debe existir una ruta pública (sin requerir sesión previa) `POST /api/v1/auth/sso/directory` (o `GET` con redirect, ver notas técnicas) que reciba el token del Directorio.
- **REQ-E02:** El Edge debe verificar la firma del token contra una llave pública del Directorio configurada en el Edge (variable de entorno o archivo local), rechazando cualquier token no firmado por esa llave.
- **REQ-E03:** El Edge debe rechazar tokens expirados (`exp` vencido) y tokens ya usados (mismo `jti` visto antes) — anti-replay obligatorio.
- **REQ-E04:** Si existe un vínculo activo para `directoryAccountId` en este Edge, el Edge debe crear una sesión local normal (reutilizando el mecanismo de sesiones ya existente en `AuthService`) para el `localUserId` vinculado, y devolver el token de sesión como en un login exitoso.
- **REQ-E05:** Si NO existe vínculo, el Edge debe redirigir a su login local normal, conservando el token SSO original (aún válido y sin usar) de forma seguridad-consciente (ver notas técnicas) para poder completar la vinculación inmediatamente después de un login manual exitoso.
- **REQ-E06:** Inmediatamente después de un login manual exitoso que traía un token SSO válido y no usado, el Edge debe crear el vínculo `directoryAccountId ↔ localUserId` automáticamente, sin pantalla de confirmación adicional, y marcar el `jti` de ese token como usado.
- **REQ-E07:** Debe existir un endpoint autenticado (requiere sesión local activa) para listar y eliminar vínculos del Directorio asociados al usuario local actual: `GET /api/v1/auth/sso/links`, `DELETE /api/v1/auth/sso/links/:directoryAccountId`.
- **REQ-E08:** Los `jti` usados deben purgarse automáticamente pasada su ventana de expiración (no crecer indefinidamente).

## 5. Requisitos No Funcionales

- **NFR-01:** El Edge debe seguir operando su login local normal exactamente igual que hoy si el usuario no pasa por el Directorio — este flujo es un mecanismo adicional, no un reemplazo del login existente.
- **NFR-02:** La verificación del token SSO en el Edge no debe requerir conectividad de red hacia el Directorio en el momento de la verificación (la llave pública ya debe estar guardada localmente de antemano).
- **NFR-03:** Un token capturado (por ejemplo en un log de proxy) debe ser inútil pasados los 60 segundos o tras su primer uso, lo que ocurra primero.
- **NFR-04:** El vínculo (`directory_account_links`) debe almacenar únicamente el identificador opaco de cuenta del Directorio y el `localUserId` — nunca email, contraseña ni ningún dato personal adicional del Directorio.
- **NFR-05:** Ningún log del Edge debe imprimir el token SSO completo (mismo estándar que ya aplica a tokens de sesión, `auth-rbac-v1-local-edge-security.md` sección 6).

## 6. Criterios de Aceptación

- [ ] AC1: Un usuario sin vínculo previo que llega desde el Directorio a un Edge ve el login local normal (no una sesión automática).
- [ ] AC2: Tras loguearse manualmente con éxito viniendo de un token SSO válido, el Edge crea el vínculo y ese usuario ya no necesita loguearse manualmente la próxima vez que llegue desde el Directorio con esa cuenta.
- [ ] AC3: Un token SSO reutilizado una segunda vez es rechazado, incluso si aún no expiró.
- [ ] AC4: Un token SSO expirado (>60s) es rechazado aunque no se haya usado.
- [ ] AC5: Un token firmado con una llave que no es la del Directorio configurado es rechazado.
- [ ] AC6: El usuario puede ver sus vínculos activos y desvincular uno desde los ajustes del Edge; tras desvincular, la próxima llegada desde el Directorio vuelve a pedir login manual.
- [ ] AC7: Si el Directorio está caído, un usuario que ya conoce el hostname de su Edge y tiene sesión local (o vínculo ya establecido, entrando por una URL SSO cacheada previamente inválida) sigue pudiendo loguearse manualmente sin ninguna dependencia del Directorio.
- [ ] AC8: El rol/permisos del usuario tras un login vía SSO son idénticos a los de un login manual del mismo usuario — el mecanismo SSO no otorga ni eleva ningún permiso.

## 7. Notas Técnicas y Arquitectura

### 7.1 Modelo de datos nuevo en el Edge (migración `028_create_directory_account_links.sql`)
```sql
CREATE TABLE directory_account_links (
  directory_account_id TEXT PRIMARY KEY,
  local_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  last_used_at TEXT
);

CREATE TABLE directory_sso_used_tokens (
  jti TEXT PRIMARY KEY,
  used_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
```

### 7.2 Flujo end-to-end
1. Usuario elige "Casa Oscar" en el Directorio → Directorio firma token (REQ-D01) → envía un formulario de nivel superior `POST` a `https://homepilot-oscar.nezuecuador.com/sso/directory`. El token nunca aparece en la URL.`n2. El borde recibe el formulario, verifica firma + expiración + anti-replay (REQ-E02/E03) y deposita solamente una aserción efímera en una cookie `HttpOnly`, `Secure`, `SameSite=Lax`, con `Path=/` y vida máxima de 60 segundos. Luego responde `303 /`.`n3. El frontend existente consume esa aserción mediante el endpoint same-origin y limpia la cookie.`n4. Si hay vínculo (REQ-E04): recibe una sesión local normal y navega a la misma plataforma Edge existente.`n5. Si no hay vínculo (REQ-E05): el frontend muestra el login local normal y retiene la aserción solamente en memoria; no usa `localStorage`, `sessionStorage` ni URL.`n6. Al loguearse manualmente con éxito, el frontend reenvía esa misma aserción para que el backend cree el vínculo atómicamente con el login (REQ-E06) y marque el `jti` como usado.
7. La llave pública del Directorio se configura en el Edge vía variable de entorno `DIRECTORY_SSO_PUBLIC_KEY` (o archivo), aprovisionada una vez manualmente — no hay descubrimiento automático en runtime (cumple NFR-02).

### 7.3 Elección de algoritmo de firma
Ed25519 (vía `crypto` de Node, ya disponible sin dependencias nuevas) es preferible a HMAC compartido: la llave pública puede vivir en texto plano en la config de cada Edge sin riesgo, y el compromiso de un Edge no permite forjar tokens para otros Edges ni para el propio Directorio.

## 8. Decisiones Tomadas

- **Vinculación automática y silenciosa** tras el primer login manual exitoso vía SSO, sin pantalla de confirmación explícita — decisión de producto tomada explícitamente para priorizar UX; es igual de segura porque el usuario ya demostró ser dueño del usuario local al escribir su contraseña.
- **Sin comunicación servidor-a-servidor** entre Directorio y Edges — todo el contrato viaja por el navegador del usuario, preservando NFR-01 de la spec base (el Edge nunca depende de que el Directorio esté vivo para operar).
- **Firma asimétrica (Ed25519)**, no secreto compartido — evita que comprometer un Edge permita forjar tokens para otro.

## 9. Preguntas Abiertas

- TODO: ¿Cómo se distribuye/actualiza `DIRECTORY_SSO_PUBLIC_KEY` en cada Edge si el Directorio rota su llave privada alguna vez? Por ahora, rotación manual (actualizar la variable de entorno y reiniciar cada Edge); no se automatiza en esta v1.
- TODO: Igual que en la spec base, la política de kiosko (pantallas públicas que no deben exponer ni el selector ni la posibilidad de vincular cuentas) sigue pendiente y no bloquea esta v1.
