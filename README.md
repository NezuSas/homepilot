# HomePilot

HomePilot Edge is a local-first smart home appliance platform. It runs the API, Operator Console UI, Home Assistant integration, local persistence, diagnostics, and automation workflows from the Edge environment first. Cloud capabilities are additive and must not be required for local operation.

## Current Stack

| Layer | Technology | Notes |
|---|---|---|
| API | Fastify v5 + TypeScript | Route logic lives in `RouteHandler` implementations. |
| UI | React + Vite + TypeScript | App located in `apps/operator-console`. |
| Runtime | Docker Compose | Runs API, UI, Ollama, STT and TTS. Customer deployments can link to an existing Home Assistant instead of creating a new one. |
| Persistence | Local durable data directory | `data/` is ignored by Git and mounted by Docker. |
| Validation | npm scripts + Docker | Typecheck/build plus runtime compose validation. |

## Local Development

Install dependencies once:

```bash
npm install
npm install --prefix apps/operator-console
```

Run the API and UI locally:

```bash
npm run dev
npm run dev:ui
```

Run the Docker runtime:

```bash
docker compose up --build
```

After Docker is up:

- UI: `http://localhost`
- API: `http://localhost:3000`
- Home Assistant: `http://localhost:18123`

## Required Validation

Before considering frontend or full-stack work complete, run:

```bash
npm run typecheck
npm run build
npm run build --prefix apps/operator-console
docker compose up --build
docker compose ps
```

For backend, API, auth, runtime, gateway, or bootstrap changes, also run:

```bash
npm run test
```

## Operator Console UI

The UI follows a modular composition rule:

- `apps/operator-console/src/views`: route-level orchestration, data fetching, local state, and high-level flow.
- `apps/operator-console/src/components`: reusable UI components and extracted view sections.
- `apps/operator-console/src/components/ui`: low-level primitives such as buttons, inputs, pills, and sidebar items.

Views should not accumulate large repeated JSX blocks. Extract stable sections into components and pass explicit typed props. See `docs/operator-console-frontend.md`.

## Windows Local to WSL Flow

Current working flow:

```bash
git status
git add -A
git commit -m "<message>"
git push origin main
```

Then inside WSL:

```bash
git checkout main
git pull origin main
docker compose up --build
```

See `docs/local-wsl-workflow.md`.

## Key Documentation

- `AGENTS.md`: strict rules for AI-assisted work.
- `docs/architecture.md`: system architecture and boundaries.
- `docs/design-system.md`: Operator Console visual tokens and UI primitives.
- `docs/documentation-index.md`: documentation map and validation guide.
- `docs/operator-console-frontend.md`: current UI architecture and modularity rules.
- `docs/local-wsl-workflow.md`: Windows local to WSL operational flow.
- `docs/release-readiness-v1.md`: V1 readiness, hardening, and known debt.
- `specs/`: feature specifications and acceptance criteria.
