# HomePilot — Guia tecnica y operativa

## Proposito de la aplicacion

HomePilot es la consola local de Nezu para operar una casa inteligente desde un miniPC/edge local. La aplicacion integra dispositivos traidos desde Home Assistant, permite organizarlos por hogar y habitacion, controlarlos desde una interfaz web, ejecutar escenas y automatizaciones, y usar un asistente de voz local activado por `Ok Nezu`.

El objetivo actual del producto es que el control principal de la casa sea local, modular y mantenible:

- La UI corre como consola web responsive.
- El backend expone una API local en Fastify.
- La persistencia usa SQLite local.
- Home Assistant actua como puente de integracion con dispositivos reales.
- STT, TTS y LLM pueden correr localmente mediante servicios separados.
- Docker Compose levanta el stack completo para desarrollo y validacion local.

## Resumen del runtime local

| Servicio | Contenedor | Puerto host | Rol |
|---|---:|---:|---|
| API HomePilot | `homepilot-api` | `3000` | API HTTP, WebSocket, auth, dispositivos, escenas, automatizaciones, asistente |
| UI HomePilot | `homepilot-ui` | `80` | Consola web de operador |
| Home Assistant | `homeassistant` | `18123` | Bridge local con dispositivos reales |
| Ollama | `ollama` | `11434` | Modelo local para razonamiento del asistente |
| TTS Piper | `homepilot-tts` | `8088` | Sintesis de voz local |
| STT Whisper | `homepilot-stt` | `8090` | Transcripcion local de audio |

URLs utiles en local:

```bash
http://localhost
http://localhost:3000/health
http://localhost:18123
http://localhost:11434
http://localhost:8088/health
http://localhost:8090/health
```

## Estructura principal del repositorio

| Ruta | Uso |
|---|---|
| `apps/api` | Gateway HTTP, rutas API y handlers Fastify-compatible |
| `apps/operator-console` | Frontend React/Vite de la consola |
| `packages/auth` | Usuarios, sesiones, roles, guardias de acceso |
| `packages/devices` | Dominio de dispositivos, escenas, automatizaciones y ejecuciones |
| `packages/integrations/home-assistant` | Cliente, configuracion y sync con Home Assistant |
| `packages/topology` | Hogares, habitaciones y dashboards |
| `packages/assistant` | Hallazgos, memoria, feedback y aprendizaje del asistente |
| `packages/system-vars` | Variables persistentes para automatizaciones/contexto |
| `packages/shared` | Infraestructura comun: DB, migraciones, eventos, errores |
| `infrastructure/assemblers` | Ensamble de modulos e inyeccion de dependencias |
| `migrations` | Evolucion de esquema SQLite |
| `services/stt-whisper` | Servicio STT local |
| `services/tts-piper` | Servicio TTS local |
| `docker` | Dockerfiles de API/UI/servicios |
| `docs` | Documentacion tecnica y operativa |
| `specs` | Especificaciones funcionales y criterios de aceptacion |

## Backend

El backend corre en Node.js con TypeScript y Fastify v5. El gateway principal monta handlers de rutas en `apps/api/routes` sin registrar logica de dominio directamente en `ApiGateway.ts`.

Flujo general de una solicitud:

1. La UI llama un endpoint `/api/v1/*`.
2. El gateway aplica CORS, parseo y dispatch al `RouteHandler` correspondiente.
3. La ruta valida metodo, path, payload y permisos.
4. El caso de uso o servicio de aplicacion ejecuta la accion.
5. Los repositorios persisten o consultan SQLite.
6. Si aplica, se llama un driver/integracion externa, por ejemplo Home Assistant.
7. La respuesta vuelve a la UI con estado actualizado o error normalizado.

Rutas principales:

| Ruta | Archivo | Responsabilidad |
|---|---|---|
| `/api/v1/auth/*` | `AuthRoutes.ts` | Login, logout, sesion actual y cambio de password |
| `/api/v1/admin/users/*` | `AdminRoutes.ts` | Gestion de usuarios y roles admin |
| `/api/v1/devices/*` | `DeviceRoutes.ts` | Inventario, importacion, refresh, control, eliminacion |
| `/api/v1/devices/:id/camera/*` | `CameraRoutes.ts` | Sesion autenticada y proxy local de snapshot, MJPEG y HLS de camaras HA o camaras nativas |
| `/api/v1/scenes/*` | `SceneRoutes.ts` | Crear, listar y ejecutar escenas |
| `/api/v1/automations/*` | `AutomationRoutes.ts` | Reglas de automatizacion |
| `/api/v1/executions/*` | `ExecutionRoutes.ts` | Historial de ejecuciones |
| `/api/v1/topology/*` | `TopologyRoutes.ts` | Hogares y habitaciones |
| `/api/v1/dashboards/*` | `DashboardRoutes.ts` | Dashboards configurables |
| `/api/v1/settings/*` | `SettingsRoutes.ts` | Configuracion de Home Assistant |
| `/api/v1/system/*` | `SystemRoutes.ts` | Estado operativo, onboarding y diagnostico |
| `/api/v1/system-variables/*` | `SystemVariableRoutes.ts` | Variables persistentes globales o por hogar |
| `/api/v1/assistant/*` | `AssistantRoutes.ts` | Chat, STT, TTS, hallazgos y acciones del asistente |
| `/api/v1/media/*` | `MediaRoutes.ts` | Recursos multimedia servidos por API |

