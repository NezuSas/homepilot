# Documentation Index

## Purpose

This index is the entry point for current HomePilot engineering documentation.
Product and engineering documentation is maintained in English. Feature specs
remain the normative source for functional requirements and acceptance criteria.

## Current References

| Document | Purpose |
|---|---|
| `README.md` | Product overview, local development, and required validation. |
| `AGENTS.md` | Mandatory rules for AI-assisted repository work. |
| `docs/project-overview.md` | Product vision, principles, and non-goals. |
| `docs/architecture.md` | Current Edge architecture, boundaries, and runtime responsibilities. |
| `docs/modular-architecture-reference.md` | Ownership map for bounded contexts, routes, views, and composition roots. |
| `docs/codebase-audit-v1.md` | Evidence-based SDD, SOLID, documentation, and quality audit. |
| `docs/command-reference.md` | Installation, operation, validation, maintenance, and diagnostics commands. |
| `docs/homepilot-technical-guide.md` | Detailed implementation and runtime guide. |
| `docs/design-system.md` | Design tokens, UI primitives, and visual rules. |
| `docs/operator-console-frontend.md` | Frontend module boundaries and React/Zustand rules. |
| `docs/operator-console-component-catalog.md` | Reusable component catalogue. |
| `docs/dashboard-architecture-reference.md` | Dashboard hierarchy, cards, edit UX, and personalization, mapped against Home Assistant's Lovelace model. |
| `docs/local-windows-runtime.md` | Docker Desktop runtime profile. |
| `docs/local-wsl-workflow.md` | Windows-to-WSL deployment workflow. |
| `docs/spec-coverage-matrix.md` | Executable SDD mapping from source surfaces to primary specs. |
| `docs/quality/test-assurance-v1.md` | Test inventory, coverage baseline, ratchet, and required evidence. |
| `specs/` | Feature specifications and acceptance criteria. |

## Reading by Change Type

### UI changes

Read `docs/design-system.md`, `docs/operator-console-frontend.md`,
`docs/architecture.md`, and the relevant feature spec.

### API, runtime, authentication, or integration changes

Read `docs/architecture.md`, `docs/modular-architecture-reference.md`,
`AGENTS.md`, and the relevant feature spec.

### Documentation-only changes

Read this index, the relevant source document, and the governing spec whenever
the document describes functional behavior.

## Required Validation

Frontend or full-stack work:

```bash
npm run typecheck
npm run build
npm run build --prefix apps/operator-console
docker compose up --build
docker compose ps
```

Backend, API, authentication, runtime, gateway, or bootstrap work also requires:

```bash
npm run test
```

## Maintenance Rules

- Document implemented behavior only.
- Keep commands synchronized with the executable scripts and compose profiles.
- Do not mark a spec task complete without evidence for its acceptance criteria.
- Add a spec before introducing a new functional surface.
- Record behavior-changing refactors separately from documentation or audit work.