# SPEC: Smart Displays Android nativos de HomePilot V1

**Estado:** Aprobado
**Fecha:** 2026-09-26

## 1. Propósito y alcance

HomePilot administra pizarras Android como **Smart Displays** del hogar. ADB es un transporte privado de infraestructura, no un concepto de la API pública ni un permiso concedido al navegador. V1 debe permitir adoptar manualmente una pantalla por IP y puerto 5555, observar su estado, ejecutar un conjunto cerrado de acciones y mostrar/controlar un dashboard existente en modo Display. El resultado no depende de `has_template` ni del bridge ADB histórico.

La implementación se entrega por incrementos: adopción y control del dispositivo; Display Mode inicialmente de solo lectura; y, dentro de V1, interacción limitada con dispositivos y escenas autorizados. Cada incremento debe ser utilizable y probado antes de habilitar el siguiente.

### Fuera de alcance V1

- Descubrimiento o pairing ADB por mDNS, códigos o QR; queda para una versión posterior. La adopción inicial es manual `IP:5555` y puede exigir aprobar la huella del nuevo host ADB en Android.
- Comandos ADB, shell, `exec-out`, instalación de APK o transferencia de archivos desde la API pública; `/adb/execute` no se migra como capacidad pública.
- `open_url`, `reboot`, control remoto arbitrario, un frontend kiosk independiente, administración desde una sesión de display y rollback automático de dispositivos.
- Cambio de los tres perfiles de instalación existentes o migración automática/destructiva del bridge histórico.

## 2. Arquitectura y límites de confianza

Flujo de control: `UI/Display Mode → RouteHandler API → autorización por hogar y política → DeviceCommandService → AndroidDisplayDeviceDriver → cliente HTTP interno → homepilot-display-bridge → daemon ADB privado → Android`.

- `integrationSource = android-display` selecciona el driver; `type = smart_display` representa el dispositivo físico; `semanticType = smart_display` evita que la UI o el asistente lo clasifiquen como luz, botón o reproductor. Ningún identificador ADB forma la identidad primaria de HomePilot.
- El módulo de integración implementa puertos de dominio/aplicación; la traducción a ADB permanece en el bridge. El API no instala ADB ni aloja su daemon.
- En Linux, `homepilot-api` conserva `network_mode: host`. El bridge corre en un contenedor independiente en red Docker bridge, sin montaje del socket Docker ni publicación de TCP 5037. Su API HTTP se publica **únicamente** como `127.0.0.1:<puerto-host>:<puerto-contenedor>`; el API HomePilot la consume por loopback del host. El puerto exacto se reserva en implementación tras comprobar conflictos. Aislamiento de red y autenticación interna son ambos obligatorios.
- El bridge no acepta identificadores `IP:puerto` o cadenas shell en acciones. Solo una operación de conexión autorizada registra `sourceId` y endpoint validado; las acciones posteriores usan `sourceId` y comandos tipados. El API es la fuente de verdad de la configuración persistente; el registro operativo del bridge puede reconstruirse tras reiniciar.
- En Linux se debe probar realmente API → bridge y host → bridge por loopback; otro equipo LAN no debe alcanzar el HTTP del bridge ni TCP 5037, y el host no debe tener listener `*:5037`. La UI conserva sus rutas actuales.
- Docker Desktop no tiene que reproducir la topología Linux: su overlay de desarrollo conectará preferentemente API y bridge a una red bridge común, con DNS de servicio, sin publicar el HTTP del bridge al host. Mantendrá el mismo contrato semántico y autenticación interna; nunca publicará 5037. La topología efectiva de ambos overlays se validará antes de implementar.
- Los secretos del bridge no viajan al navegador, no se registran y se rotan al restaurar o sospechar compromiso.

## 3. Modelo de identidad y persistencia propuesta

Identidad estable: `devices.id` (UUID HomePilot). `home_id` y `room_id` determinan hogar y habitación. `adb_host`/`adb_port` son el endpoint actual, modificable sin reemplazar el dispositivo. `adb_serial` es un dato observado del transporte y puede reflejar `IP:puerto`; no es identidad estable. `android_id` se lee solo cuando el firmware lo permita, puede faltar o cambiar tras reset y nunca autoriza por sí mismo una sustitución silenciosa. Ante cambio de identidad observada en un endpoint ya adoptado, el dispositivo queda en estado de revisión y se requiere reconfirmación administrativa.

