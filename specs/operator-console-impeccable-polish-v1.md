# SPEC: Operator Console Impeccable Polish V1

**Status:** Implemented
**Date:** 2026-08-20
**Scope:** Visual-only polish of existing Operator Console surfaces.

## Problem Statement

The Operator Console already has a semantic token system and responsive component library. A static Impeccable review identified a small set of visual patterns that weaken the product's calm, local-first command-center character: bounce motion, decorative gradient headings, and a prominent side accent on dashboard titles.

## Scope

- Replace bounce motion in the session gate, conversation typing indicator, automation success feedback, and automation error feedback with restrained motion.
- Keep the existing HomePilot primary color and semantic tokens while using a solid foreground color for view headings.
- Replace the dashboard title side accent with a subtle top accent and token-based surface treatment.
- Preserve all API contracts, state transitions, interaction flows, content, responsive breakpoints, and theme behavior.

## Out of Scope

- New views, navigation, API contracts, stores, or backend behavior.
- A redesign of existing dashboard layouts or the HomePilot brand.

## Acceptance Criteria

- **AC1:** No `animate-bounce` utility remains in the Operator Console source.
- **AC2:** Typing and session progress feedback retain a visible, reduced-motion-safe state without bouncing.
- **AC3:** View-level headings use a solid semantic foreground color rather than gradient text.
- **AC4:** Dashboard title widgets retain visual hierarchy without a thick colored side border.
- **AC5:** Typecheck and both application builds succeed without behavioral regressions.