## Autenticacion y roles

La autenticacion usa usuarios locales en SQLite y sesiones opacas. Los roles vigentes son:

| Rol | Uso |
|---|---|
| `admin` | Superusuario tecnico con acceso completo |
| `operator` | Rol legacy/soporte con permisos equivalentes a admin para compatibilidad |
| `parent` | Dueno del hogar; administra funciones del hogar sin configuracion tecnica completa |
| `child` | Miembro familiar con control de dispositivos y dashboards |
| `guest` | Invitado con acceso limitado |

El backend aplica una regla critica: siempre debe existir al menos un administrador activo. No se permite degradar o desactivar el ultimo admin porque eso podria bloquear el acceso al sistema.

### Por que existe `admin/admin`

`admin/admin` existe unicamente como atajo de desarrollo local. No es una estrategia aceptable para entregar el producto a un cliente final.

En desarrollo local se puede activar:

```bash
HOMEPILOT_DEV_BOOTSTRAP=true
```

Cuando esa variable esta en `true` y la base de datos esta vacia, el bootstrap crea el usuario:

```text
usuario: admin
password: admin
```

Esto existe para acelerar pruebas locales en Docker/WSL, reiniciar bases de datos, validar pantallas y evitar depender de una clave aleatoria impresa una sola vez en logs. El propio backend emite una advertencia indicando que no es seguro para produccion.

Cuando `HOMEPILOT_DEV_BOOTSTRAP` no esta en `true` y la DB esta vacia, el sistema no crea un admin oculto ni imprime claves de cliente en logs. La UI detecta que no hay usuarios y muestra el flujo de primer arranque para crear el administrador local.

Estado actual importante:

- Para desarrollo propio, `HOMEPILOT_DEV_BOOTSTRAP=true` es practico porque permite entrar con `admin/admin`.
- Para produccion real, `admin/admin` no debe usarse.
- El flujo de cliente/instalador crea el primer admin desde la UI.
- El endpoint de bootstrap del primer admin solo funciona cuando `users.count() === 0`; despues queda cerrado.
- La UI inicia sesion automaticamente tras crear el primer admin y continua al onboarding protegido de Home Assistant.

En resumen: hoy se usa `admin/admin` porque el entorno de Oscar es desarrollo local y se necesita entrar facil para probar. No se debe vender ni desplegar asi a cliente.

## Integracion con Home Assistant

Home Assistant es el bridge local para hablar con dispositivos reales. En Docker Compose el backend usa:

```bash
INTERNAL_HA_URL=http://homeassistant:8123
```

Desde el navegador o Windows se entra a Home Assistant por:

```bash
http://localhost:18123
```

### Camaras Home Assistant

Las entidades con dominio `camera.*` se resuelven mediante el perfil modular `camera`, incluso si fueron importadas antes de que existiera ese perfil y su `type` persistido era generico. El dashboard selecciona `CameraDeviceTile` por capability, no por marca ni por un nombre concreto.

Flujo de medios:

1. La UI solicita `GET /api/v1/devices/:id/camera/session` usando la sesion HomePilot.
2. `CameraRoutes` valida que el dispositivo corresponda a `ha:camera.*` y consulta su estado actual.
3. HomePilot emite un token corto firmado para ese dispositivo; el token de larga duracion de Home Assistant permanece en el backend.
4. HomePilot solicita por WebSocket el stream HLS que Home Assistant usa en su propio frontend. Si existe, la sesion incluye una ruta HLS local.
5. `CameraRoutes` reescribe manifiestos y registra segmentos HLS con identificadores temporales; la URL HLS interna y el token administrativo de Home Assistant no llegan al navegador.
6. La UI reproduce HLS con soporte nativo o `hls.js`; si falla, intenta MJPEG y finalmente snapshots periodicos.
7. El visor ampliado reemplaza temporalmente el stream de la tarjeta para no mantener dos conexiones simultaneas.
8. Snapshot, MJPEG y HLS usan `Cache-Control: no-store` y se cancelan cuando el navegador cierra la conexion.

La UI representa carga, error e indisponibilidad sin convertir la camara en un interruptor. Presionar una camara disponible abre el visor responsive de pantalla completa y `Escape` lo cierra.

### Cliente con Home Assistant existente

En instalaciones reales de cliente, HomePilot no debe crear ni reemplazar el Home Assistant del cliente si ya existe uno operativo. El appliance debe desplegar solamente HomePilot API, UI, STT, TTS y Ollama, y enlazarse al Home Assistant existente mediante URL local y token de larga duracion.

