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
- `accent`: acento premium tipo champagne/brass para momentos residenciales de lujo.
- `success`: online, sincronizado o completado.
- `warning`: atencion o estado intermedio.
- `danger` / `destructive`: error, riesgo o accion destructiva.
- `muted`: informacion secundaria.

## Estrategia de Color

HomePilot compite contra sistemas residenciales premium, no contra un dashboard SaaS generico. La paleta debe comunicar control profesional, confianza local y lujo discreto.

### Modo Oscuro
- Base: grafito calido y profundo, no negro plano.
- Superficies: escalera de elevacion `background -> card -> popover`.
- Accion primaria: azul control refinado, usado para interaccion y navegacion activa.
- Acento premium: champagne/brass reservado para energia, iluminacion, escenas y momentos de valor residencial.
- Estados: verdes, amarillos y rojos sobrios, evitando tonos neon.

### Modo Claro
- Base: canvas claro profesional con suficiente contraste contra tarjetas y sidebar.
- Superficies: tarjetas porcelana con bordes mas visibles y sombras suaves.
- Accion primaria: azul mas serio y profundo que en el modo oscuro para mantener contraste.
- Acento premium: brass mas contenido para no convertir la UI en beige.
- Estados: mismos significados semanticos que en modo oscuro, ajustados para legibilidad.

### Criterio Visual
- El modo claro no debe verse lavado ni como plantilla blanca generica.
- El modo oscuro no debe perder separacion entre canvas, sidebar y cards.
- Las cards de dispositivos deben tener presencia suficiente para una consola residencial premium.
- Los estados activos pueden mezclar `primary` con una presencia minima de `accent` para sentirse mas HomePilot y menos dashboard generico.

### Uso
- `primary`: acciones principales, seleccion activa, navegacion y controles.
- `accent`: detalles premium y contextos de hogar, nunca como color dominante.
- `warning`: informacion energetica o atencion operativa.
- `success`: salud, conexion y sincronizacion.
- `danger` / `destructive`: errores, riesgos o eliminacion.

### Radius
- `rounded-control`: botones, inputs y controles compactos.
- `rounded-card`: tarjetas.
- `rounded-panel`: paneles grandes y banners.
- `rounded-modal`: modales.
- `rounded-pill`: pills y avatares circulares.

### Tipografia
- `text-micro`: indicadores técnicos muy compactos (10 px).
- `text-label`: labels uppercase y chips (11 px).
- `text-caption`: metadatos y texto secundario (12 px).
- `text-body`: texto normal y de controles (14 px).
- `text-card-title`: títulos de tarjetas (15 px).
- `text-section-title`: títulos internos de sección (18 px).
- `text-view-title`: títulos principales de pantalla (24 px).

Los tamaños arbitrarios `text-[Npx]` no deben usarse para roles cubiertos por esta escala. Las excepciones se reservan para visualizaciones de datos cuyo tamaño sea parte del componente.

## Componentes Base

Usar estos antes de crear estilos manuales:

- `PageFrame`: padding, ancho maximo y ritmo vertical de vistas no inmersivas.
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
8. No repetir `max-w-[1600px]`, `mx-auto` ni padding de pagina dentro de una vista si `PageFrame` ya gobierna el contenedor.
8. Todo componente visual nuevo debe aceptar props explicitas y no depender de estado global salvo que sea dueño del flujo.

## Estado Actual

El sistema visual ya tiene tokens, modo claro/oscuro, primitives principales y componentes de soporte para controles, filtros, alertas y estados vacios. La migracion completa debe mantener cambios incrementales: cada nueva pantalla o refactor debe reducir estilos manuales y reutilizar primitives existentes.