Se propone una migración futura con dos tablas, sujeta a revisión de migraciones y compatibilidad antes de crearla:

```sql
CREATE TABLE android_display_sources (
  device_id TEXT PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  home_id TEXT NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  adb_host TEXT NOT NULL,
  adb_port INTEGER NOT NULL DEFAULT 5555,
  dashboard_id TEXT REFERENCES dashboards(id) ON DELETE SET NULL,
  default_tab_id TEXT,
  kiosk_enabled INTEGER NOT NULL DEFAULT 0,
  orientation TEXT NOT NULL DEFAULT 'auto',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_android_display_sources_home ON android_display_sources(home_id);

CREATE TABLE android_display_observations (
  device_id TEXT PRIMARY KEY REFERENCES android_display_sources(device_id) ON DELETE CASCADE,
  adb_serial TEXT,
  android_id TEXT,
  model TEXT,
  manufacturer TEXT,
  android_version TEXT,
  resolution TEXT,
  density_dpi INTEGER,
  screen_state TEXT,
  foreground_package TEXT,
  connection_state TEXT NOT NULL,
  last_seen_at TEXT,
  last_error_code TEXT,
  updated_at TEXT NOT NULL
);
```

La relación `default_tab_id` debe validarse contra los tabs del `dashboard_id` en aplicación: los tabs actuales residen como JSON y no admiten FK individual. También se valida que el dashboard sea visible/autorizado para el hogar configurado; un FK por ID no basta. La implementación fijará índices/constraints adicionales para impedir adopciones duplicadas sin convertir la IP en identidad estable. `lastKnownState` contendrá, como máximo, un resumen sanitizado de disponibilidad/pantalla; no claves ADB, códigos de enrollment, tokens, URLs con credenciales ni configuración extensa.

Las sesiones de display y códigos de enrollment se guardarán en un repositorio de auth separado: solo hashes de secretos, `display_id`, `home_id`, alcance, expiración, revocación y auditoría mínima. No se insertan en `android_display_sources` ni se reutiliza una sesión de usuario/admin.

## 4. Comandos y capabilities

`smart_display` será una capacidad explícita, resuelta antes del dispatcher. Para esta integración se **rechaza** el fallback legacy de `CommandCapabilityValidator` cuando no haya capacidades. Se conserva el comando HomePilot existente `volume_set` con entero 0–100; el driver mapea ese valor al rango real del dispositivo, consultado o comprobado, sin asumir una escala Android fija.

Comandos nuevos V1: `wake`, `lock_screen`, `navigate_home`, `navigate_back`, `launch_app`, `show_dashboard`, `reload`. El driver solo acepta comandos declarados para `smart_display`; no interpreta `press`, `activate` ni parámetros extra como shell. `sleep`, `power_toggle`, `open_url` y `reboot` quedan excluidos del alcance operativo inicial de V1 y deben rechazarse en API y bridge, sin alias silenciosos.

| Comando | Parámetros/API semántica | Restricción |
| --- | --- | --- |
| `lock_screen`, `navigate_home`, `navigate_back`, `reload` | Sin parámetros | Traducción ADB tipada; `lock_screen` usa keyevent 223 y no promete suspensión ni apagar el display. |
| `wake` | Sin parámetros | Traducción interna a keyevent 224; no anunciarla como capacidad validada para Droidlogic hasta confirmar el efecto físico. |
| `volume_set` | `volume` entero 0–100 | Reutiliza contrato HomePilot; rango físico adaptado internamente. |
| `launch_app` | `packageId` | Solo paquetes presentes en allowlist administrada, con formato validado; nunca nombre de actividad/comando libre. Un paquete no autorizado se rechaza sin invocar ADB. |
| `show_dashboard` | `dashboardId`, `tabId?` | Exclusivamente IDs internos; backend valida hogar, dashboard y tab y construye la URL de Display Mode. Nunca acepta una URL arbitraria o un token en query. |

