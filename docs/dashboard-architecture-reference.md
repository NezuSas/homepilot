# Dashboard Architecture Reference — HomePilot vs. Home Assistant

## Purpose

Internal reference mapping HomePilot's dashboard system onto Home Assistant's
Lovelace hierarchy (Dashboard > Views/Tabs > Sections > Cards/Badges), so the
team has one accurate source of truth for how "Tableros" are actually built
today. This is a snapshot of the current implementation, not a design
proposal — see `specs/dashboard-layout-and-widgets-v1.md` for acceptance
criteria and history, and `.claude/plans/` session notes for the 2026-08-22
Home Assistant parity audit that produced most of the recent changes.

## 1. Hierarchy and Structure

| Home Assistant | HomePilot | Backing type / file |
|---|---|---|
| Dashboard | **Tablero** (`Dashboard`) | `packages/topology/domain/Dashboard.ts` |
| View (tab) | **Pestaña** (`DashboardTab`) | `apps/operator-console/src/views/dashboards/types.ts` |
| Section | **Sección** (`section` widget type, rendered by `SectionWidget`) | `apps/operator-console/src/views/dashboards/widgets/SectionWidget.tsx` |
| Card | **Tarjeta** (`SectionCardItem`, kinds in `SectionCardKind`) | `apps/operator-console/src/views/dashboards/widgets/sectionCardCatalog.ts` |
| Badge | **Insignia** — lives inside the pinned "Title" widget only | `apps/operator-console/src/views/dashboards/widgets/DashboardTitleWidget.tsx` |

Concretely, top to bottom:

- **Tablero (`Dashboard`)**: owned by one user, carries a visibility policy
  (`DashboardVisibility { roles, users, homes }`) and a list of tabs.
- **Pestaña (`DashboardTab`)**: `id`, `title`, `icon`, `background`,
  `backgroundOpacity`, `visibility.users`, `isDefault`, and `widgets[]`.
  There is **no per-tab layout-mode selector** (a `layout:
  'sections'|'masonry'|'sidebar'|'panel'` field existed but was never read by
  any renderer; it was removed from both frontend and backend types on
  2026-08-22 rather than left as a UI option that silently did nothing).
- **Widgets on a tab**: rendered in one flowing, dense CSS grid
  (`DashboardCanvas.tsx`) — HomePilot's equivalent of an HA Sections view.
  Widget types: `dashboard_title` (pinned, non-draggable, always first),
  `section`, `device_control`, `action_button`, `room_overview`/
  `room_summary`, `scene_shortcut`, `activity_feed`, `assistant_insight`,
  `system_status`, `energy_snapshot`, `clock_display`.
  `device_control`/`action_button` as *standalone* top-level widgets are
  only reachable via legacy JSON import — the in-app "add widget" flow only
  ever creates `dashboard_title` or `section` widgets.
- **Sección (`section` widget)**: the actual card-grid building block. It
  owns an ordered array of cards in `config.extra.cards`
  (`NormalizedSectionCardItem[]`), independent from the outer canvas grid.
- **Tarjeta (card)**: catalog kinds addable today are `light`, `cover`,
  `camera`, `sensor`, `media`, `action`, `room`, `scene`, and 4 clock
  variants (`cardKinds` in `sectionCardCatalog.ts`). `device`, `energy`, and
  `assistant` are valid kinds in the type union but not offered in the "add
  card" catalog (legacy/import-only).

## 2. Visual Components

- **Light/device tiles** (`light`/`device` kind, `SectionCardItem`'s
  compact branch): bare icon (no background chip) + title wrapping up to
  two lines, no separate "ON"/"OFF" text — color of the icon/title alone
  carries the active state. Modeled directly on HA's tile card.
- **Action cards**: icon + status pill (`idle`/`pending`/`success`/`error`)
  + title/subtitle, one-tap execute (`POST /devices/:id/command`).
- **Scene cards** (unified button): bound to either a HomePilot scene or an
  automation ("routine"); the picker tags each option and the bound target
  is distinguished by an `automation:` id prefix. Executes via
  `POST /scenes/:id/execute` or `POST /automations/:id/run`.
- **Sensor cards** (`SensorMetricCard`): metric value/gauge with an
  explicit "no reading" state.
- **Media cards**: transport controls (play/pause/skip) and volume.
- **Cover/curtain cards**: position slider, compact or standard density.
- **Camera cards**: live HLS preview with a fullscreen viewer modal.
- **Room cards**: device count + active-device count, opens the room
  detail view.