Patron recomendado cuando Home Assistant corre en el host o en otro contenedor ya existente de la miniPC:

```bash
INTERNAL_HA_URL=http://host.docker.internal:8123
```

El `docker compose` usado para cliente debe incluir `extra_hosts: host.docker.internal:host-gateway` en `homepilot-api`. No debe incluir un servicio `homeassistant` nuevo si el cliente ya tiene el suyo.

En el onboarding de HomePilot se debe usar:

```text
URL local: http://host.docker.internal:8123
Token: token de acceso de larga duracion creado en el Home Assistant del cliente
```

Si Home Assistant esta en la misma red Docker y su contenedor se llama `homeassistant`, tambien se puede validar:

```text
http://homeassistant:8123
```

La URL publica o de Cloudflare del cliente sirve para que el instalador entre a Home Assistant y cree el token, pero HomePilot debe preferir la ruta local de baja latencia desde la miniPC.

### Acceso por SSH/Cloudflare y puertos

Cuando se accede a una miniPC remota por Cloudflare SSH, no se debe asumir que `localhost:3000` o `localhost:8123` en la laptop pertenecen a la miniPC. Pueden estar ocupados por servicios locales del instalador.

Puertos recomendados para tunel:

| Servicio remoto | Puerto remoto | Puerto local recomendado | URL local del instalador |
|---|---:|---:|---|
| HomePilot UI | `8080` | `8080` | `http://localhost:8080` |
| HomePilot API directa (solo diagnostico) | `3000` | `13000` | `http://localhost:13000` |
| Home Assistant existente | `8123` | `18123` | `http://localhost:18123` |

Tunel recomendado para HomePilot:

```bash
ssh -i ~/.ssh/codex_nezu_tmp \
  -o ProxyCommand="cloudflared access ssh --hostname %h" \
  -L 8080:127.0.0.1:8080 \
  nezu@ssh.nezuecuador.com
```

Tunel recomendado para Home Assistant del cliente:

```bash
ssh -i ~/.ssh/codex_nezu_tmp \
  -o ProxyCommand="cloudflared access ssh --hostname %h" \
  -L 18123:127.0.0.1:8123 \
  nezu@ssh.nezuecuador.com
```

La UI de produccion usa el mismo origen para UI, API y WebSocket. Nginx envia `/api/*`, `/health` y `/ws` al contenedor `homepilot-api`, por lo que no se necesita un segundo tunel ni recompilar con una URL local. `VITE_API_URL` debe quedar vacia:

```bash
VITE_API_URL=
```

#### Publicacion de HomePilot con Cloudflare Tunnel

En el mismo tunel donde existe `ha-smart.nezuecuador.com`, agrega otra **Published application route** con estos valores:

| Campo Cloudflare | Valor recomendado |
|---|---|
| Subdomain | `homepilot` |
| Domain | `nezuecuador.com` |
| Path | vacio |
| Service type | `HTTP` |
| URL | `127.0.0.1:8080` |

El resultado es `https://homepilot.nezuecuador.com`. No se debe publicar el puerto `3000`: el mismo hostname atiende UI, API, camaras HLS y WebSocket mediante Nginx. Para un sistema residencial se recomienda crear una aplicacion de Cloudflare Access para ese hostname y permitir solamente las identidades autorizadas; el login propio de HomePilot se mantiene como segunda capa.

Para validar la instalacion desde la miniPC:

```bash
bash scripts/check-edge-install.sh docker-compose.office.yml
```

### Perfiles de instalación de HomePilot

HomePilot se instala con un perfil explícito. El perfil queda almacenado en `HOMEPILOT_INSTALLATION_PROFILE` y el onboarding aplica solamente los requisitos de dicho perfil.

| Perfil | Cuándo usarlo | Compose | Home Assistant |
|---|---|---|---|
| `bridge_ha` | El cliente ya tiene Home Assistant. | `docker-compose.office.yml` | Se conserva y se enlaza mediante token. |
| `native_only` | El cliente empieza desde cero con integraciones nativas. | `docker-compose.office.yml` | No se instala ni se exige. |
| `ha_companion` | El cliente solicita expresamente Home Assistant junto a HomePilot. | `docker-compose.yml` | Lo administra ese compose. |

No se debe cambiar de perfil editando un sistema en funcionamiento sin revisar la topología y el `.env`. El instalador falla de forma segura cuando `--profile` no coincide con el perfil ya guardado.

#### Cliente con Home Assistant existente (`bridge_ha`)

El repositorio incluye un compose separado para cliente: `docker-compose.office.yml`. No declara un servicio `homeassistant`; por ello no crea, actualiza ni reemplaza el Home Assistant existente. La preparacion se hace desde la raiz del repositorio en la miniPC:

```bash
git pull --ff-only
bash scripts/install-edge-office.sh --profile bridge_ha --clean --start
```

