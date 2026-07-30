# Ejecución local en Windows

Usa el perfil de Docker Desktop para levantar HomePilot en esta PC:

```powershell
docker compose -f docker-compose.office.yml -f docker-compose.desktop.yml up -d --build
```

Abre `http://localhost:8080`. La interfaz usa un proxy interno hacia la API, por lo que no se requiere configurar una URL de API en el navegador.

El perfil usa `data/homepilot.desktop.db`, separado de cualquier base de datos de appliance. En el primer acceso aparecerá la creación segura de la cuenta administradora: define ahí el usuario y contraseña locales. No existe una credencial predeterminada.

El perfil publica la API en `http://localhost:13000` para diagnóstico. Home Assistant local debe estar disponible en `http://host.docker.internal:18123` desde Docker; el contenedor existente de desarrollo se publica normalmente en ese puerto.

Para validar:

```powershell
curl.exe http://127.0.0.1:8080/health
curl.exe http://127.0.0.1:13000/health
```
