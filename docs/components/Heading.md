# Heading

**Source:** `apps/operator-console/src/components/ui/Heading.tsx`
**Family spec:** `specs/operator-console-pattern-adoption-v1.md`

## Purpose

The single place where titles get their typography. It maps five text styles of the
catalog to tokens, so each title has one counterpart in Figma (text style) and no view
needs raw `text-*`/`font-*` classes on a heading.

## Contract

| Variant | Default element | Style | Use |
| --- | --- | --- | --- |
| `view` | `h1` | `text-view-title`, bold, tight tracking | Page title |
| `section` | `h2` | `text-section-title`, bold, tight tracking | In-page section |
| `card` | `h3` | `text-card-title`, bold, snug | Title inside a card or tile |
| `item` | `h3` | `text-body-compact`, semibold | Row or list-item title |
| `label` | `span` | `text-label`, black, uppercase | Group label |

`as` changes the semantic element (`h1`–`h4`, `p`, `span`) without changing the style, so
the document outline stays correct. It accepts `className` (merged with `cn`) and every
native heading attribute, and forwards its ref. It has no state, no i18n and no store.

## Usage

Pick the variant by role, not by size. `SectionHeader` renders its title through
`Heading` (`view`, `section`, `label` for the group level). Add a variant to the catalog
instead of overriding typography with `className`.

## States and Acceptance

Long words wrap (`break-words`) and the heading never forces its parent wider
(`min-w-0`). Text colour follows the theme tokens in both dark and light themes.