Ninguna traducción acepta shell concatenado con valores de usuario. Las operaciones destructivas o no idempotentes no se reintentan ciegamente. Comandos de navegación/volumen tienen timeout y límites de reintento; logs contienen identificadores HomePilot y códigos de error sanitizados, no parámetros sensibles. Cualquier URL externa enviada a `show_dashboard`, `open_url` o al contrato interno se rechaza.

Hallazgo de hardware Droidlogic Android 11: tras `input keyevent 223`, `mWakefulness=Awake` y `Display Power: state=ON`; por tanto, 223 solo se representa como `lock_screen`, nunca como `sleep`. `KEYCODE_POWER 26` dejó ADB `offline`; `power_toggle` permanece fuera de Fase 1/V1 y no puede implementarse automáticamente como suspensión o despertar. La presencia del comando interno `wake` no acredita soporte físico para este perfil.

## 5. Contratos de API propuestos

Rutas de dominio mediante `RouteHandler`, no registradas directamente en `ApiGateway`:

| API HomePilot | Actor y resultado |
| --- | --- |
| `POST /api/v1/android-displays` | Operador autorizado: valida hogar/habitación, IP literal LAN y puerto 5555, crea fuente pendiente; no ejecuta shell. |
| `POST /api/v1/android-displays/:id/test` | Operador autorizado: conecta, verifica autorización ADB y devuelve estado/metadatos sanitizados. |
| `GET /api/v1/android-displays`, `GET /api/v1/android-displays/:id` | Inventario/estado filtrado por hogar y permisos. |
| `PATCH /api/v1/android-displays/:id` | Operador autorizado: endpoint, ubicación, dashboard/tab, kiosk, allowlists; cambio de identidad observada exige reconfirmación. |
| `POST /api/v1/android-displays/:id/commands` | Comando cerrado, ownership, capability, permisos, auditoría y despacho al driver. Puede converger con `/devices/:id/command` solo tras demostrar idénticas garantías. |
| `POST /api/v1/android-displays/:id/enrollments` | Administrador del hogar crea desafío de un solo uso, con TTL corto y rate limit. |
| `POST /api/v1/display/enroll`, `POST /api/v1/display/session/revoke` | Canje/revocación de sesión exclusiva de display. Códigos y tokens no se registran. |
| `GET /api/v1/display/context`, `GET /api/v1/display/dashboard` | Proyección limitada al display/hogar/dashboard y widgets autorizados; no reutiliza sin filtro el listado administrativo de dashboards. |
| `POST /api/v1/display/actions/device`, `POST /api/v1/display/actions/scene` | Solo fase interactiva: targets/acciones permitidos y auditable; ownership + allowlist de display en backend. |

Errores tipados: validación 400, sin sesión 401, permiso 403, recurso no visible 404, conflicto de identidad 409, transporte desconectado 503 y timeout 504. No reflejar stdout/stderr ADB ni datos de pairing. Evitar rutas que permitan usar una sesión de display en APIs de administración.

Contrato **interno** del bridge, autenticado con secreto de servicio rotatorio, accesible solo por loopback del host en Linux y solo por la red Docker privada en Desktop: `GET /internal/v1/health`, `POST /internal/v1/displays/connect` (`sourceId`, IP LAN literal y puerto permitido), `GET /internal/v1/displays/:sourceId/state`, `GET /internal/v1/displays/:sourceId/metadata`, `POST /internal/v1/displays/:sourceId/actions` (enum semántico + parámetros validados), `DELETE /internal/v1/displays/:sourceId/connection`. El bridge rechaza hosts DNS, destinos fuera de subredes LAN autorizadas, identificadores no registrados, comandos desconocidos y campos extra. No existe `/adb/execute` en el nuevo servicio. La autenticación interna no sustituye el aislamiento de red.

## 6. Adopción y estados

Formulario: nombre, IP LAN literal, habitación y puerto 5555 por defecto. La prueba conecta y consulta `get-state`; si Android solicita autorización, mostrar `needs_authorization` y guía para aprobar en la pantalla sin exponer claves. Metadatos best-effort: modelo, fabricante, versión Android, resolución, densidad, estado de pantalla y aplicación activa. La ausencia de un dato no impide la adopción si el transporte y la autorización funcionan.

