# Ejecución local en Windows

El mismo comando de mantenimiento usado en Linux detecta Docker Desktop desde Windows o WSL y añade el overlay correcto:

```powershell
bash scripts/homepilot-maintenance.sh --deploy --yes
```

Abre `http://localhost:8080`. Para una ejecución manual equivalente, usa `docker compose -f docker-compose.office.yml -f docker-compose.desktop.yml up -d --build`. La interfaz usa un proxy interno hacia la API, por lo que no se requiere configurar una URL de API en el navegador.

El perfil usa la misma base canónica `data/homepilot.db` que el runtime Linux. Windows y Linux no deben crear bases de datos separadas para una misma instalación.

El perfil publica la API en `http://localhost:13000` para diagnóstico. Home Assistant local debe estar disponible en `http://host.docker.internal:18123` desde Docker; el contenedor existente de desarrollo se publica normalmente en ese puerto.

Para validar:

```powershell
curl.exe http://127.0.0.1:8080/health
curl.exe http://127.0.0.1:13000/health
```
