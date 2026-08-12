# Referencia de comandos operativos

Esta guía reúne los comandos soportados para instalar, iniciar, actualizar, validar y diagnosticar HomePilot. Ejecútalos desde la raíz del repositorio, salvo que se indique otra cosa.

## 1. Requisitos

- Node.js 20.19 a 22 y npm 10 o superior para desarrollo local.
- Docker Desktop en Windows, o Docker Engine con Docker Compose v2 en Linux.
- Git para actualizar el código.

Comprueba las herramientas:

```bash
node --version
npm --version
docker compose version
git --version
```

## 2. Instalación de dependencias para desarrollo

Solo es necesaria al clonar el proyecto o cuando cambien `package.json` o `package-lock.json`:

```bash
npm install
npm install --prefix apps/operator-console
```

## 3. Inicio local para desarrollo

Inicia API y consola web en terminales coordinadas:

```bash
npm run dev
```

Para iniciar solamente la API:

```bash
npm run dev:api
```

Para iniciar solamente la consola web:

```bash
npm run dev:ui
```

Detén el proceso con `Ctrl+C` en la terminal correspondiente.

## 4. Instalación o primera configuración del appliance

El asistente guiado es el punto de entrada recomendado para una instalación nueva. Detecta el entorno y permite elegir el perfil de integración:

```bash
bash scripts/install-edge-office.sh --wizard
```

Perfiles disponibles:

- `bridge_ha`: conecta HomePilot con una instalación existente de Home Assistant.
- `native_only`: usa únicamente integraciones nativas de HomePilot.
- `ha_companion`: instala el Home Assistant complementario gestionado por HomePilot.

Instalación no interactiva de un perfil y arranque inmediato:

```bash
bash scripts/install-edge-office.sh --profile bridge_ha --clean --start --yes
```

Consulta de estado sin modificar la instalación:

```bash
bash scripts/install-edge-office.sh --profile bridge_ha --status
```

Para ayuda completa del instalador:

```bash
bash scripts/install-edge-office.sh --help
```

## 5. Inicio con Docker

### Windows con Docker Desktop

Usa el overlay de Docker Desktop. Mantiene la base de datos canónica en `data/homepilot.db`:

```powershell
docker compose -f docker-compose.office.yml -f docker-compose.desktop.yml up -d --build
```

### Linux o miniPC

```bash
docker compose -f docker-compose.office.yml up -d --build
```

Después del arranque:

```bash
docker compose -f docker-compose.office.yml ps
```

En Windows añade también el overlay al comando de estado:

```powershell
docker compose -f docker-compose.office.yml -f docker-compose.desktop.yml ps
```

Puntos de acceso del runtime Docker:

- Consola web: `http://localhost:8080`
- API en Linux: `http://localhost:3000`
- API en Docker Desktop: `http://localhost:13000`
- Home Assistant local: `http://localhost:18123`

## 6. Mantenimiento y despliegue seguro

El script de mantenimiento selecciona automáticamente el compose adecuado entre Linux, WSL y Docker Desktop. Para actualizar imágenes y reiniciar conservando datos:

```bash
bash scripts/homepilot-maintenance.sh --deploy --yes
```

Con perfil explícito:

```bash
bash scripts/homepilot-maintenance.sh --profile bridge_ha --deploy --yes
```

Estado de espacio y Docker, sin cambios:

```bash
bash scripts/homepilot-maintenance.sh --status
```

Limpieza segura de caché e imágenes colgantes, sin borrar volúmenes ni la base de datos:

```bash
bash scripts/homepilot-maintenance.sh --clean --yes
```

Ayuda y opciones avanzadas:

```bash
bash scripts/homepilot-maintenance.sh --help
```

## 7. Actualización desde Windows hacia la miniPC Linux

En Windows, después de validar cambios:

```powershell
git status
git add -A
git commit -m "descripcion del cambio"
git push origin main
```

En la miniPC Linux, dentro del directorio del proyecto:

```bash
git checkout main
git pull origin main
bash scripts/homepilot-maintenance.sh --deploy --yes
```

## 8. Validación antes de publicar cambios

Validación de tipos:

```bash
npm run typecheck
```

Compilación del backend y la consola:

```bash
npm run build
npm run build --prefix apps/operator-console
```

Pruebas unitarias e integración:

```bash
npm run test
```

Pruebas responsive de la consola:

```bash
npm run test:responsive
```

Puerta integral de calidad: SDD, BDD, arquitectura, i18n, lint, pruebas y compilaciones:

```bash
npm run verify:quality
```

Para cambios de frontend, API, autenticación o runtime, valida también el runtime Docker con el comando correspondiente de la sección 5 y revisa el estado con `docker compose ... ps`.

## 9. Diagnóstico de runtime

Logs de un servicio en Linux:

```bash
docker compose -f docker-compose.office.yml logs --tail=100 homepilot-api
docker compose -f docker-compose.office.yml logs --tail=100 homepilot-ui
```

En Windows, añade el overlay:

```powershell
docker compose -f docker-compose.office.yml -f docker-compose.desktop.yml logs --tail=100 homepilot-api
docker compose -f docker-compose.office.yml -f docker-compose.desktop.yml logs --tail=100 homepilot-ui
```

Comprobación rápida de salud:

```bash
curl -fsS http://127.0.0.1:13000/health
```

En Linux, si la API usa el puerto estándar, sustituye `13000` por `3000`.

## 10. Base de datos y datos persistentes

No elimines `data/`, volúmenes Docker ni `data/homepilot.db` durante actualizaciones normales. Windows y Linux usan la misma ruta canónica de base de datos por instalación; no se deben crear bases de datos paralelas.
