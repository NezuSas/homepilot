# Tasks: Dockerization & Edge Runtime V1

- [x] Mantener Dockerfiles de API/UI, `.dockerignore` y builds reproducibles con `npm ci`.
- [x] Mantener los perfiles Compose integrado, oficina/Linux y Docker Desktop.
- [x] Usar Nginx same-origin para UI, API y WebSocket sin URL de API en el navegador.
- [x] Unificar los perfiles sobre `data/homepilot.db` y documentar los puertos de Linux/Windows.
- [x] Validar build y healthcheck del stack integrado.
- [x] Validar build y healthchecks de UI/API con el perfil Docker Desktop.
- [ ] Validar el login end-to-end con una instalación persistida en Linux y Docker Desktop.
- [ ] Validar el ciclo `down`/`up` conservando setup, sesiones y configuración HA en ambos perfiles.