El script muestra espacio libre y consumo de Docker, detecta Home Assistant de forma no destructiva, revisa los puertos de HomePilot, crea `.env` desde `.env.office.example` solo si falta y valida el compose. `--clean` elimina exclusivamente cache de build e imagenes colgantes de Docker; nunca elimina contenedores, volumenes, bases de datos ni el Home Assistant del cliente. `--start` construye e inicia HomePilot despues de pedir confirmacion. Para automatizacion controlada se puede usar `--clean --start --yes`.

#### Instalación nativa sin Home Assistant (`native_only`)

Para una miniPC sin Home Assistant, HomePilot queda listo para integrar protocolos locales compatibles desde su propia consola. El onboarding no pedirá URL ni token de Home Assistant:

```bash
git pull --ff-only
bash scripts/install-edge-office.sh --profile native_only --clean --start
```

El script crea `.env` desde `.env.native.example` cuando no existe y usa el mismo compose liviano que no declara un servicio `homeassistant`.

#### Home Assistant opcional administrado por HomePilot (`ha_companion`)

Este perfil debe usarse únicamente cuando el cliente solicita expresamente el companion. Inicia el servicio incluido en `docker-compose.yml` y usa `.env.example`:

```bash
git pull --ff-only
bash scripts/install-edge-office.sh --profile ha_companion --clean --start
```

No se debe seleccionar este perfil sobre una miniPC que ya tiene un Home Assistant de cliente sin revisar antes puertos, datos y la topología existente.

#### Diagnostico operativo con `--status`

La opcion `--status` sirve para revisar una instalacion existente sin modificarla:

```bash
bash scripts/install-edge-office.sh --profile bridge_ha --status
```

Esta opcion no limpia Docker, no construye imagenes, no crea archivos y no inicia ni reinicia contenedores. Comprueba:

- Estado de los contenedores de API, UI, Ollama, STT y TTS.
- Puerto host configurado para API, UI, Ollama, STT y TTS, y puerto comprobado para Home Assistant.
- Healthchecks disponibles para API, STT y TTS.
- Respuesta HTTP de API, UI, STT y TTS.
- Conectividad con Home Assistant solo en perfiles que lo requieren; en `native_only` informa que no es necesario.

Si todos los componentes responden correctamente, el script termina con codigo de salida `0`. Si falta un servicio, un healthcheck falla o un endpoint no responde, termina con un codigo distinto de `0`; esto permite usarlo tanto de forma manual como en monitoreo o automatizacion.

`--status` no debe combinarse con `--clean`, `--start` ni `--api-url`. Para instalar o reconstruir el sistema se usa `--start`; para consultar su salud sin hacer cambios se usa `--status`.

Despues de conceder permiso de ejecucion, ambos formatos son equivalentes:

```bash
chmod +x scripts/install-edge-office.sh
./scripts/install-edge-office.sh --status
```

El prefijo `bash` solo es necesario cuando el archivo todavia no tiene permiso de ejecucion o cuando se desea indicar explicitamente el interprete.

#### Mantenimiento despues de cada build

En miniPCs con disco limitado, Docker puede acumular cache de `buildx`, capas intermedias, imagenes antiguas y contenedores detenidos. Para evitar que cada compilacion deje residuos, el repositorio incluye:

```bash
bash scripts/homepilot-maintenance.sh --profile bridge_ha --deploy --yes
```

Ese comando ejecuta un ciclo seguro:

1. Muestra espacio libre y consumo actual de Docker.
2. Limpia cache de BuildKit/buildx conservando un maximo configurable.
3. Elimina imagenes no usadas, contenedores detenidos y redes no usadas.
4. Construye e inicia HomePilot con `docker-compose.office.yml`.
5. Repite la limpieza segura despues del build.
6. Muestra el espacio disponible final.

Por defecto conserva hasta `2GB` de cache util:

```bash
bash scripts/homepilot-maintenance.sh --profile bridge_ha --deploy --keep-storage 2GB --yes
```

Para solo limpiar sin reconstruir:

```bash
bash scripts/homepilot-maintenance.sh --profile bridge_ha --clean --yes
```

Para diagnosticar sin modificar nada:

```bash
bash scripts/homepilot-maintenance.sh --profile bridge_ha --status
```

El script no ejecuta `docker volume prune` y no borra bases de datos ni volumenes. Si los logs de Docker crecieron demasiado, se puede vaciarlos explicitamente:

```bash
bash scripts/homepilot-maintenance.sh --profile bridge_ha --clean --truncate-logs --yes
```

El comando `--truncate-logs` solo trunca archivos `*-json.log`; no borra contenedores ni datos persistentes.

Usa la plantilla correspondiente al perfil: `.env.office.example` para `bridge_ha`, `.env.native.example` para `native_only` y `.env.example` para `ha_companion`. Sus campos que deben verificarse por instalación son:

