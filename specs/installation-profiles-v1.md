# SPEC: Perfiles de instalación de HomePilot V1

**Estado:** Implementado
**Autor:** Codex
**Fecha:** 2026-08-01

## 1. Declaración del problema

HomePilot debe instalarse de forma explícita tanto en hogares que ya usan Home Assistant como en instalaciones nuevas que comienzan con integraciones nativas. El instalador no debe crear ni administrar Home Assistant sin que el instalador lo haya seleccionado.

## 2. Perfiles soportados

| Perfil | Compose | Home Assistant | Uso |
|---|---|---|---|
| `bridge_ha` | `docker-compose.office.yml` | Existente y preservado | Cliente con Home Assistant propio. |
| `native_only` | `docker-compose.office.yml` | No requerido | Instalación inicial con integraciones nativas de HomePilot. |
| `ha_companion` | `docker-compose.yml` | Incluido por el compose | Cliente que elige expresamente operar Home Assistant junto a HomePilot. |

## 2.1 Perfiles de runtime

| Entorno | Compose base | Overlay | Red de API | Persistencia |
|---|---|---|---|---|
| MiniPC Linux | docker-compose.office.yml | No requerido | Host, para alcanzar los servicios locales del appliance | data/homepilot.db |
| Windows + Docker Desktop | docker-compose.office.yml | docker-compose.desktop.yml | Red Docker y API publicada en 13000 | data/homepilot.db canónica |

El overlay de Docker Desktop mantiene los mismos servicios y contratos que el runtime de MiniPC. Solo reemplaza el modo de red no compatible con Docker Desktop y hace que la UI use el proxy interno homepilot-ui → homepilot-api.

## 3. Requisitos funcionales

- **REQ-01:** `HOMEPILOT_INSTALLATION_PROFILE` debe aceptar únicamente `bridge_ha`, `native_only` y `ha_companion`; un valor inválido usa `bridge_ha` por compatibilidad.
- **REQ-02:** `native_only` debe permitir completar el onboarding sin URL, token ni conectividad de Home Assistant.
- **REQ-03:** Los perfiles `bridge_ha` y `ha_companion` deben conservar la validación de configuración y conexión de Home Assistant antes de completar onboarding.
- **REQ-04:** El instalador debe seleccionar compose y plantilla `.env` según `--profile` y detenerse si el perfil guardado en `.env` no coincide.
- **REQ-05:** `bridge_ha` y `native_only` no deben declarar un servicio Home Assistant en su compose.
- **REQ-06:** El estado operativo debe indicar cuando Home Assistant no es requerido por `native_only`.
- **REQ-07:** El despliegue de mantenimiento debe reintentar automáticamente las construcciones que fallen de forma transitoria, incluida la indisponibilidad temporal del registro de imágenes Docker.
- **REQ-08:** El repositorio debe ofrecer un overlay oficial para Docker Desktop que sustituya 
etwork_mode: host por red Docker, publique la API local en un puerto no conflictivo y conserve todos los contratos de API.
- **REQ-09:** Todos los perfiles de runtime de una misma instalación deben usar únicamente `data/homepilot.db`; Docker Desktop no puede crear una base paralela ni una cuenta administrativa independiente.
- **REQ-10:** `HOMEPILOT_RUNTIME_TARGET` debe declarar explícitamente `linux_edge`, `docker_desktop` o `unknown`; el backend no debe inferir el entorno desde el navegador o el sistema operativo.
- **REQ-11:** Para perfiles que usan Home Assistant, `setup-status` debe exponer por separado la URL interna que consume HomePilot (`homeAssistantBridgeUrl`) y la URL que el instalador abre en el navegador para crear el token (`homeAssistantSetupUrl`). Ambas solo pueden ser HTTP o HTTPS.
- **REQ-12:** En una instalación nueva invocada sin `--profile` desde una terminal interactiva, el instalador debe guiar la elección con lenguaje de cliente: reutilizar Home Assistant existente, instalar Home Assistant junto a HomePilot, o usar únicamente integraciones nativas. Los nombres internos de perfil no se presentan como decisión principal.
- **REQ-13:** Si existe un `.env`, el instalador debe conservar el perfil ya guardado cuando no se suministra `--profile`; no debe volver a preguntar ni cambiar la topología de una instalación existente.
- **REQ-14:** Para perfiles con Home Assistant, `--status` debe informar de forma no destructiva si HACS y SonoffLAN están instalados en el contenedor configurado por `HOMEPILOT_HOME_ASSISTANT_CONTAINER`.
- **REQ-15:** El instalador debe provisionar automáticamente HACS y SonoffLAN durante un despliegue de `ha_companion`; en `bridge_ha` solo puede hacerlo mediante `--with-community-integrations` o una confirmación interactiva explícita. `--yes` no autoriza cambios en un Home Assistant existente.
- **REQ-16:** La provisión de SonoffLAN no debe almacenar ni solicitar credenciales eWeLink en HomePilot; la cuenta se configura exclusivamente en la UI de Home Assistant.
- **REQ-17:** Si una instalación existente tiene `.env` sin `HOMEPILOT_INSTALLATION_PROFILE`, una ejecución de instalación debe normalizar ese archivo con el perfil resuelto sin requerir edición manual ni duplicar la clave; `--status` solo informa y no modifica el archivo.
- **REQ-18:** El instalador debe ofrecer --wizard para que un técnico seleccione de forma guiada la arquitectura, la acción de despliegue, la limpieza segura y la autorización opcional de HACS/SonoffLAN; antes de cualquier cambio debe mostrar un checklist resumido y requerir confirmación explícita. Sus respuestas se deben leer desde la terminal controladora para que el flujo sea fiable desde PowerShell, WSL y Linux. Los valores leídos desde `.env` deben normalizar retornos de carro de archivos CRLF para que el perfil seleccionado se interprete igual en todos los sistemas.
- **REQ-19:** El instalador debe ofrecer un modo de mantenimiento exclusivo para HACS y SonoffLAN que detecte el entorno técnico, muestre los comandos equivalentes y modifique solo el contenedor Home Assistant autorizado. Este modo no debe ejecutar Docker Compose, reconstruir imágenes ni reiniciar HomePilot.
- **REQ-20:** `homepilot-maintenance.sh --deploy` debe detectar Docker Desktop desde Windows o WSL y usar automáticamente `docker-compose.office.yml` junto con `docker-compose.desktop.yml`; en Linux nativo conserva solo `docker-compose.office.yml`.

