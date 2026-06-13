# Operator Console Design System

## Objetivo

El design system de HomePilot mantiene una interfaz premium, local-first y operativa sin depender de estilos sueltos por pantalla. La fuente de verdad visual vive en tokens CSS, Tailwind y componentes base reutilizables.

## Fuentes de Verdad

| Area | Archivo | Uso |
|---|---|---|
| Tokens CSS | `apps/operator-console/src/index.css` | Colores, superficies, radius, motion, efectos y sombras |
| Tailwind bridge | `apps/operator-console/tailwind.config.js` | Exponer tokens a clases utilitarias |
| Primitives UI | `apps/operator-console/src/components/ui` | Controles reutilizables |
| Guia frontend | `docs/operator-console-frontend.md` | Reglas de modularidad visual |

## Tokens Principales

### Superficies
- `background`: canvas base.
- `card`: paneles y superficies persistentes.
- `popover`: modales, dropdowns y contenido elevado.
- `border` / `border-subtle`: lineas de separacion.

### Estados
- `primary`: accion principal e identidad HomePilot.
- `success`: online, sincronizado o completado.
- `warning`: atencion o estado intermedio.
- `danger` / `destructive`: error, riesgo o accion destructiva.
- `muted`: informacion secundaria.

### Radius
- `rounded-control`: botones, inputs y controles compactos.
- `rounded-card`: tarjetas.
- `rounded-panel`: paneles grandes y banners.
- `rounded-modal`: modales.
- `rounded-pill`: pills y avatares circulares.

### Tipografia
- `text-micro`: indicadores muy compactos.
- `text-label`: labels uppercase y chips.
- `text-caption`: metadatos.
- `text-body`: texto de controles.

## Componentes Base

Usar estos antes de crear estilos manuales:

- `Button`: acciones con variantes `primary`, `secondary`, `outline`, `ghost`, `danger`.
- `IconButton`: acciones icon-only con `aria-label` obligatorio.
- `Card`: superficies repetibles.
- `Input` / `SearchInput`: campos de texto.
- `Select` / `SelectField`: selectores.
- `SegmentedControl`: tabs compactos, filtros y toggles mutuamente excluyentes.
- `StatusPill`: estados semanticos.
- `Modal`: dialogos comunes.
- `AlertBanner`: mensajes persistentes de error, warning, success o info.
- `EmptyState`: estados vacios reutilizables.
- `SidebarItem`: navegacion lateral.
- `SectionHeader`: encabezados de vista, seccion y grupo.

## Reglas

1. No usar colores crudos como `text-white`, `rose-500`, `emerald-500`, `shadow-black` si existe token semantico.
2. No crear botones manuales cuando `Button` o `IconButton` cubran el caso.
3. No crear filtros manuales cuando `SegmentedControl` cubra el caso.
4. No crear estados vacios manuales cuando `EmptyState` cubra el caso.
5. No crear banners manuales cuando `AlertBanner` cubra el caso.
6. Usar radius nombrados antes que `rounded-[...]` en componentes nuevos.
7. Las vistas pueden componer; no deben definir un lenguaje visual paralelo.
8. Todo componente visual nuevo debe aceptar props explicitas y no depender de estado global salvo que sea dueño del flujo.

## Estado Actual

El sistema visual ya tiene tokens, modo claro/oscuro, primitives principales y componentes de soporte para controles, filtros, alertas y estados vacios. La migracion completa debe mantener cambios incrementales: cada nueva pantalla o refactor debe reducir estilos manuales y reutilizar primitives existentes.