| Variable | Uso |
|---|---|
| `HOMEPILOT_INSTALLATION_PROFILE` | Perfil explícito de la instalación: `bridge_ha`, `native_only` o `ha_companion`. |
| `INTERNAL_HA_URL` | `http://host.docker.internal:8123` si HA esta disponible desde el host de la miniPC. Cambiarla si la topologia del cliente usa otra ruta local. |
| `VITE_API_URL` | Vacia por defecto: UI, API y WebSocket comparten el origen de HomePilot. Definirla solo para una API publicada por separado; cambiarla exige reconstruir `homepilot-ui`. |
| `HOMEPILOT_*_PORT` | Puertos publicados; ajustarlos solo si el diagnostico indica conflicto. |
| `HOMEPILOT_DEV_BOOTSTRAP` | Debe permanecer `false` en cliente: el primer administrador se crea en la UI, no existe una clave impresa en logs. |

Si se modifica `VITE_API_URL`, reconstruir la UI:

```bash
docker compose -f docker-compose.office.yml up --build -d homepilot-ui
```

El flujo esperado para dispositivos importados es:

1. Configurar URL y token de Home Assistant en ajustes.
2. Descubrir entidades disponibles.
3. Importar la entidad como device HomePilot.
4. Asignarla a una habitacion o dejarla en inbox.
5. Controlarla desde dashboard, detalle, escenas, automatizaciones o voz.
6. Si el dispositivo se rompe o desaparece en Home Assistant, HomePilot debe reflejarlo como no disponible y permitir refresh o eliminacion cuando aplique.

Campos importantes de `devices`:

- `external_id`: entidad o identificador externo de Home Assistant.
- `integration_source`: fuente de integracion; hoy por defecto `ha`.
- `last_known_state`: estado JSON persistido.
- `invert_state`: permite corregir dispositivos que reportan logica invertida, por ejemplo cortinas.
- `semantic_type`: ayuda a interpretar el dispositivo de forma modular, por ejemplo interruptor, cortina, luz u otra categoria.

## Dispositivos y modularidad

La UI y el backend no deben asumir que todos los dispositivos son iguales. La direccion actual del codigo es tratar cada device segun sus capacidades y su perfil:

- Interruptores inteligentes: encendido/apagado.
- Luces: encendido/apagado y, cuando exista soporte, intensidad/color.
- Cortinas/covers: abrir, cerrar, detener, posicion y posible inversion de estado.
- Otros dispositivos futuros: deben agregarse como perfiles/capacidades sin romper los existentes.

Buenas reglas para extender devices:

- No codificar reglas por marca directamente en una pantalla.
- Preferir capacidades normalizadas.
- Mantener el estado crudo de Home Assistant en `last_known_state`.
- Mapear diferencias de marca en adaptadores o perfiles, no en componentes visuales generales.
- Si un dispositivo deja de responder, mostrar estado no disponible en vez de esconderlo.

## Asistente de voz

El asistente esta pensado para escuchar el activador `Ok Nezu` y despues procesar la orden. El stack local relacionado es:

| Pieza | Servicio | Funcion |
|---|---|---|
| Wake/listener UI | `GlobalWakeListener.tsx` | Captura activador y audio desde navegador |
| STT | `homepilot-stt` | Convierte audio a texto con Whisper local |
| Assistant API | `AssistantRoutes.ts` | Orquesta transcripcion, intencion, respuesta y acciones |
| LLM | `ollama` | Razonamiento local si esta habilitado |
| TTS | `homepilot-tts` | Respuesta de voz con Piper |

Variables relevantes en Docker Compose:

| Variable | Uso |
|---|---|
| `OLLAMA_ENABLED` | Activa o desactiva integracion LLM con Ollama |
| `OLLAMA_BASE_URL` | URL interna de Ollama desde API |
| `OLLAMA_MODEL` | Modelo usado por el asistente |
| `OLLAMA_TIMEOUT_MS` | Timeout de llamadas al modelo |
| `ASSISTANT_PLANNER_V2_SHADOW` | Ejecuta planner V2 en modo sombra para comparar resultados |
| `ASSISTANT_PLANNER_V2_EXECUTION` | Permite que planner V2 ejecute acciones cuando esta habilitado |
| `STT_PROVIDER` | Proveedor STT, por ejemplo `whisper-local` |
| `STT_BASE_URL` | URL interna del servicio STT |
| `STT_TIMEOUT_MS` | Timeout de transcripcion |
| `WHISPER_HOTWORDS` | Pistas de activador, incluye variantes de `Ok Nezu` |
| `TTS_PROVIDER` | Proveedor TTS, por ejemplo `piper` |
| `TTS_BASE_URL` | URL interna del servicio TTS |
| `PIPER_VOICE_ES` | Voz Piper en espanol |
| `PIPER_VOICE_EN` | Voz Piper en ingles |

## Frontend

La consola esta en `apps/operator-console` y usa React, TypeScript y Vite. La UI se organiza por vistas, componentes reutilizables, tokens de diseno y llamadas API centralizadas.

Piezas principales:

