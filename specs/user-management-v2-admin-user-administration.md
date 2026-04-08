# User Management V2 (Admin User Administration)

## Contexto
HomePilot Edge cuenta con una sólida arquitectura `Auth & RBAC V1`, incluyendo manejo granular de base de datos para `users` y `sessions`. Sin embargo, no hay un área administrativa (UI ni API) para permitir a los administradores gestionar cuentas (crear nuevos operadores, revocar acceso). 

## Objetivo
Implementar la infraestructura API y la interfaz de usuario en la consola para la gestión completa del ciclo de vida del usuario por parte de un Administrador.

## Casos de Uso
1. **`listUsers`**: Devuelve una lista sanitizada de los usuarios registrados, indicando si tienen sesiones vivas y evitando exponer claves o secretos bajo cualquier contexto.
2. **`createUser`**:
   - Genera un nuevo usuario.
   - **Estrategia de contraseña**: **Obligatoriamente provista de forma explícita** por el Administrador creador (no admitiendo autogeneración por defecto).
   - Require validación de longitud mínima razonable (ej. 8 caracteres).
   - Asigna un rol (`admin` u `operator`). Requiere username estrictamente único.
3. **`updateUserRole`**: Modifica el rol a una cuenta existente (`admin` <-> `operator`).
4. **`setUserActiveState`**: Modifica la condición `isActive`. Desactivar usuarios fuerza automáticamente una revocación total sobre sus sesiones vivas simultáneamente.
5. **`revokeUserSessions`**: Invalida prematuramente TODAS las sesiones activas atadas al `targetUserId`. Aplica inmeditamente, incluyendo la sesión actual del administrador si `targetUserId === adminActorUserId`.
*(El reset admin-driven de contraseñas de terceros se deja explícitamente fuera de alcance en V2 para proteger la simplicidad local).*

## Sanitización y Shape Público de Usuario
La sanitización en la capa de Domain/Application no es opcional. El servicio SIEMPRE construirá y devolverá mediante su contrato público un Entity DTO exacto.
Bajo ninguna circunstancia la API escapará data como `passwordHash`, `tokens` en vivo ni detalles sensitivos de la DB (salts, config fields, etc).
El Shape mandatorio es:
```json
{
  "id": "uuid-...",
  "username": "operator1",
  "role": "operator" | "admin",
  "isActive": true,
  "createdAt": "iso-date",
  "updatedAt": "iso-date",
  "hasActiveSessions": true
}
```

## Reglas de Seguridad y Mínimo Admin (Anti-Lockout)
El core defiende en base a una **Minimum Admin Rule**. Esto rige casos concretos sobre otros o *sobre acciones a sí mismo (Self-Actions)*:
- Un administrador NO PUEDE desactivarse a sí mismo si es el último admin activo en toda la DB.
- Un administrador NO PUEDE cambiar su propio rol a `operator` si es el último admin activo.
- Un administrador NO PUEDE desactivar a otro administrador distinto si la acción resultare colateralmente en 0 administradores activos globales.
- Un administrador NO PUEDE cambiar el rol de otro administrador distinto a `operator` si ello resultare en 0 administradores activos globales.
- **Acciones Permitidas sobre Sí Mismo**: Si la regla de Mínimo Admin resista el cómputo final sin caer a cero, el admin puede automodificar su rol o auto-desactivarse. Revocar las propias sesiones se admite libre e incondicionalmente, matando el acceso actual de su propia consulta por consecuencia.

## Diccionario de Errores Críticos (Domain Errors)
A lo largo de las validaciones, el capa de Servicio arrojará los siguientes Errores Nominales para mapeo en UI/HTTP:
- `USERNAME_TAKEN`: Violación Unique Constraint.
- `USER_NOT_FOUND`: Entidad inexistente.
- `MINIMUM_ADMINS_VIOLATED`: Salvaguarda activada previniendo la extinción del grupo Admin Activo.
- `CANNOT_DEACTIVATE_SELF_LAST_ADMIN`: Variación explicita para UX.
- `INVALID_ROLE`: El Payload falló Type-check estricto.
- `INVALID_INPUT`: Validaciones miscelaneas (ej. Passwords muy cortas, formato inaceptable).

## Observabilidad y Trazas
Se inyectarán logs pre-estructurados con tipos fijos al Activity Log principal. Nunca se guardan tokens.
El payload serializado en el bloque `data` contendrá siempre que aplique: `{ adminActorUserId, targetUserId, previousRole, newRole, newIsActive, revokedSessionsCount }`:
- `USER_CREATED`
- `USER_ROLE_CHANGED`
- `USER_DEACTIVATED`
- `USER_ACTIVATED`
- `USER_SESSIONS_REVOKED`

---
