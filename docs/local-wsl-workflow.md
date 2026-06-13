# Local Windows to WSL Workflow

## Objetivo

Este flujo documenta la forma actual de trabajo:

1. Se modifica y valida el codigo en Windows local.
2. Se sube a `main`.
3. Se hace `git pull` desde WSL.
4. Se reconstruye el runtime con Docker.

## Windows Local

Antes de subir cambios:

```powershell
git status --short --branch
npm run typecheck
npm run build
npm run build --prefix apps/operator-console
docker compose up --build
docker compose ps
```

El estado esperado de Docker debe incluir:

- `homeassistant`: healthy
- `homepilot-api`: healthy
- `homepilot-ui`: up

Si el API aparece como `health: starting`, esperar y revisar otra vez:

```powershell
Start-Sleep -Seconds 20; docker compose ps
```

## Commit y Push

```powershell
git status --short --branch
git add -A
git commit -m "Mensaje claro del cambio"
git push origin main
```

Notas:

- El repositorio puede mostrar warnings de CRLF/LF en Windows. Esos warnings no bloquean si las validaciones pasan.
- Si GitHub indica que se omitio una regla de pull request pero acepta el push, el cambio ya quedo en `origin/main`.
- Despues del push, verificar:

```powershell
git status --short --branch
```

Estado esperado:

```text
## main...origin/main
```

sin archivos modificados debajo.

## WSL

Dentro del checkout de WSL:

```bash
git checkout main
git pull origin main
npm install
npm install --prefix apps/operator-console
docker compose up --build
```

Si las dependencias ya estan instaladas, `npm install` puede omitirse salvo que cambie `package.json` o lockfile.

Verificar runtime:

```bash
docker compose ps
```

## Puertos Esperados

- Operator Console: `http://localhost`
- API: `http://localhost:3000`
- Home Assistant: `http://localhost:18123`
- Ollama: `http://localhost:11434`

## Problemas Frecuentes

### API queda en `health: starting`

Esperar 20-40 segundos y revisar:

```bash
docker compose ps
```

### UI no refleja cambios

Reconstruir UI con Docker:

```bash
docker compose up --build homepilot-ui
```

O reconstruir todo:

```bash
docker compose up --build
```

### WSL no tiene el ultimo commit

Revisar rama y remoto:

```bash
git status --short --branch
git fetch origin
git pull origin main
```

### Hay cambios locales en WSL

No hacer reset destructivo sin revisar. Primero:

```bash
git status --short
git diff --stat
```

Decidir si esos cambios se guardan, se commitean o se descartan manualmente.
