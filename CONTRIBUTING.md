# Contributing to HomePilot

HomePilot prioritizes explicit architecture, quality, and AI-readable code.

## Contribution Flow

1. Work from a focused branch when repository policy requires it.
2. Reference an approved or implemented feature spec and its acceptance
   criteria for every functional change.
3. Keep the change small and within the defined bounded context.
4. Pass the required validation before requesting review or publishing.

## Code Principles

- Types are documentation: do not use `any` to hide contract differences.
- Fail safely and visibly: do not silently swallow invalid state or errors.
- Prefer pure functions for domain decisions where possible.
- Use descriptive names that explain intent and responsibility.
- Respect dependency direction and inject infrastructure from composition roots.

## Review Questions

- Does the change preserve the boundaries documented in
  `docs/architecture.md`?
- Does the governing spec explain authorization, data change, safe failure, and
  validation?
- Are tests meaningful behavior evidence rather than language-level checks?
- Does the change introduce unused state, handlers, imports, or duplicate
  responsibilities?