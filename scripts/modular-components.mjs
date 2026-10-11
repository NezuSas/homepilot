// Single source of truth for the Operator Console modular components.
// Shared by check-spec-coverage.mjs (documentation) and check-modular-contract.mjs (contract).

/** Components that must have docs/components/<Name>.md (historical list). */
export const documentedModularComponents = [
  'AlertBanner', 'AssistantCard', 'Button', 'Card', 'DeviceTileShell',
  'EmptyState', 'IconButton', 'Input', 'Textarea', 'Modal', 'PageFrame', 'SearchFilterBar',
  'SectionHeader', 'SegmentedControl', 'SearchableSelectField', 'SidebarItem', 'StatusPill',
  'ConfirmModal', 'CoverPositionControl', 'AudioInputPicker', 'InlineTabCreator', 'RangeInput',
  'LoadingState', 'SelectableOptionCard',
  'OverlayAccessibility', 'DatabaseBackupsCard', 'Heading',
];

/** Modular components that live outside components/ui (domain-level, still presentational). */
export const modularComponentsOutsideUi = [
  'ConfirmModal', 'CoverPositionControl', 'AudioInputPicker', 'InlineTabCreator', 'DatabaseBackupsCard',
];
