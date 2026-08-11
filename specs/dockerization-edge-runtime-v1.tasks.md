# Tasks: Dockerization & Edge Runtime V1

- [x] Mantener Dockerfiles de API/UI, `.dockerignore` y builds reproducibles con `npm ci`.
- [x] Mantener los perfiles Compose integrado, oficina/Linux y Docker Desktop.
- [x] Usar Nginx same-origin para UI, API y WebSocket sin URL de API en el navegador.
- [x] Unificar los perfiles sobre `data/homepilot.db` y documentar los puertos de Linux/Windows.
- [x] Validar build y healthcheck del stack integrado.
- [x] Validar build y healthchecks de UI/API con el perfil Docker Desktop.
- [x] Validar login y bridge HA con una instalación persistida en Docker Desktop.
- [ ] Validar login y bridge HA con una instalación persistida en Linux nativo.
- [x] Validar ciclo `down`/`up` conservando setup, sesión y configuración HA en Docker Desktop.
- [ ] Validar ciclo `down`/`up` conservando setup, sesión y configuración HA en Linux nativo.