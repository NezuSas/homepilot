# Documentation Index

## Estado

La documentacion principal ya cubre vision, arquitectura, frontend modular, validacion y flujo operativo local/WSL. Este archivo sirve como punto de entrada para saber que leer segun la tarea.

## Mapa de Documentacion

| Documento | Uso principal | Estado |
|---|---|---|
| `README.md` | Entrada rapida al proyecto, comandos y puertos | Actualizado |
| `AGENTS.md` | Reglas estrictas para agentes y cambios asistidos | Fuente normativa |
| `docs/project-overview.md` | Vision de producto, principios y no-objetivos | Actualizado |
| `docs/architecture.md` | Arquitectura Edge/Cloud, runtime actual y limites | Actualizado |
| `docs/homepilot-technical-guide.md` | Guia tecnica completa: backend, frontend, DB, Docker, Home Assistant y WSL | Actualizado |
| `docs/design-system.md` | Tokens visuales, primitives UI y reglas de uso | Actualizado |
| `docs/operator-console-frontend.md` | Modularidad UI, patrones y checklist frontend | Actualizado |
| `docs/local-wsl-workflow.md` | Flujo Windows local, push a main y pull en WSL | Actualizado |
| `docs/release-readiness-v1.md` | Estado de preparacion V1 y deuda conocida | Actualizado |
| `specs/` | Especificaciones y acceptance criteria | Fuente funcional |

## Que Leer Por Tipo de Cambio

### Cambios de UI
Leer:
- `docs/design-system.md`
- `docs/operator-console-frontend.md`
- `docs/architecture.md`
- spec relevante en `specs/`

Validar:

```bash
npm run typecheck
npm run build
npm run build --prefix apps/operator-console
docker compose up --build
docker compose ps
```

### Cambios de API o Runtime
Leer:
- `docs/architecture.md`
- `AGENTS.md`
- spec relevante en `specs/`

Validar:

```bash
npm run typecheck
npm run build
npm run test
docker compose up --build
docker compose ps
```

### Cambios de Documentacion
Leer:
- `docs/documentation-index.md`
- documento especifico a editar
- spec relevante si el documento describe comportamiento funcional

Validar al menos:

```bash
npm run typecheck
npm run build
npm run build --prefix apps/operator-console
```

## Reglas de Mantenimiento

- No documentar comportamiento que el codigo no implemente.
- No marcar tareas de specs como completas sin verificar acceptance criteria.
- Si una spec esta incompleta, documentar el hueco antes de implementar.
- Mantener comandos de validacion sincronizados entre `README.md`, `AGENTS.md` y docs operativas.
- Documentar decisiones actuales como actuales, y planes futuros como futuros.
