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

## 3. Requisitos funcionales

- **REQ-01:** `HOMEPILOT_INSTALLATION_PROFILE` debe aceptar únicamente `bridge_ha`, `native_only` y `ha_companion`; un valor inválido usa `bridge_ha` por compatibilidad.
- **REQ-02:** `native_only` debe permitir completar el onboarding sin URL, token ni conectividad de Home Assistant.
- **REQ-03:** Los perfiles `bridge_ha` y `ha_companion` deben conservar la validación de configuración y conexión de Home Assistant antes de completar onboarding.
- **REQ-04:** El instalador debe seleccionar compose y plantilla `.env` según `--profile` y detenerse si el perfil guardado en `.env` no coincide.
- **REQ-05:** `bridge_ha` y `native_only` no deben declarar un servicio Home Assistant en su compose.
- **REQ-06:** El estado operativo debe indicar cuando Home Assistant no es requerido por `native_only`.

## 4. Criterios de aceptación

- [x] AC1: `getInstallationProfile` reconoce los tres perfiles y usa `bridge_ha` para valores inválidos.
- [x] AC2: La API de setup devuelve `installationProfile` y `requiresHomeAssistant`.
- [x] AC3: El cierre de onboarding nativo no consulta ni valida configuración Home Assistant.
- [x] AC4: La consola omite el paso de bridge en `native_only` y conserva el flujo existente para perfiles bridge.
- [x] AC5: `bash scripts/install-edge-office.sh --profile native_only --status` no exige que Home Assistant responda.
- [x] AC6: El instalador usa `docker-compose.yml` y `.env.example` solo para `ha_companion`.

## 5. Límites

- `ha_companion` es una opción explícita y no migra ni modifica un Home Assistant existente.
- `native_only` habilita el appliance y sus integraciones locales; no implementa todavía cada protocolo posible de terceros.
- HomePilot conserva su propio inventario, espacios, rutinas y usuarios sin depender de Home Assistant como fuente de configuración.
