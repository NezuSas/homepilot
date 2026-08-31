# SPEC: Conector Edge para HomePilot Cloud de dominio único V1

**Issue:** NezuSas/homepilot#7  
**Estado:** Borrador  
**Dependencia:** NezuSas/nezu-homepilot-directory#1  
**Fecha:** 2026-08-31

## Propósito

El Edge inicia y mantiene un canal seguro hacia HomePilot Cloud. Este conector hace
posible acceder a múltiples hogares desde un único dominio sin exponer la API,
Home Assistant ni puertos de la red del cliente al Internet.

## Responsabilidades por capa

| Capa | Responsabilidad |
| --- | --- |
| Dominio | Autoriza operaciones relay, define mensajes permitidos y estados del conector. |
| Datos | Guarda identidad de emparejamiento, material de autenticación protegido y estado mínimo de conexión. |
| Red | Abre/reconecta WebSocket saliente, aplica timeout, tamaño y correlación. |
| Seguridad | Verifica identidad Cloud, vincula `homeId`/`edgeId`, rota credenciales y evita replay. |
| Interfaz | Informa conectividad Cloud sin bloquear la operación local. |

## Requisitos

- **REQ-1:** Ningún listener remoto nuevo se abre en el Edge. El conector solo crea
  conexiones salientes HTTPS/WSS al dominio configurado de HomePilot Cloud.
- **REQ-2:** Antes de procesar mensajes valida versión, identidad Cloud, `homeId`,
  `edgeId`, expiración, `requestId` único y tipo permitido.
- **REQ-3:** El relay inicial permite únicamente endpoints/acciones explicitamente
  incluidos en una lista de allowlist. Quedan fuera cámaras, archivos, backups,
  secretos, rutas de administración y shell.
- **REQ-4:** Cada solicitud Cloud se ejecuta bajo un principal local de gateway con
  permisos acotados por el rol emitido; no reutiliza cookies o sesiones locales.
- **REQ-5:** Los comandos físicos no son reintentados automáticamente. Una respuesta
  tardía se descarta y queda auditada sin payload.
- **REQ-6:** Deshabilitar el conector o perder red no cambia los servicios locales,
  automatizaciones, Home Assistant, MQTT, usuarios ni sesiones del Edge.

## Política inicial de principal y comandos

- Un `owner` de Cloud se ejecuta en Edge como principal `parent`: puede operar
  dispositivos permitidos, pero no administrar usuarios, configuración, secretos o
  la instalación.
- Un `member` de Cloud es `read-only`: puede solicitar dashboard y dispositivos
  sanitizados, sin emitir comandos físicos.
- La allowlist de comandos inicial contiene `turn_on`, `turn_off`, `toggle`,
  `open`, `close`, `stop`, `set_position`, `play`, `pause`, `next_track`,
  `previous_track` y `volume_set`. Cámaras, archivos, backups, automatizaciones,
  administración y shell quedan prohibidos.
## Emparejamiento y rotación

El instalador genera un código corto de un uso en el Edge. Al reclamarlo en Cloud,
ambas partes intercambian identificadores opacos y credenciales de canal. El secreto
de Edge se almacena solo en el runtime protegido de la MiniPC y Cloud persiste un
verificador hashado. Se admite rotación con dos credenciales válidas durante una
ventana limitada; una revocación corta el canal y exige nuevo pairing.

## Criterios de aceptación

- [ ] AC1: el Edge se conecta salientemente y se identifica solo para su
  `homeId`/`edgeId` emparejados.
- [ ] AC2: petición con hogar, Edge, versión, firma o `requestId` incorrectos se
  rechaza antes de llamar a dominio, datos o integraciones.
- [ ] AC3: la allowlist bloquea cámaras, secretos, archivos, backups, shell y rutas
  administrativas aunque Cloud intente solicitarlas.
- [ ] AC4: desconectar Internet o Cloud deja funcional el uso local y no deja
  procesos en bucle ni comandos pendientes.
- [ ] AC5: pruebas cubren reconnect, timeout, backpressure, replay, hogar cruzado,
  rotación y regresión de login/control local.