Estados operativos: `pending`, `connecting`, `needs_authorization`, `online`, `offline`, `identity_mismatch`, `disabled`. `online` exige prueba reciente, no solo un `adb connect` aceptado. Polling/keepalive de frecuencia acotada, serializado por pantalla; tras fallo aplicar backoff con jitter y no multiplicar procesos. La UI muestra última conexión y error general sin confundir pérdida de Internet con pérdida de LAN. Cambiar IP actualiza el endpoint y requiere nueva prueba; no recrea el `device_id`.

## 7. Claves ADB, secretos y recuperación

El bridge ejecutará ADB como usuario no-root con `HOME=/var/lib/homepilot-display-adb` estable. HomePilot administrará un bind mount dedicado `./data/android-display/adb-home/.android:/var/lib/homepilot-display-adb/.android` en Linux: se persiste el directorio `~/.android` completo, como mínimo `adbkey` y `adbkey.pub`, **nunca** en la imagen ni en el filesystem efímero. La ruta efectiva se verificará con la versión de platform-tools fijada antes de implementar. Directorios `0700`, clave privada `0600`, dueño UID/GID fijo no-root; sin acceso desde UI, API ni otros servicios. El daemon ADB debe usar únicamente esa identidad, sin conectarse al daemon del host ni publicar 5037. El secreto HTTP interno se guarda separadamente, con iguales restricciones y rotación.

El backup SQLite existente **no** se considera suficiente: el backup/recovery del appliance debe incorporar el directorio `~/.android` y el secreto interno en un paquete cifrado con acceso controlado, junto con una prueba de restauración aislada. Recrear o actualizar el contenedor conserva el mount y la autorización ADB; un reboot del appliance debe recuperarla igualmente. Nunca exponer claves por API, logs, `lastKnownState` ni exportaciones de dashboard. Si se pierden las claves, conservar el registro HomePilot y sus dashboards, marcar la pantalla `needs_authorization`, generar una nueva clave dentro del volumen persistente y solicitar aprobación manual en Android; no inventar una reconexión automática. Si solo se pierde el secreto HTTP, rotarlo coordinadamente con el API sin tocar la autorización ADB.

## 8. Display Mode, enrollment y local-first

Ruta UI propuesta: `/display/:displayId`, dentro de `apps/operator-console`, compartiendo `DashboardCanvas`, tabs, widgets y diseño responsive. Carcasa sin sidebar, configuración, edición, export/import ni accesos administrativos; ocupa la pantalla, tiene objetivos táctiles y estado offline claro. La tab inicial se toma de `default_tab_id` si aún existe y está autorizada; en otro caso usa una tab permitida determinística. `show_dashboard` recibe IDs y abre la URL construida por HomePilot. Refresh/reinicio recupera sesión y tab autorizada; nunca eleva privilegios por parámetros de URL.

El V1 debe funcionar por LAN sin Internet; Cloudflare no es requisito operativo. Para el **piloto interno NEZU**, se admite explícitamente `http://<homepilot-lan>:8080/display/...` como modo de laboratorio. El enrollment: administrador genera un desafío corto, la pizarra lo presenta, el administrador aprueba `displayId`/hogar/dashboard y el servidor emite sesión exclusiva, revocable, limitada a esos recursos y con expiración/renovación explícita. No se usan cuentas admin en la pizarra ni credenciales persistentes en `localStorage` o query. Cookie host-only, `HttpOnly`, `SameSite=Strict`, sin `Domain`, y alcance de ruta limitado a APIs de display; en HTTP LAN piloto no puede llevar `Secure`, mientras que en HTTPS sí debe llevarlo. La emisión decide el atributo con información de esquema confiable del proxy, nunca con un header externo no validado. Mutaciones requieren CSRF/Origin validado además de SameSite; respuestas sensibles `Cache-Control: no-store`. No mezclar la cookie display con el bearer de usuario normal.

**Riesgo del modo piloto:** HTTP LAN no cifra la cookie ni las acciones frente a un observador en la red. `HttpOnly` y `SameSite` no resuelven ese riesgo; no presentar el modo HTTP como transporte seguro ni habilitarlo para clientes. El piloto exige LAN confiable/segmentada, sesiones de alcance mínimo, expiración y revocación. **HTTPS local con nombre/certificado confiable es obligatorio en el roadmap de producción antes de declarar Display Mode customer-ready**, conservando operación sin Internet. La pérdida de Internet no invalida la sesión local ni exige Directory/Cloudflare; la pérdida del API LAN muestra una pantalla de reconexión sin controles ficticios.