| Area | Ruta | Uso |
|---|---|---|
| App shell | `App.tsx` | Layout global, navegacion y gates por rol |
| Config API | `config.ts` | URLs de endpoints |
| Design tokens | `design-system/tokens.ts` | Colores, radios, sombras y escalas |
| Componentes base | `components/ui` | Botones, cards, inputs, modales, selects |
| Inicio | `views/DashboardView.tsx` y componentes dashboard | Cabecera del hogar, escenas favoritas, automatizaciones favoritas y sugerencias inteligentes |
| Tableros | `views/DashboardsView.tsx` y `views/dashboards/*` | Navegacion por usuario, pestañas estilo Home Assistant, secciones editables y tarjetas modulares |
| Devices/inbox | `views/InboxView.tsx` | Importacion y gestion de devices |
| Home Assistant | `views/HomeAssistantSettingsView.tsx` | Configurar bridge y discovery |
| Escenas | `views/ScenesView.tsx` | Listado y ejecucion de escenas |
| Automatizaciones | `views/AutomationsView.tsx` y workbench | Reglas y builder |
| Asistente | `views/AssistantView.tsx` | Chat/acciones del asistente |
| Usuarios | `views/UsersView.tsx` | Gestion RBAC |
| Diagnostico | `views/DiagnosticsView.tsx` | Salud del sistema |

Reglas actuales de UI:

- Mantener datos visibles durante refresh.
- No mostrar skeletons despues de la primera carga.
- Evitar dependencias inestables en `useEffect`.
- Evitar selectores Zustand que devuelvan arrays/objetos nuevos en cada render.
- Mantener componentes responsive para celular, tablet y escritorio.
- Usar tokens del design system en vez de colores sueltos.

## Base de datos

La base de datos es SQLite local. En Docker:

```bash
HOMEPILOT_DB_PATH=/app/data/homepilot.db
```

Ese archivo vive en el volumen montado:

```bash
./data:/app/data
```

Por eso, en el host queda en:

```bash
data/homepilot.db
```

Las migraciones se guardan en `migrations/` y se registran en `_migrations`. No se debe editar la base manualmente para cambios de esquema; los cambios deben entrar como migraciones.

### Tablas principales

| Tabla | Proposito |
|---|---|
| `_migrations` | Registro interno de migraciones aplicadas |
| `homes` | Hogares definidos en el edge |
| `rooms` | Habitaciones asociadas a un hogar |
| `devices` | Inventario de dispositivos, estado persistido, habitacion y metadata de integracion |
| `automation_rules` | Reglas de automatizacion con trigger/action JSON |
| `activity_logs` | Auditoria append-only de eventos y acciones |
| `ha_settings` | Configuracion singleton de Home Assistant |
| `users` | Usuarios locales, rol, hash de password y estado activo |
| `sessions` | Sesiones opacas por token |
| `system_setup` | Estado de inicializacion/onboarding del edge |
| `scenes` | Escenas con arreglo JSON de acciones |
| `dashboards` | Dashboards configurables por usuario |
| `assistant_findings` | Hallazgos/sugerencias proactivas del asistente |
| `assistant_feedback_events` | Feedback para mejorar hallazgos del asistente |
| `assistant_drafts` | Drafts estabilizados por fingerprint |
| `system_variables` | Variables globales o por hogar para automatizacion/contexto |
| `execution_records` | Resultado historico de ejecuciones manuales, escenas o automatizaciones |
| `assistant_memory` | Memoria conversacional y preferencias por usuario |
| `assistant_learning_events` | Eventos de aprendizaje/correccion del asistente |

### Columnas clave por dominio

| Dominio | Tablas | Notas |
|---|---|---|
| Topologia | `homes`, `rooms` | `rooms.home_id` depende de `homes.id` |
| Devices | `devices` | `UNIQUE(home_id, external_id)` evita duplicados por discovery |
| Automatizacion | `automation_rules`, `system_variables`, `execution_records` | Triggers/actions/acciones se guardan como JSON |
| Auditoria | `activity_logs`, `execution_records` | Permite investigar cambios y ejecuciones |
| Auth | `users`, `sessions` | RBAC local con sesiones opacas |
| Home Assistant | `ha_settings`, `devices` | `ha_settings` guarda bridge; `devices.external_id` apunta a entidades |
| Asistente | `assistant_findings`, `assistant_feedback_events`, `assistant_drafts`, `assistant_memory`, `assistant_learning_events` | Persisten sugerencias, feedback, memoria y aprendizaje |

## Variables de entorno relevantes

Estas son las variables que Oscar usa actualmente en WSL para desarrollo local. Deben estar visibles porque explican como se levanta el runtime real de pruebas:

