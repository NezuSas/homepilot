# SPEC: Acceso Directory vinculado al hogar Edge V2

**Issue:** NezuSas/homepilot#7  
**Estado:** Borrador  
**Dependencia:** NezuSas/nezu-homepilot-directory#1  
**Fecha:** 2026-08-31

## Propósito

Un HomePilot Edge debe aceptar una identidad global de Directory únicamente cuando
la autorización fue emitida para **esa instalación y ese hogar**, sin volver a pedir
una contraseña local. La sesión creada conserva el aislamiento, RBAC, datos y
operación local del Edge.

## Punto de partida y riesgo

La integración actual verifica firma, expiración y replay, pero resuelve una cuenta
Directory mediante `directory_account_links` de cada Edge. Por ello exige un login
local inicial por hogar. El payload ya contiene `homeId`, pero el Edge no lo compara
con una identidad configurada de la instalación. Un token válido para un hogar no
puede convertirse en autorización intercambiable entre Edges.

## Alcance

- Configuración local, no secreta y verificable de `directoryHomeId` y `edgeId`
  emparejados por el instalador.
- Verificación criptográfica local de `iss`, `aud`, `homeId`, `edgeId`, `kid`,
  firma, TTL, `jti` y rol solicitado.
- Sesiones originadas por Directory diferenciadas de sesiones locales, con TTL
  corto y sin elevar permisos.
- Resolución explícita de rol Directory→rol local ya existente (`admin`, `parent`,
  `child`, `guest`, `operator`); no se añaden roles globales implícitos.
- Compatibilidad con login local y `directory_account_links` V1 existentes.
- Rutas y UI para informar acceso Directory no disponible sin exponer datos
  sensibles o interferir con la consola local.

## Flujo seguro

1. Directory redirige al Edge con una credencial de un único uso, firmada y con
   audiencia `edgeId`/`homeId`.
2. La UI extrae el valor, elimina la consulta de la URL inmediatamente y lo entrega
   por `POST` al API local. No se persiste en `localStorage`, logs o analytics.
3. El dominio de autenticación verifica todo el contrato antes de consultar o crear
   una sesión.
4. Solo tras validar la coincidencia de hogar, el puerto de sesiones crea una sesión
   con el rol solicitado y el máximo TTL de Directory.
5. El gateway devuelve la misma representación sanitizada de usuario que cualquier
   login local. El dominio no consulta Directory en tiempo de autenticación.

## Arquitectura por capas

| Capa | Responsabilidad |
| --- | --- |
| Interfaz | Captura segura del retorno Directory y muestra estados de acceso. |
| Dominio | Valida identidad, emparejamiento, rol y reglas de sesión. |
| Datos | Persiste configuración de emparejamiento, `jti` consumidos y procedencia de sesión. |
| Red | Traduce el contrato HTTP; no contiene decisión de autorización. |
| Seguridad/infraestructura | Carga claves públicas versionadas y secretos desde entorno protegido. |

## Compatibilidad, migración y reversión

- La migración es aditiva en SQLite y no modifica `users`, contraseñas, sesiones
  locales ni `directory_account_links` V1.
- Mientras un Edge no esté emparejado, conserva exactamente el flujo local/V1.
- Una bandera de configuración deshabilita el acceso Directory V2 inmediatamente;
  el login local sigue disponible y los datos nuevos quedan inertes.
- Los cambios de clave permiten una ventana de rotación por `kid`; una clave no
  reconocida se rechaza localmente.

## Criterios de aceptación

- [ ] AC1: una credencial Directory válida para este `homeId` y `edgeId` crea una
  sesión con el rol explícitamente autorizado, sin login local adicional.
- [ ] AC2: firma válida con otro hogar, Edge, audiencia o emisor se rechaza antes
  de crear sesión o tocar datos de dispositivo.
- [ ] AC3: ningún miembro sin rol Edge explícito recibe una sesión y ningún rol se
  eleva frente a la asignación del propietario.
- [ ] AC4: replay, expiración, `kid` desconocido y firma inválida devuelven error
  seguro, no revelan la credencial y no afectan una sesión local existente.
- [ ] AC5: deshabilitar Directory V2 deja operativos login, sesiones, control y
  automatizaciones locales.
- [ ] AC6: enlaces `directory_account_links` V1 y usuarios locales existentes
  mantienen su comportamiento durante la migración.
- [ ] AC7: las sesiones Directory respetan su TTL acotado y pueden revocarse al
  expirar/renovar sin borrar sesiones locales.
- [ ] AC8: pruebas cubren aislamiento entre dos hogares, rol, revocación, replay,
  regresión V1 y representación de error de UI.

## Seguridad y privacidad

- Las claves privadas permanecen en Directory; el Edge solo recibe claves públicas
  de confianza, con identificador de rotación.
- Se usan identificadores opacos; correo, contraseña y datos de dispositivos no
  forman parte del payload ni de las tablas de vínculo.
- Los eventos de auditoría almacenan resultado y IDs opacos, nunca el token/código.
- Los controles de dispositivos continúan autenticados por la sesión local creada
  por el dominio y se someten al RBAC existente.

## Fuera de alcance

- Sincronizar Directory con SQLite del Edge o con Home Assistant.
- Acceso de Directory a cámaras, logs, automatizaciones o secretos locales.
- Reemplazar el login local o eliminar vínculos V1 de forma automática.