La fase read-only solo admite widgets cuyas lecturas puedan proyectarse sin revelar datos administrativos; la fase interactiva añade acciones de dispositivos y escenas vinculadas al hogar y permitidas por la política de ese display. Cada widget (incluidos cámaras, actividad, asistente y estado del sistema) se audita por endpoints, datos y efectos. Un widget incompatible se oculta o se representa como no disponible: ocultar botones no sustituye autorización backend.

## 9. Permisos y threat model

Una sesión de display no es `admin`, `operator`, `parent`, `child` ni `guest`; es un principal separado. Solo puede leer su dashboard/tab y datos mínimos de widgets aprobados; en fase interactiva solo ejecutar targets/acciones explícitos. No puede administrar usuarios, Home Assistant, integraciones, configuración, backups, diagnósticos administrativos, ni editar/importar/exportar dashboards. Toda ruta comprueba principal, hogar, recurso y acción. Revocación, suspensión del dispositivo o cambio de hogar invalidan la sesión. La autorización genérica actual basada en ownership de usuario no se toma como permiso de display.

| Amenaza | Control exigido |
| --- | --- |
| Robo o acceso físico a la pizarra | Sesión sin rol administrativo, expiración, revocación inmediata, allowlist de acciones y bloqueo de edición. |
| Intercepción de HTTP LAN | Solo piloto interno en red confiable/segmentada; no es transporte seguro ni customer-ready; HTTPS local obligatorio para producción, sin secretos en URL ni almacenamiento web. |
| CSRF contra pantalla siempre abierta | SameSite estricto, comprobación Origin y token CSRF para mutaciones. |
| SSRF/ADB lateral desde API o bridge | IP literal LAN/subred permitida, puerto restringido, sourceId registrado, sin shell ni URL arbitraria, red/loopback aislados. |
| Fuga por widgets o endpoints existentes | Proyección de display y auditoría de cada widget; pruebas negativas de rutas administrativas. |
| Suplantación por cambio de IP/dispositivo | Identidad HomePilot independiente, huella observada best-effort, discrepancia bloqueante y reconfirmación. |
| Filtración de claves/tokens por backups/logs | Directorio privado, backup cifrado, secretos omitidos de logs/exports y pruebas de restauración. |
| Reintentos que repiten acciones físicas | Timeout, lock por pantalla, reintentos solo para operaciones seguras/idempotentes. |

## 10. Lifecycle, observabilidad y migración

El bridge es opcional en `bridge_ha`, `native_only` y `ha_companion`; no cambia instalaciones sin displays. Instalador/mantenimiento deben conservar la elección, añadir overlay solo si está habilitado, construirlo con el builder HomePilot, verificar health y aplicar el lifecycle activo/rollback existente a su imagen sin limpieza global. Logs rotados y métricas sanitizadas: conexiones por estado, latencia de acción, reconexiones, errores por código, último contacto y uso de recursos. Un bridge caído no derriba API/UI; los displays quedan offline. Recovery valida claves, token interno, reautorización y sesión/display sin afectar otros perfiles.

Migración NEZU controlada, **sin ejecución durante esta fase**: adoptar `192.168.1.37:5555` manualmente; verificar identidad/metadatos y comandos; abrir dashboard local, cortar Internet y validar lectura/control; reiniciar contenedor/appliance y restaurar backup aislado; retirar bridge/daemon antiguos solo con autorización operativa y plan de reversión; verificar ausencia de listener host `*:5037`; confirmar que ningún control de display depende de `has_template`. No duplicar emisores ADB simultáneos durante el corte.

## 11. Criterios de aceptación V1

