# Operator Console Frontend

## Scope

The Operator Console is located in `apps/operator-console` and uses React,
Vite, and strict TypeScript. It is a browser shell over explicit Edge API
contracts; it does not own domain business rules.

## Module Boundaries

```text
apps/operator-console/src/
  App.tsx                    authenticated shell and realtime orchestration
  views/                     route-level screen orchestration
  components/                reusable screen sections and device presentation
  components/ui/             design-system primitives
  stores/                    bounded client state and API refresh actions
  design-system/             tokens and shared visual configuration
  lib/                       pure presentation and API helpers
```

## Required Rules

1. Views coordinate data, effects, navigation, and screen-level actions.
2. Components render stable visual sections through explicit typed props.
3. UI primitives are reused before introducing a bespoke button, input, modal,
   filter, empty state, or status surface.
4. Domain decisions remain in the API/application layer.
5. Zustand selectors must use stable references; effects must depend on stable
   primitive values or callbacks.
6. Refreshes keep prior data visible and avoid repeated loading skeletons.
7. Do not introduce `any`, unused state, unused handlers, or partial flows.
8. Dashboard visibility is enforced by backend access rules and mirrored in
   navigation only as a presentation concern.
9. The collapsed desktop sidebar remains an icon rail; it must not collapse to
   zero width or compress labels while changing state.

## Component Responsibilities

- `views/`: route and feature orchestration.
- `components/`: specialized reusable sections such as device tiles, camera
  media, assistant cards, and dashboard areas.
- `components/ui/`: buttons, inputs, dialogs, tabs, status pills, layout
  frames, and accessibility primitives.
- `stores/`: request de-duplication, current UI data, session state, and
  bounded cross-view client state.

## Known Controlled Complexity

`App.tsx`, dashboard section composition, and conversation screens coordinate
multiple UI concerns. They are protected by extracted collaborators and tests.
Any further split must preserve realtime sequencing and should be governed by a
feature spec.

## Validation

```bash
npm run typecheck
npm run build
npm run build --prefix apps/operator-console
npm run test:responsive
npm run lint --prefix apps/operator-console
```

For runtime-affecting UI changes, also validate the applicable Docker Compose
profile and `npm run test`.