```bash
HOMEPILOT_DEV_BOOTSTRAP=true
HOMEPILOT_DB_PATH=./data/homepilot.db

OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=phi3
OLLAMA_TIMEOUT_MS=30000

ASSISTANT_PLANNER_V2_SHADOW=true
ASSISTANT_PLANNER_V2_SHADOW_SAMPLE_RATE=1
ASSISTANT_PLANNER_V2_SHADOW_FORCE=true
ASSISTANT_PLANNER_V2_SHADOW_LIGHT_PROMPT=true
ASSISTANT_PLANNER_V2_SHADOW_ULTRA_LIGHT_PROMPT=true
ASSISTANT_PLANNER_V2_SHADOW_TIMEOUT_MS=20000
ASSISTANT_PLANNER_V2_EXECUTION=true
ASSISTANT_PLANNER_V2_SHADOW_MODEL=qwen2.5:1.5b

TTS_PROVIDER=piper
TTS_BASE_URL=http://homepilot-tts:8088
PIPER_VOICE_ES=es_ES-sharvard-medium
PIPER_VOICE_EN=en_US-lessac-medium
PIPER_SYNTHESIS_TIMEOUT_SECONDS=20

STT_PROVIDER=whisper-local
STT_BASE_URL=http://homepilot-stt:8090
STT_TIMEOUT_MS=30000
WHISPER_MODEL=small
WHISPER_COMPUTE_TYPE=int8
WHISPER_BEAM_SIZE=3
WHISPER_VAD_MIN_SILENCE_MS=650
WHISPER_VAD_SPEECH_PAD_MS=400
WHISPER_MAX_AUDIO_BYTES=9000000
```

Detalle de uso:

| Variable | Valor WSL actual | Descripcion |
|---|---|---|
| `HOMEPILOT_DEV_BOOTSTRAP` | `true` | Crea `admin/admin` si la DB esta vacia. Solo desarrollo local. |
| `HOMEPILOT_DB_PATH` | `./data/homepilot.db` | Ruta SQLite cuando se corre fuera del contenedor o desde entorno WSL local. En contenedor normalmente se usa `/app/data/homepilot.db`. |
| `HOMEPILOT_SQLITE_JOURNAL_MODE` | `WAL` | Modo de journal SQLite. Use `WAL` en la miniPC Linux; use `DELETE` solo si Docker monta `data/` desde el filesystem de Windows. |
| `OLLAMA_ENABLED` | `true` | Activa llamadas del asistente a Ollama. |
| `OLLAMA_BASE_URL` | `http://ollama:11434` | URL interna Docker para el servicio Ollama. |
| `OLLAMA_MODEL` | `phi3` | Modelo principal del asistente. |
| `OLLAMA_TIMEOUT_MS` | `30000` | Tiempo maximo de espera para respuesta del modelo. |
| `ASSISTANT_PLANNER_V2_SHADOW` | `true` | Activa planner V2 en modo sombra para comparar/validar comportamiento. |
| `ASSISTANT_PLANNER_V2_SHADOW_SAMPLE_RATE` | `1` | Ejecuta shadow en el 100% de los casos elegibles. |
| `ASSISTANT_PLANNER_V2_SHADOW_FORCE` | `true` | Fuerza ejecucion del shadow aunque el muestreo normal no lo elija. |
| `ASSISTANT_PLANNER_V2_SHADOW_LIGHT_PROMPT` | `true` | Usa prompt liviano como fallback del planner shadow. |
| `ASSISTANT_PLANNER_V2_SHADOW_ULTRA_LIGHT_PROMPT` | `true` | Usa prompt ultra liviano para reducir latencia/costo local. |
| `ASSISTANT_PLANNER_V2_SHADOW_TIMEOUT_MS` | `20000` | Timeout del planner V2 shadow. |
| `ASSISTANT_PLANNER_V2_EXECUTION` | `true` | Permite ejecutar acciones con planner V2. Debe usarse con cuidado porque puede accionar dispositivos. |
| `ASSISTANT_PLANNER_V2_SHADOW_MODEL` | `qwen2.5:1.5b` | Modelo alterno para shadow planner. |
| `TTS_PROVIDER` | `piper` | Motor de sintesis de voz. |
| `TTS_BASE_URL` | `http://homepilot-tts:8088` | URL interna Docker del servicio TTS. |
| `PIPER_VOICE_ES` | `es_ES-sharvard-medium` | Voz Piper para respuestas en espanol. |
| `PIPER_VOICE_EN` | `en_US-lessac-medium` | Voz Piper para respuestas en ingles. |
| `PIPER_SYNTHESIS_TIMEOUT_SECONDS` | `20` | Timeout de generacion TTS. |
| `STT_PROVIDER` | `whisper-local` | Motor de transcripcion. |
| `STT_BASE_URL` | `http://homepilot-stt:8090` | URL interna Docker del servicio STT. |
| `STT_TIMEOUT_MS` | `30000` | Timeout de transcripcion desde API. |
| `WHISPER_MODEL` | `small` | Modelo Whisper usado por STT. |
| `WHISPER_COMPUTE_TYPE` | `int8` | Tipo de computo para optimizar rendimiento local. |
| `WHISPER_BEAM_SIZE` | `3` | Beam size de decodificacion Whisper. |
| `WHISPER_VAD_MIN_SILENCE_MS` | `650` | Silencio minimo para cortar segmentos de voz. |
| `WHISPER_VAD_SPEECH_PAD_MS` | `400` | Margen agregado alrededor de voz detectada. |
| `WHISPER_MAX_AUDIO_BYTES` | `9000000` | Tamano maximo permitido del audio enviado a STT. |

