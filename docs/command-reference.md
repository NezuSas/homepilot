# HomePilot Command Reference

## Prerequisites

- Node.js 20.19 to 22.x and npm 10 or later.
- Docker Engine on Linux, or Docker Desktop on Windows.
- Run commands from the repository root unless stated otherwise.

## Install Dependencies

```bash
npm install
npm install --prefix apps/operator-console
```

## Local Development

Start API and UI development servers:

```bash
npm run dev
```

Start only the Operator Console:

```bash
npm run dev:ui
```

Start only the API:

```bash
npm run dev:api
```

## Deploy the Appliance Runtime

The maintenance script selects the correct Compose overlay for the current
operating system and installation profile.

```bash
bash scripts/homepilot-maintenance.sh --deploy --yes
```

Select a profile explicitly when required:

```bash
bash scripts/homepilot-maintenance.sh --profile bridge_ha --deploy --yes
bash scripts/homepilot-maintenance.sh --profile native_only --deploy --yes
bash scripts/homepilot-maintenance.sh --profile ha_companion --deploy --yes
```

Check service health without changing the runtime:

```bash
bash scripts/homepilot-maintenance.sh --status
```

## Compose Profiles

Linux MiniPC, bridge to an existing Home Assistant:

```bash
docker compose -f docker-compose.office.yml up -d --build
```

Windows Docker Desktop, bridge or native profile:

```powershell
docker compose -f docker-compose.office.yml -f docker-compose.desktop.yml up -d --build
```

Windows Docker Desktop, Home Assistant companion profile:

```powershell
docker compose -f docker-compose.yml -f docker-compose.ha-companion.desktop.yml up -d --build
```

## Runtime Inspection

```bash
docker compose ps
docker compose logs --tail=150 homepilot-api
docker compose logs --tail=150 homepilot-ui
curl -fsS http://127.0.0.1:3000/health
```

On Docker Desktop, the API is normally exposed on port `13000` and the UI on
port `8080`.

## Quality and Release Validation

Run the complete engineering validation suite:

```bash
npm run verify:quality
```

Run individual checks:

```bash
npm run check:spec-coverage
npm run check:architecture-boundaries
npm run check:no-production-any
npm run check:bdd-traceability
npm run check:module-test-coverage
npm run check:docker-profiles
npm run test:responsive
npm run typecheck
npm run test
npm run build
npm run build --prefix apps/operator-console
```

## Database and Diagnostics

The canonical appliance database is `data/homepilot.db`. Do not copy or create
an alternative database for the same appliance unless performing an explicit,
reviewed recovery operation.

Inspect the current database through the running API container:

```bash
docker compose exec -T homepilot-api node -e "const Database=require('better-sqlite3'); const db=new Database('/app/data/homepilot.db',{readonly:true}); console.table(db.prepare('SELECT id,name,created_at FROM homes').all())"
```

Inspect available memory on a Linux MiniPC:

```bash
free -h
```

Inspect Docker disk usage:

```bash
docker system df
```

## Source Control Workflow

From Windows development:

```bash
git status
git pull --ff-only
git add <files>
git commit -m "<concise message>"
git push origin main
```

On the Linux appliance after the push:

```bash
git pull --ff-only
bash scripts/homepilot-maintenance.sh --deploy --yes
bash scripts/homepilot-maintenance.sh --status
```

## Safety Notes

- Use `--status` before cleanup or deployment when diagnosing a live appliance.
- Do not delete `data/`, Docker volumes, or the SQLite database to solve a
  connectivity issue.
- Treat device availability as a physical integration state: verify power,
  network, and vendor application status before changing HomePilot code.