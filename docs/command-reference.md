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

Los comandos directos siguientes sirven para diagnóstico; para instalar o actualizar un appliance, usar `homepilot-maintenance.sh --deploy`, que selecciona también el override VAAPI cuando corresponde. Ver [checklist de entrega](client-appliance-delivery.md) antes de preparar la MiniPC de un cliente.

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

Optional local assistant model (Windows Docker Desktop with a GPU). The default profiles answer deterministically; this overlay adds a local model that only proposes plans for phrasings the deterministic assistant does not understand:

```powershell
ollama pull qwen3:8b
docker compose -f docker-compose.yml -f docker-compose.ha-companion.desktop.yml -f docker-compose.assistant-llm.yml up -d --build --no-deps homepilot-api
```

Set `HOMEPILOT_LLM_MODEL` to use another Ollama model. Remove the last `-f` and redeploy to return to the deterministic assistant. See `specs/assistant-local-llm-opt-in-v1.md`.

## Runtime Inspection

```bash
docker compose ps
docker compose logs --tail=150 homepilot-api
docker compose logs --tail=150 homepilot-ui
curl -fsS http://127.0.0.1:3000/health
```

On Docker Desktop, the API is normally exposed on port `13000` and the UI on
port `8080`.

## Planner V2 Shadow Review

Aggregate the secret-free Planner V2 shadow diagnostics on the appliance:

```bash
docker compose logs --no-log-prefix homepilot-api | npm run review:planner-v2-shadow
```

Use strict automated eligibility checks without enabling Planner V2 execution:

```bash
docker compose logs --no-log-prefix homepilot-api | npm run review:planner-v2-shadow:strict
```
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
npm run check:modular-components
npm run check:ui-primitives
npm run check:ui-patterns
npm run check:design-catalog
npm run check:design-book-coverage
npm run test:responsive
npm run typecheck
npm run test
npm run build
npm run build --prefix apps/operator-console
```

### Responsive validation: three ways to run it

```bash
# Complete suite: release gate and CI. Includes the production Clock contract.
npm run test:responsive

# Fast local iteration: everything except the Clock contract phase.
npm run test:responsive:fast

# Targeted by area (a few minutes). Arguments are forwarded to Playwright.
npm run test:responsive -- -g "Room devices|Unified control tile|Sensor clarity"
```

Use the fast or targeted forms while iterating and run the complete suite before
publishing. `HOMEPILOT_SKIP_CLOCK=1` is equivalent to `--skip-clock`.

The Clock contract sweep runs its batches in parallel with 4 workers by default
(about 2 minutes for 51 tests, versus 7.9 minutes serial) and the application
suite uses 5 workers. Pass `--workers=N` to change either. Spec:
`specs/responsive-validation-speed-v1.md`.

### Design system and component library

What each check enforces and how to refresh the generated documents:

| Command | Purpose |
|---|---|
| `npm run check:modular-components` | Every shared component in `components/ui` follows the modular contract: `className` with `cn`, native element contract, no i18n/store/fetch, own test, documentation, barrel export. |
| `npm run check:ui-primitives` | Buttons, text fields, selects, textareas and native dialogs are only built through the shared primitives. |
| `npm run check:ui-patterns` | Headings, cards, chips, banners, empty states, skeletons and overlays are not rebuilt by hand; counts may only go down (`scripts/ui-pattern-baseline.json`), and each remaining case needs a reason in `scripts/ui-pattern-exceptions.json`. |
| `npm run docs:design-catalog` / `npm run check:design-catalog` | Regenerate / verify `docs/design-system-catalog.md` from the code. |
| `npm run check:design-book-coverage` | Every shared component has a demo in the gallery. |
| `npm run docs:design-book` | Generate the printable design book in `docs/design-book/` (git-ignored). See `docs/design-book.md`. |

Specs: `specs/operator-console-modular-contract-v1.md`,
`specs/operator-console-pattern-adoption-v1.md`,
`specs/operator-console-design-book-v1.md`.

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