- **Clock cards** (4 styles: digital, analog-classic, analog-minimal,
  premium): always full width, show time (+ weather on some styles).
- **Badges (Insignias)**: HomePilot does **not** have a generic per-view
  badge strip like HA. Badges only exist inside the pinned "Dashboard
  Title" widget: a weather badge, a live HH:MM time badge, and tab-link
  badges (jump to another tab of the same dashboard). Added/removed via
  that widget's own edit controls; alignment (left/center/right) is
  configurable.

## 3. Edit Mode and Layout Customization

**Outer canvas (per tab):**
- CSS Grid, 1–3 responsive columns derived from container/viewport width
  (a portrait-kiosk viewport gets a dedicated 2-column override).
- Each widget's row height is auto-measured via `ResizeObserver`
  (`DashboardCanvas.tsx`) — Home Assistant Sections-style auto-height, not a
  fixed row per widget.
- Reordering: `@dnd-kit` (`DndContext` + `SortableContext`), works with
  mouse, touch, and keyboard, via a dedicated grip handle.
- Resizing: a `SegmentedControl` (1..N columns) **and** (added 2026-08-22)
  a drag-to-resize corner handle. Dragging snaps to the same 1..N column
  steps the control already offers — no new free-form sizing model.

**Inside a Section:**
- Cards live in a dense CSS grid (`grid-flow-row-dense`) with each card's
  row-span computed from its own measured height (`ResizeObserver`), so a
  tall card (e.g. a media player) no longer stretches short row-mates
  (fixed 2026-08-22; previously all cards sharing a grid row shared its
  tallest member's height).
- Reordering: `@dnd-kit`, same library as the outer canvas (migrated
  2026-08-22 from native, touch-incapable HTML5 drag events). Required
  extracting the card renderer into its own `SectionCardItem` component
  since `useSortable` must run once per card instance.
- Resizing: a small/medium/full categorical picker in the card editor
  modal, **and** a drag-to-resize corner handle (added 2026-08-22) that
  snaps to the same three sizes.
- Add-card catalog: a modal with free-text search **and** category filter
  chips — Control, Información, Automatización, Reloj (added 2026-08-22).
  Each entry shows a live preview before adding.
- Editing a card/widget: a pencil icon opens a config modal with
  kind-specific fields (entity binding, title, icon, span, and kind-specific
  options such as the scene/routine picker).

## 4. Variables and Personalization

- **Dynamic greeting**: the pinned Title widget can resolve the
  authenticated user's display name (`getDashboardUserDisplayName` in
  `dashboardUtils.ts`: `displayName` → `username` → fallback). This is the
  **only** dynamic value HomePilot injects into dashboard text today — it
  is not a general template engine. HomePilot has **no Jinja2-style
  templating** (`{{ states('sensor.x') }}`) in card titles/descriptions,
  and no per-card conditional visibility based on entity state.
- **Visibility**: a dashboard has `DashboardVisibility { roles, users,
  homes }`; a tab additionally has its own `visibility.users` list. Both
  are explicit user/role/home lists — there is no "visible to admins only"
  style role gate beyond what's encoded in those lists.
- **`isDefault`** (per tab): opens automatically on page load instead of
  the first tab.
- **Background + backgroundOpacity** (per tab): a locally stored image
  reference, not portable across exports.
- **Export/import**: a versioned `homepilot-dashboard` transfer package
  deliberately excludes ownership, visibility policy, and local background
  references — importing a dashboard can never disclose another resident's
  access policy or point at storage that doesn't exist on the new install.
- **Revisions**: every save creates a local, restorable snapshot (`title`,
  `visibility`, `tabs`), also excluding backgrounds.
- **System Variables** (`packages/system-vars`, `SystemVariableRoutes`): a
  general persistent key-value store for automations/runtime configuration.
  It exists as a separate backend feature and is **not** currently wired
  into dashboard card text or any templating layer — worth knowing this is
  a distinct system from anything described above, not a hidden
  templating mechanism.

## 5. Known Gaps vs. Home Assistant (as of 2026-08-22)

For context on what's intentionally not built yet, see the "Post-audit
roadmap" note in `specs/dashboard-layout-and-widgets-v1.md` §8: a per-view
badge strip (beyond the Title widget's badges) and a YAML/code edit mode per
view are deliberately out of scope for now. Dashboard-level export/import
already covers part of the "edit as code" use case.