- [ ] **AC01:** Display adoptado por IP:5555 tiene UUID HomePilot estable; cambiar endpoint no cambia identidad; discrepancia observada exige reconfirmación.
- [ ] **AC02:** Un HomePilot sin displays conserva los tres perfiles, arranque, salud y mantenimiento sin servicio ADB obligatorio.
- [ ] **AC03:** En Linux real, API → bridge y host → bridge funcionan por `127.0.0.1`; desde otro equipo LAN falla el acceso al HTTP del bridge y a TCP 5037; el host no presenta listener `*:5037`. El bridge posee daemon/claves propios y rechaza peticiones internas sin autenticación. En Desktop, API y bridge se comunican por red Docker común sin publicar el bridge y conservan el mismo contrato/autenticación.
- [ ] **AC04:** API y bridge rechazan shell/ADB arbitrario, comandos fuera de whitelist, parámetros extra, `sleep`, `power_toggle`, `open_url` y `reboot`; `lock_screen` traduce únicamente a keyevent 223 sin afirmar suspensión, `launch_app` rechaza paquetes fuera de allowlist y `show_dashboard` acepta solo IDs internos y genera su URL en HomePilot.
- [ ] **AC05:** `smart_display` tiene capacidades explícitas y falla cerrado aun si el validador legacy de otros dispositivos mantiene fallback.
- [ ] **AC06:** Prueba/adopción distingue online, offline, autorización pendiente e identidad diferente; metadatos ausentes no se inventan.
- [ ] **AC07:** Display Mode read-only reutiliza canvas/tabs/widgets aprobados sin sidebar ni edición; refresh y reinicio recuperan dashboard/tab y sesión válida.
- [ ] **AC08:** Sesión de display por enrollment one-shot solo accede a su hogar/dashboard; expira, se revoca y no usa cuenta admin, URL tokenizada ni `localStorage`.
- [ ] **AC09:** En fase interactiva, un display puede controlar únicamente dispositivos/escenas autorizados; peticiones directas a usuarios, HA, integraciones, backups, diagnósticos y edición reciben 401/403.
- [ ] **AC10:** Sin Internet, con LAN/API disponibles, lectura y control autorizados funcionan por URL local en el piloto; sin API LAN se muestra indisponibilidad sin simular éxito. Ningún despliegue para clientes se considera customer-ready sin HTTPS local probado offline.
- [ ] **AC11:** Recrear bridge y reiniciar appliance conservan autorización ADB desde `~/.android`; backup/recovery aislado preserva claves y secretos protegidos. La pérdida de claves deja configuración intacta y exige reautorización visible; nunca se exponen por API, logs o `lastKnownState`.
- [ ] **AC12:** Tras migración piloto, `192.168.1.37:5555` opera desde HomePilot, antiguo bridge/daemon se retiran de forma reversible, no existe host `*:5037` y no hay dependencia de `has_template`.
- [ ] **AC13:** Pruebas de amenazas cubren CSRF, fuga de widgets, IP/host inválido, sustitución de identidad, token interno incorrecto, timeout, retry y aislamiento entre hogares.

## 12. Decisiones pendientes de verificación técnica

Quedan cerrados: topología Linux loopback + autenticación, overlay Desktop en red compartida, persistencia de `~/.android`, `show_dashboard` por IDs, `launch_app` por allowlist, exclusión de `sleep`/`power_toggle`/`open_url`/`reboot`, piloto HTTP LAN limitado y HTTPS local obligatorio para clientes. En Droidlogic, 223 no suspendió la pantalla y 26 dejó ADB offline; `wake` aún requiere validación física antes de declararse capacidad soportada. Antes de las fases siguientes se debe verificar: integración API↔bridge, mecanismo concreto de Origin/CSRF y cookies, contenido inicial de la allowlist de paquetes, formato/custodia del backup cifrado, solución de certificados/nombre para HTTPS local offline y comportamiento de `reload`/`wake` en el firmware piloto. Si cualquiera exige alterar perfiles existentes o relajar aislamiento, detenerse y pedir aprobación arquitectónica.

Referencias técnicas para estas verificaciones: [ADB y depuración inalámbrica (Android)](https://developer.android.com/tools/adb), [carga de claves del cliente ADB (AOSP)](https://android.googlesource.com/platform/packages/modules/adb/+/HEAD/client/auth.cpp), [red host de Docker](https://docs.docker.com/engine/network/drivers/host/) y [publicación de puertos en loopback](https://docs.docker.com/engine/network/port-publishing/).
