# Android Display Bridge — Fase 1

Servicio opcional e interno. No instala un dispositivo en HomePilot ni habilita Display Mode. Solo acepta un `sourceId` UUID y una IP literal en los CIDR privados configurados. El puerto ADB V1 es 5555. No hay shell arbitrario, `/adb/execute`, `open_url`, `launch_app`, `show_dashboard` ni `reboot`.

## Contrato HTTP privado

Solo `GET /health` es anónimo. Las otras rutas exigen `X-HomePilot-Bridge-Token`; el secreto debe tener al menos 32 caracteres y no debe imprimirse. Cuerpos JSON tienen un máximo de 4096 bytes y campos exactos:

- `POST /internal/v1/displays/connect`: `{ "sourceId": "UUID", "host": "IP-LAN", "port": 5555 }`. Registra el endpoint en memoria y devuelve `online`, `needs_authorization` u `offline`.
- `GET /internal/v1/displays/:sourceId/state`: estado actual.
- `GET /internal/v1/displays/:sourceId/inspect`: metadatos best-effort; propiedades individuales no disponibles devuelven `null`.
- `POST /internal/v1/displays/:sourceId/actions`: `{ "name": "wake|lock_screen|navigate_home|navigate_back|volume_set", "params": {} }`; `volume_set` requiere `{ "volume": 0..100 }`. `sleep` se rechaza; no existe alias de compatibilidad.
- `DELETE /internal/v1/displays/:sourceId/connection`: elimina el registro efímero.

El registro de endpoints se reconstruirá desde la configuración HomePilot en una fase posterior; no es la identidad del display ni un almacén persistente. Errores y logs usan códigos sanitizados, nunca stdout/stderr ADB, token o contenido de claves.

## ADB, claves y red

La imagen fija Debian Bookworm `adb=1:29.0.6-28` y ejecuta el cliente/daemon como UID/GID 10001, `HOME=/var/lib/homepilot-display-adb`. Antes de abrir HTTP, valida el volumen `HOME/.android` y la versión de ADB. Si faltan **ambas** claves, ejecuta `adb keygen HOME/.android/adbkey` como usuario no-root. Si ya existen, no ejecuta `keygen`. Luego exige ambos archivos, verifica permisos/propiedad y usa `adb pubkey` sobre la clave privada para comprobar que corresponde a la pública persistida; una identidad parcial, corrupta o inconsistente detiene el arranque sin regeneración silenciosa. Solo después inicia el daemon. Una prueba local con la imagen real confirmó el primer bootstrap, los permisos `0700`/`0600`/`0644` y la misma identidad tras recrear el contenedor; la validación en MiniPC Linux sigue pendiente. El daemon 5037 pertenece solo al namespace del contenedor. Ni Dockerfile ni Compose publican ese puerto. El HTTP dentro del contenedor escucha en 5002; Linux lo publica exclusivamente en loopback del host y exige además token. Docker Desktop usa DNS sobre red Docker común, sin publicación de HTTP del bridge. Los comandos se construyen como listas de argumentos fijas y `subprocess` se invoca con `shell=False`.

Al habilitar Android Display, el instalador prepara `./data/android-display/adb-home/.android` con UID/GID 10001 y permisos `0700`; si el bind mount se crea como root o tiene permisos demasiado amplios, el bridge falla al iniciar. La clave privada conserva `0600`. No usar `/root/.android`, el daemon ADB del host ni un mount de Docker socket. Desktop usa un volumen administrado por Docker que copia el directorio preexistente de la imagen con su propietario no-root.

El directorio `~/.android` debe entrar en un backup cifrado/protegido y en una restauración aislada; **esa integración de backup aún no existe en Fase 1**. Recrear el contenedor sobre el mismo mount/volumen conserva la identidad. Perder el volumen o las claves exige nueva autorización visible en Android; nunca se copia una clave desde otro appliance. No incluir claves/token en API, logs, `lastKnownState`, imagen ni exportaciones.

Hallazgo Droidlogic Android 11: `input keyevent 223` se usa como bloqueo de pantalla; en la prueba real el equipo siguió reportando `mWakefulness=Awake` y `Display Power: state=ON`. Por ello `lock_screen` envía 223, pero **no** significa suspensión. `wake` conserva su traducción interna a keyevent 224; todavía no está validado físicamente como capacidad del perfil Droidlogic y no debe anunciarse como tal. `power_toggle`/KEYCODE_POWER 26 queda fuera de Fase 1/V1: la prueba real dejó ADB `offline`. No se usa como sustituto automático de `wake` o suspensión.

## Activación opcional y pendientes

El instalador y mantenimiento seleccionan automáticamente `docker-compose.android-display.yml` cuando `HOMEPILOT_ANDROID_DISPLAY_ENABLED=true`; en Desktop agregan también `docker-compose.android-display.desktop.yml` después del overlay Desktop del perfil. `HOMEPILOT_DISPLAY_BRIDGE_TOKEN` y `HOMEPILOT_DISPLAY_ADB_CIDRS` son obligatorios; el segundo debe ser una lista de subredes RFC1918 /16 o más estrechas (por ejemplo la subred real /24 del hogar). El instalador genera el token una vez si falta y nunca lo imprime. No se fija ninguna IP de pantalla. El API recibe URL/token del bridge; la identidad ADB y el token son secretos persistentes separados del backup SQLite. Sin backup cifrado probado de `~/.android`, la pérdida de claves exige reautorización física en Android.

El instalador/mantenimiento automático, lifecycle/rollback de esta imagen, backup/recovery operativo, driver HomePilot, migraciones, UI y sesiones de display quedan para fases posteriores. No usar este servicio en un cliente hasta que se validen en Linux real: API→bridge, host→loopback, rechazo desde LAN al HTTP/5037, ausencia de listener host `*:5037`, recreación/reboot y restauración de claves.

Referencias: [Debian Bookworm adb](https://packages.debian.org/bookworm/adb), [carga de clave ADB de usuario](https://android.googlesource.com/platform/packages/modules/adb/+/HEAD/client/auth.cpp), [Docker host networking](https://docs.docker.com/engine/network/drivers/host/) y [port publishing](https://docs.docker.com/engine/network/port-publishing/).
