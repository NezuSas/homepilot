# Input

AC79 refinement: standard surface is 44px high; label typography and 8px gap match the normal SearchableSelectField. Specialized explicit sizes remain opt-in. Numeric draft editing uses [NumberInput](NumberInput.md), not immediate `Number('')` conversion.

**Source:** `apps/operator-console/src/components/ui/Input.tsx`
**Family spec:** `specs/operator-console-modular-components-v1.md`

## Purpose

Reusable text input for simple values controlled by a view.

## Contract

Extends native `input` attributes with shared visual variants.
`containerClassName` controls container width or row behavior; `className`
customizes only the input element; and `endAdornment` places a compact action
inside field geometry. When given a `label`, it creates and associates an
accessible id automatically. Value, validation, and business message belong to
the consumer.

## Usage

Use with an accessible label, translated placeholder, and an error explained at
or beside the field. It applies to text, password, identity, onboarding, home,
room, and scene names. Use `SearchInput` for simple modular searches. It does
not replace ranges, files, text areas, radios, or domain-specific inputs. When
sharing a row with a primary action, use `Button size="md"` or `IconButton`
without local geometry overrides to preserve the field's base `h-11` height.

## States and Acceptance

Empty, focus, value, disabled, and error states preserve contrast, visible
focus, and long-text support. Container and control shrink within grids or flex
rows; long labels and help wrap without horizontal overflow. `endAdornment`
reserves internal space without changing base height. Help or error is
referenced through `aria-describedby`; error also exposes `aria-invalid`.

## Shared field design (AC79)

Input and Textarea reuse `hp-text-field`, `hp-field-label` and
`hp-field-message` in index.css. Labels use normal case and medium weight;
placeholder/help use unattenuated semantic ink. Radius comes from
`--radius-control`, focus remains visible and native props/ref/events are unchanged.
Trailing actions reserve 56px, sufficient for the standard 44px IconButton
plus separation from the text. Consumer-specific explicit dimensions remain
compatible; this change does not certify all historical overrides.

Review `/tests/ui/button-review.html?component=fields` with the Vite development
server active. Synthetic examples cover empty, edited, search, error, disabled
and read-only fields, independently from login and API.

## Adopted consumers

AutomationBuilderIdentityField, AutomationBuilderTriggerSection and
AutomationWorkbenchForm no longer override field height, radius, typography,
palette or focus. They keep labels, values, validation, autofocus and callbacks.
AST tests protect this adoption. Other historical consumers remain pending
individual migration; this does not certify application-wide adoption.

DashboardTitleBar and InlineTabCreator also use the central field style, keeping
their Enter/Escape handlers and external flex layout. DashboardCreateForm retains
its controlled value/submitting state and now names the input accessibly; it is
currently not referenced by a production view and is covered as a legacy component.
The inline tab container reserves 224px for writing plus two 44px actions; it
does not shrink between neighboring tabs. The existing tab strip owns scrolling.

DashboardViewConfigModal, UserProfileModal, AssistantActionModal and
TopologyRoomDetailPanel delegate field appearance to Input as well. Read-only
routes, profile maxLength, assistant autofocus and room form submission remain
consumer responsibilities; none is replaced by a second field implementation.
The view editor uses the shared SegmentedControl without local option skins or
hidden mobile labels. Regression guards protect these named consumers; remaining
historical consumers still require individual migration.

LoginView and FirstAdminSetupView share the same surface and geometry, including
icon spacing supplied by Input. Password types, required/minLength/pattern,
disabled state and submission/error behavior are unchanged. The regression suite
uses fictional inputs and intercepts authentication/bootstrap requests; it does
not create local users or change credentials.

TopologyView also uses shared fields for home renaming and room creation. Layout
remains external; the room creation field has an explicit accessible name using
its existing translation. Consumer constraints, permission checks, trimming and
Enter submission are unchanged and tested against intercepted topology routes.

SectionCardCatalogModal and SectionCardEditorModal also delegate input appearance
to the shared primitive. Search retains its icon and translated accessible name;
card title editing retains draft callbacks and validation.

SceneBuilderModal, SceneDeviceSelector, RoutineSharingField and EventFilters
delegate field styling to Input/SearchInput. EventFilters no longer overrides
labels from its grid wrapper. Search, sharing selection, scope and values remain
owned by the consumers.

DeviceInspector uses the central field and a wrapping external layout, instead
of a fixed-width field and local 32px skin. It keeps autofocus and Enter/cancel
handlers and supplies the existing translated accessible name.
