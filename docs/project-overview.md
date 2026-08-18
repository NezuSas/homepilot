# HomePilot Project Overview

## Product

HomePilot is a local-first smart-home platform for professionally installed
homes. It combines an appliance-style Edge runtime with an Operator Console for
control, automation, diagnostics, and assisted interaction.

## Vision

Provide a reliable, customizable, and intelligent home-control system that
operates locally while supporting advanced automation without making a cloud
connection a prerequisite for physical control.

## Core Principles

1. **Modularity:** domain workflows, protocol adapters, and UI composition have
   explicit boundaries.
2. **Local first:** turning on a light, controlling a cover, and executing a
   local automation must remain available when the internet is unavailable.
3. **AI ready:** assistant workflows use typed state, explicit authorization,
   confirmation gates, and auditable execution.
4. **Spec driven:** functional changes are traced to an approved or implemented
   feature spec and acceptance criteria.
5. **Explicit behavior:** no hidden business rules, implicit cross-context
   access, or undocumented fallback behavior.

## Current Product Surface

The local runtime and Operator Console cover home setup, spaces, device
assignment, scenes, automations, dashboards, energy, diagnostics, users,
Home Assistant integration, Sonoff LAN devices, native cameras, and the local
HomePilot assistant.

The UI follows a practical composition rule:

- Views orchestrate screen-level data, effects, navigation, and actions.
- Components render reusable sections.
- UI primitives live in `components/ui`.
- The responsive sidebar supports a full desktop view and an icon rail without
  compressing labels during transitions.

## Target Audience

- Premium smart-home residents.
- Integrators and operators who require reliable local control, professional
  installation workflows, and auditable automation.

## Non-Goals

- An unstructured DIY integration collection.
- A cloud-only control system.
- A generic drag-and-drop website builder.

## Reference Documents

Start with `README.md`, `docs/architecture.md`,
`docs/modular-architecture-reference.md`, and `docs/command-reference.md`.