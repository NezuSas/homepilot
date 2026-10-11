# Libro de diseño del Operator Console

Spec: `specs/operator-console-design-book-v1.md`.

La galería `apps/operator-console/design-book.html` muestra una demostración de cada componente de `src/components/ui` con sus variantes y estados, usando solo los componentes compartidos y los tokens reales. Solo la sirve el servidor de desarrollo; no forma parte de `npm run build --prefix apps/operator-console`.

## Abrir la galería

```
npm run dev --prefix apps/operator-console
```

Luego abre `http://127.0.0.1:5173/design-book.html?theme=light&only=Button`.

- `theme=dark|light`: tema (oscuro por defecto).
- `only=<Componente>`: muestra una sola demostración (por ejemplo `Modal`, `ActionMenu`).
- Cuando termina de montar y cargar las fuentes, la página define `window.__bookReady = true`.
- Cada demostración es una `<section data-book-component data-book-capture>`; `data-book-open` indica el selector que abre la capa (`ActionMenu`, `SearchableSelectField`).

## Generar el PDF

`npm run docs:design-book` arranca Vite, captura cada componente por dispositivo y tema y compone `docs/design-book/HomePilot-libro-de-diseno.pdf`. Los artefactos se ignoran en Git.

## Añadir un componente

Agrega una clave entre comillas con el nombre del archivo en `src/design-book/demos*.tsx`. `npm run check:design-book-coverage` falla si falta una demostración o si una clave no corresponde a un componente.
