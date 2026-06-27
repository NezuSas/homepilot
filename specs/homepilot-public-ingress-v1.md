# SPEC: Acceso publico seguro a HomePilot V1

**Estado:** Implementado
**Fecha:** 2026-06-26

## 1. Problema

La UI y la API se publican en puertos distintos. Una UI compilada con `localhost` intenta acceder al equipo del visitante cuando se abre desde Internet, por lo que autenticacion, camaras y tiempo real dejan de funcionar.

## 2. Alcance

- Un unico origen HTTP para UI, API, medios y WebSocket.
- Nginx como entrada de HomePilot y proxy interno hacia `homepilot-api`.
- Compatibilidad con acceso local, tunel SSH y Cloudflare Tunnel sin recompilar la UI para cada hostname.
- Documentacion de publicacion y proteccion mediante Cloudflare Access.

## 3. Requisitos funcionales

- **REQ-01:** La compilacion de produccion debe usar rutas API relativas al origen actual cuando `VITE_API_URL` este vacia.
- **REQ-02:** Nginx debe enviar `/api/*`, `/health` y `/ws` a `homepilot-api:3000`.
- **REQ-03:** El proxy de `/ws` debe conservar el upgrade WebSocket.
- **REQ-04:** Cloudflare Tunnel debe necesitar una sola ruta publica hacia `http://127.0.0.1:8080`.
- **REQ-05:** `VITE_API_URL` debe conservarse como opcion avanzada para una API alojada en otro origen.

## 4. Requisitos no funcionales

- **NFR-01:** No se deben publicar directamente los puertos de STT, TTS, Ollama ni Home Assistant para operar HomePilot.
- **NFR-02:** El hostname publico debe protegerse con autenticacion de HomePilot y se recomienda una politica adicional de Cloudflare Access.
- **NFR-03:** Las respuestas de video y eventos no deben almacenarse en buffers del proxy.

## 5. Criterios de aceptacion

- [x] AC1: `http://localhost:8080` funciona sin un tunel separado para el puerto 3000.
- [x] AC2: Un hostname de Cloudflare dirigido a `127.0.0.1:8080` carga UI y API desde el mismo origen.
- [x] AC3: El WebSocket de HomePilot funciona mediante el mismo hostname.
- [x] AC4: La instalacion de oficina usa mismo origen de forma predeterminada.