## 4. Criterios de aceptación

- [x] AC1: `getInstallationProfile` reconoce los tres perfiles y usa `bridge_ha` para valores inválidos.
- [x] AC2: La API de setup devuelve `installationProfile` y `requiresHomeAssistant`.
- [x] AC3: El cierre de onboarding nativo no consulta ni valida configuración Home Assistant.
- [x] AC4: La consola omite el paso de bridge en `native_only` y conserva el flujo existente para perfiles bridge.
- [x] AC5: `bash scripts/install-edge-office.sh --profile native_only --status` no exige que Home Assistant responda.
- [x] AC6: El instalador usa `docker-compose.yml` y `.env.example` solo para `ha_companion`.
- [x] AC7: `homepilot-maintenance.sh --deploy` intenta la construcción hasta tres veces con espera progresiva y conserva un error claro si Docker Hub continúa inaccesible.
- [x] AC8: docker compose -f docker-compose.office.yml -f docker-compose.desktop.yml config no conserva 
etwork_mode: host para la API y publica el puerto 13000.
- [x] AC9: La UI local responde en 8080, el proxy /api responde a través de homepilot-api y Docker Desktop usa la misma base canónica que Linux.
- [x] AC12: Una ejecución interactiva nueva de `install-edge-office.sh` permite elegir el camino de instalación sin conocer `bridge_ha`, `native_only` o `ha_companion`.
- [x] AC13: Una ejecución sobre una instalación existente conserva el perfil declarado en `.env` salvo que el operador indique `--profile` explícitamente.
- [x] AC14: `--status` muestra la presencia o ausencia de HACS y SonoffLAN sin cambiar el Home Assistant del cliente.
- [x] AC15: `ha_companion` provisiona automáticamente HACS y SonoffLAN después del arranque; `bridge_ha` exige autorización explícita para instalar componentes comunitarios.
- [x] AC16: El flujo documentado delega la vinculación eWeLink a Home Assistant y no agrega secretos de proveedor a HomePilot.
- [x] AC17: Una instalación heredada sin perfil se normaliza automáticamente durante una instalación y puede continuar con el flujo autorizado sin editar `.env` a mano; `--status` permanece en modo lectura.
- [x] AC18: bash scripts/install-edge-office.sh --wizard presenta el checklist técnico, conserva el perfil de una instalación existente, solicita una confirmación única antes de ejecutar las acciones seleccionadas y continúa mostrando sus preguntas cuando se invoca desde PowerShell, WSL o Linux. También debe interpretar correctamente perfiles guardados en archivos `.env` con CRLF.
- [x] AC19: `bash scripts/install-edge-office.sh --profile bridge_ha --community-integrations-only` detecta el entorno del técnico, solicita autorización y mantiene HACS/SonoffLAN sin ejecutar `docker compose`, reconstruir imágenes ni reiniciar HomePilot.
- [x] AC20: `bash scripts/homepilot-maintenance.sh --deploy --yes` selecciona el overlay Docker Desktop automáticamente cuando el daemon informa ese entorno, sin requerir un comando distinto al usado en Linux.
- [x] AC10: La guía de onboarding identifica Docker Desktop o el appliance Linux mediante la configuración del compose, sin depender del navegador del cliente.
- [x] AC11: La guía distingue la URL interna del bridge de la URL de navegador para crear el token y permite usar la URL interna sugerida con un solo clic.

## 5. Límites

- `ha_companion` es una opción explícita y no migra ni modifica un Home Assistant existente.
- HACS y SonoffLAN se provisionan automáticamente en `ha_companion`; en `bridge_ha` solo se instalan con autorización explícita del operador.
- `native_only` habilita el appliance y sus integraciones locales; no implementa todavía cada protocolo posible de terceros.
- HomePilot conserva su propio inventario, espacios, rutinas y usuarios sin depender de Home Assistant como fuente de configuración.
