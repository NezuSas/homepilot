# Specification: Dockerization & Edge Runtime V1

**Estado:** Borrador

## Objetivo

Entregar HomePilot como una aplicación Edge reproducible en Linux y Docker Desktop para Windows, conservando una única base SQLite canónica y sin exponer dependencias internas al navegador.

## Perfiles de runtime

| Perfil | Compose | Red y Home Assistant | Puertos públicos |
| --- | --- | --- | --- |
| Oficina/Linux | `docker-compose.office.yml` | API en `network_mode: host`; conecta al Home Assistant existente configurado para la oficina. | UI `8080`, API `3000` |
| Docker Desktop | `docker-compose.office.yml` + `docker-compose.desktop.yml` | Red bridge; API accede al Home Assistant local mediante `host.docker.internal:18123`. | UI `8080`, API `13000` |
| Stack de desarrollo integrado | `docker-compose.yml` | Incluye Home Assistant, API/UI y servicios locales. | UI `80`, Home Assistant `18123` |

La UI usa el proxy Nginx same-origin (`/api`, `/ws` y `/health`) en todos los perfiles. El navegador no resuelve nombres DNS internos de Docker ni requiere `VITE_API_URL` para el flujo normal.

## Persistencia

Todos los perfiles montan `./data` en `/app/data` y usan exclusivamente `data/homepilot.db` mediante `HOMEPILOT_DB_PATH`. La base, sus archivos `-wal`/`-shm`, el estado de setup, sesiones y configuración HA pertenecen a la misma instalación tanto en Linux como en Windows.

## Configuración relevante

| Variable | Propósito |
| --- | --- |
| `HOMEPILOT_DB_PATH` | Ruta de la base canónica dentro del contenedor. |
| `INTERNAL_HA_URL` | URL HA que usa la API; varía según perfil. |
| `HOMEPILOT_RUNTIME_TARGET` | Selecciona comportamiento `linux_edge` o `docker_desktop`. |
| `VITE_API_URL` | Vacía por defecto para mantener el proxy same-origin. |
| `HOMEPILOT_INTEGRATION_API_KEY` | Clave opcional para ingestas M2M locales. |

## Criterios de aceptación

- [x] Los tres Compose construyen las imágenes con `npm ci`, caché BuildKit y reintentos de descarga.
- [x] `docker compose up --build -d` inicia el stack integrado y `GET /health` de la API responde `200`.
- [x] El perfil Docker Desktop inicia con `docker compose -f docker-compose.office.yml -f docker-compose.desktop.yml up --build -d`; API (`13000`) y proxy UI (`8080`) responden `200` en `/health`.
- [x] La UI alcanza la API a través de Nginx same-origin, sin DNS Docker expuesto al navegador.
- [x] Todos los perfiles apuntan a `data/homepilot.db` como única base canónica.
- [x] Docker Desktop: inicio de sesión end-to-end con credenciales reales y bridge Home Assistant alcanzable.
- [x] Docker Desktop: ciclo controlado `down`/`up` conserva setup, sesión y configuración HA.
- [ ] Linux nativo: inicio de sesión end-to-end con credenciales reales y bridge Home Assistant alcanzable.
- [ ] Linux nativo: ciclo controlado `down`/`up` conserva setup, sesión y configuración HA.

## Evidencia de runtime

- 2026-08-11, Docker Desktop: API `13000` y UI `8080` respondieron `200` en `/health`; login local, setup y bridge HA fueron validados con una sesión real.
- 2026-08-11, Docker Desktop: tras `down`/`up`, la sesión ya emitida, el estado de setup y la configuración/conectividad HA permanecieron válidos.
- 2026-08-11, WSL/Linux: API y UI del perfil Docker Desktop respondieron `200`; esto no sustituye la certificación del perfil Oficina/Linux, que requiere un host Linux nativo para `network_mode: host`.

## Fuera de alcance

- Kubernetes, clústeres multinodo y TLS administrado.
- Crear o administrar un Home Assistant ajeno en el perfil de oficina.