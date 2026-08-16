# Ejecución local en Windows

El mismo comando de mantenimiento usado en Linux detecta Docker Desktop desde Windows o WSL y añade el overlay correcto, para cualquier perfil (`bridge_ha`, `native_only` o `ha_companion`):

```powershell
bash scripts/homepilot-maintenance.sh --deploy --yes
bash scripts/homepilot-maintenance.sh --profile ha_companion --deploy --yes
```

Abre `http://localhost:8080`. Para una ejecución manual equivalente:

- `bridge_ha` / `native_only`: `docker compose -f docker-compose.office.yml -f docker-compose.desktop.yml up -d --build`
- `ha_companion`: `docker compose -f docker-compose.yml -f docker-compose.ha-companion.desktop.yml up -d --build`

La interfaz usa un proxy interno hacia la API, por lo que no se requiere configurar una URL de API en el navegador.

Nota: `docker-compose.yml` (perfil `ha_companion`) usa `network_mode: host` para la API, que Docker Desktop en Windows/Mac no soporta igual que en Linux — sin el overlay de escritorio, el login falla porque la API queda inalcanzable. El overlay resetea ese `network_mode` y publica la API en `13000` y la UI en `8080` (o los puertos definidos por `HOMEPILOT_API_PORT`/`HOMEPILOT_UI_PORT`), útil también cuando un Cloudflare Tunnel u otro reverse proxy espera la UI en un puerto específico. Si tenías un `docker-compose.override.yml` local para resolver esto a mano, ya no es necesario.

El perfil usa la misma base canónica `data/homepilot.db` que el runtime Linux. Windows y Linux no deben crear bases de datos separadas para una misma instalación.

El perfil publica la API en `http://localhost:13000` para diagnóstico. Home Assistant local debe estar disponible en `http://host.docker.internal:18123` desde Docker; el contenedor existente de desarrollo se publica normalmente en ese puerto.

Para validar:

```powershell
curl.exe http://127.0.0.1:8080/health
curl.exe http://127.0.0.1:13000/health
```
