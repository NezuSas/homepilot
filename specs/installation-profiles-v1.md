# SPEC: Perfiles de instalación de HomePilot Edge V1

**Estado:** Implementado
**Autor:** Codex
**Fecha:** 2026-07-22

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
| Windows + Docker Desktop | docker-compose.office.yml | docker-compose.desktop.yml | Red Docker y API publicada en 13000 | data/homepilot.desktop.db aislada |

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
- **REQ-09:** El perfil de Docker Desktop debe usar una base aislada y exigir la creación de la primera cuenta administrativa; no debe crear una credencial predeterminada.

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
- [x] AC9: La UI local responde en 8080, el proxy /api responde a través de homepilot-api, y setup-status permite la creación de la primera cuenta en la base aislada.

## 5. Límites

- `ha_companion` es una opción explícita y no migra ni modifica un Home Assistant existente.
- `native_only` habilita el appliance y sus integraciones locales; no implementa todavía cada protocolo posible de terceros.
- HomePilot conserva su propio inventario, espacios, rutinas y usuarios sin depender de Home Assistant como fuente de configuración.
