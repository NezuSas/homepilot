# HomePilot

HomePilot Edge is a local-first smart-home appliance platform. It runs the API,
Operator Console, local persistence, diagnostics, automation workflows, Home
Assistant integration, native cameras, Sonoff LAN support, and the local
assistant from the Edge environment.

## Stack

| Layer | Technology |
|---|---|
| API | Fastify v5 and TypeScript |
| UI | React, Vite, and TypeScript |
| Realtime | `ws` on the Fastify server |
| Runtime | Docker Compose |
| Persistence | Local SQLite data directory |
| Validation | npm checks, tests, builds, and Compose validation |

## Install

```bash
npm install
npm install --prefix apps/operator-console
```

## Develop

```bash
npm run dev
```

The complete install, runtime, diagnostics, and deployment reference is in
[docs/command-reference.md](docs/command-reference.md).

## Required Validation

```bash
npm run typecheck
npm run test
npm run build
npm run build --prefix apps/operator-console
npm run verify:quality
```

## Architecture

- `apps/api`: HTTP and realtime adapters.
- `apps/operator-console`: browser UI shell.
- `packages/*`: bounded contexts and integration adapters.
- `infrastructure/assemblers`: composition root bindings.
- `specs/`: functional specifications and acceptance criteria.

See [docs/architecture.md](docs/architecture.md) and
[docs/modular-architecture-reference.md](docs/modular-architecture-reference.md).