Variables adicionales del contenedor:

| Variable | Valor local tipico | Descripcion |
|---|---|---|
| `NODE_ENV` | `production` en contenedor | Modo Node dentro de la imagen Docker |
| `INTERNAL_HA_URL` | `http://homeassistant:8123` o `http://host.docker.internal:8123` | URL interna para hablar con Home Assistant. Usar `host.docker.internal` cuando el cliente ya tiene su propio HA fuera del compose de HomePilot. |
| `VITE_API_URL` | Vacia | La UI usa su origen actual y Nginx enruta `/api` y `/ws`. Una URL absoluta queda reservada para despliegues con API separada. |

## Flujo de trabajo con Windows y WSL

En este proyecto se edita el codigo en Windows:

```bash
C:\Users\ocuen\Developer\Nezu\homepilot
```

El entorno donde Oscar corre la app esta en WSL:

```bash
/home/oscar/homepilot
```

Flujo recomendado cuando se termina una mejora:

1. Validar en Windows.
2. Hacer commit.
3. Hacer push a `main`.
4. En WSL, traer cambios.
5. Levantar o reconstruir Docker Compose.

Comandos en Windows:

```bash
npm run typecheck
npm run build
npm run build --prefix apps/operator-console
git status
git add .
git commit -m "Descripcion corta"
git push
```

Comandos en WSL:

```bash
cd /home/oscar/homepilot
git pull --ff-only
docker compose up --build -d
docker compose ps
curl -fsS http://localhost:3000/health
```

Si solo cambiaron archivos de documentacion, no hace falta reconstruir contenedores para ver cambios en runtime. Basta con:

```bash
cd /home/oscar/homepilot
git pull --ff-only
```

Si se cambia frontend o backend, reconstruir:

```bash
docker compose up --build -d homepilot-api homepilot-ui
```

Si se toca STT, TTS, Home Assistant o dependencias de imagen:

```bash
docker compose up --build -d
```

## Comandos de validacion obligatorios

Para cambios frontend o full-stack:

```bash
npm run typecheck
npm run build
npm run build --prefix apps/operator-console
```

Para cambios backend, API, runtime, auth, automatizacion o bootstrap:

```bash
npm run test
```

Para validar despliegue real:

```bash
docker compose up --build
docker compose ps
```

## Operacion diaria

### Levantar todo el stack

```bash
docker compose up --build -d
```

### Ver estado

```bash
docker compose ps
```

### Ver logs de API

```bash
docker compose logs homepilot-api
```

### Ver logs de UI

```bash
docker compose logs homepilot-ui
```

### Ver logs de Home Assistant

```bash
docker compose logs homeassistant
```

### Validar API

```bash
curl -fsS http://localhost:3000/health
```

## Troubleshooting

| Sintoma | Revision recomendada |
|---|---|
| `HA_UNREACHABLE` al refrescar device | Verificar que Home Assistant este healthy, que `INTERNAL_HA_URL` sea `http://homeassistant:8123` o `http://host.docker.internal:8123` segun el despliegue, y que el token HA siga vigente |
| Device duplicado despues de reimportar | Revisar `devices.external_id`; la restriccion unica aplica por `home_id + external_id` |
| Cortina reporta invertido | Revisar `devices.invert_state` y el perfil/capacidad aplicado a cover |
| Device no cambia en inicio | Revisar refresh de estado, eventos realtime y `last_known_state` persistido |
| Login `admin/admin` no funciona | Confirmar que la DB estaba vacia al arrancar y que `HOMEPILOT_DEV_BOOTSTRAP=true` estaba activo |
| STT devuelve transcript vacio | Revisar audio enviado, salud de `homepilot-stt` y que no existan llamadas concurrentes bloqueando la cola |
| UI no conecta API | Confirmar `VITE_API_URL=` y revisar `http://localhost:8080/health`; Nginx debe alcanzar `homepilot-api:3000` |
| UI publica intenta conectar a localhost | Reconstruir `homepilot-ui` con `VITE_API_URL=` y publicar solamente `127.0.0.1:8080` en Cloudflare Tunnel |
| Cambios no aparecen en WSL | Hacer `git pull --ff-only` dentro de `/home/oscar/homepilot` |

## Reglas de mantenimiento

- No documentar comportamientos que el codigo no implemente.
- No cambiar contratos API sin actualizar consumidores.
- No guardar secretos reales en git.
- No manipular `data/homepilot.db` a mano para cambios de esquema.
- Agregar migraciones para cambios persistentes.
- Mantener `docs/documentation-index.md` actualizado cuando se agregue documentacion importante.
- Para nuevas marcas o nuevos tipos de devices, mapear capacidades de forma modular y evitar logica especial en componentes genericos.
