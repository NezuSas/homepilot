# SPEC: Operator Console Modular Components V1

**Estado:** Implementado  
**Autor:** HomePilot Engineering  
**Fecha:** 2026-07-17  
**Código trazado:** `apps/operator-console/src/components/ui/`, componentes compartidos y `apps/operator-console/src/design-system/tokens.ts`

## 1. Declaración del Problema

La consola contiene componentes reutilizables para interacción, navegación, estados y presentación. Sin contratos funcionales explícitos, una mejora visual puede romper responsive, accesibilidad, traducciones o consistencia entre vistas.

## 2. Alcance

- Definir el contrato de los primitivos UI, componentes transversales y familias de tarjetas reutilizables.
- Formalizar variantes, estados, reglas responsive, accesibilidad e i18n.
- Establecer la responsabilidad de los tokens de diseño como única fuente de tamaños, espaciados, radios, color y tipografía compartidos.
- Cubrir los componentes comunes que no pertenecen exclusivamente a un bounded context de negocio.

## 3. Fuera de Alcance

- Reglas de negocio de dispositivos, escenas, automatizaciones, cámaras o asistentes.
- Contratos de widgets de dashboard; pertenecen a `dashboard-layout-and-widgets-v1.md`.
- Definición de identidad visual de marca fuera de los tokens vigentes.

## 4. Requisitos Funcionales

- **REQ-01:** Todo componente reutilizable debe recibir datos y callbacks explícitos; no debe acceder a reglas de negocio de forma implícita.
- **REQ-02:** Primitivos visuales deben utilizar tokens del design system y no tamaños, colores o tipografías hardcodeadas fuera de excepciones documentadas.
- **REQ-03:** Botones, inputs, selects, modales, filtros, tarjetas y estados deben contemplar estados normal, activo, hover/focus, deshabilitado, loading, error y vacío cuando aplique.
- **REQ-04:** Los modales deben permanecer dentro del contenedor de aplicación, preservar foco, permitir cierre explícito y no ocultar acciones críticas fuera del viewport. Cuando una acción debe permanecer disponible, se usará el `footer` fijo del `Modal`.
- **REQ-05:** Componentes de navegación deben conservar etiquetas legibles, área táctil suficiente y colapsado usable en móvil/tablet/escritorio.
- **REQ-06:** Texto visible, labels, títulos, estados, placeholders y mensajes deben resolverse mediante i18n ES/EN o datos de dominio ya traducidos.
- **REQ-07:** Una tarjeta genérica solo debe presentar controles soportados por las capacidades entregadas por su dominio.
- **REQ-08:** Una fila que combine un `Input` y una acción primaria debe usar primitivas modulares y conservar una altura visual común.
- **REQ-09:** Cada clave literal de traducción usada por la consola existe en ambos catálogos ES/EN; las etiquetas de tipos de dispositivo se presentan traducidas y no como valores técnicos de dominio.
- **REQ-10:** Los controles segmentados con etiquetas largas deben conservar una escala tipográfica compacta, una sola línea por opción y etiquetas legibles sin desborde en móvil, tablet y escritorio.
- **REQ-11:** La navegación lateral debe usar la escala tipográfica compartida; las variantes compactas de marca, guía y rol no pueden recortar información crítica ni reutilizar descripciones extensas de otras vistas.
- **REQ-12:** Las acciones convencionales de la consola deben usar `Button` o `IconButton`; los elementos HTML nativos solo pueden residir dentro de los primitivos UI o corresponder a una semántica especializada documentada.
- **REQ-13:** Los campos generales de texto, contraseña, correo, búsqueda y texto multilínea deben usar `Input` o `Textarea`; las selecciones de negocio deben usar `SearchableSelectField`; archivo, radio y el compositor conversacional mantienen su control nativo especializado.
- **REQ-14:** La tipografía de vistas y componentes debe usar escalas con nombre del design system; las utilidades Tailwind arbitrarias `text-[…]` no se permiten fuera de `components/ui`.
- **REQ-15:** Las confirmaciones y errores visibles deben usar `ConfirmModal`, `AlertBanner` u otro componente modular de feedback; no se permiten diálogos nativos del navegador en la consola.
- **REQ-16:** Los rangos especializados de la consola deben usar `RangeInput`, manteniendo el callback continuo, la confirmación diferida cuando aplique y un foco/estado deshabilitado consistente.
- **REQ-17:** `Modal` debe establecer foco al abrir, devolverlo al cerrar, cerrar con Escape cuando existe `onClose` y mantener la navegación Tab dentro de su contenido.
- **REQ-18:** Los estados de carga iniciales de las vistas deben usar `LoadingState`, exponer estado accesible, mantener una escala visual única y recibir su mensaje desde i18n. Las actualizaciones posteriores deben conservar los datos visibles.
- **REQ-19:** Los errores generales de una vista deben usar `AlertBanner`; las tarjetas o formularios pueden conservar feedback localizado cuando el error pertenece a una acción concreta.

## 5. Requisitos No Funcionales

- **NFR-01:** No se crean stores globales solo para resolver estado local de un componente.
- **NFR-02:** No se eliminan datos existentes durante refresh; loading no debe causar flicker innecesario.
- **NFR-03:** Los componentes deben funcionar con teclado, foco visible y atributos accesibles apropiados.
- **NFR-04:** La composición debe adaptarse a 320px+, tablet y escritorio sin overflow horizontal no intencional.
- **NFR-05:** El componente no debe utilizar `any` para ocultar contratos incompletos.
- **NFR-06:** La CI debe validar tipos, compilación, pruebas, traducciones, cobertura de specs y adopción de primitivos UI antes de aceptar cambios.

## 6. Catálogo de Contratos

| Familia | Implementación principal | Responsabilidad | Estados mínimos |
|---|---|---|---|
| Acciones | `ui/Button.tsx`, `ui/IconButton.tsx`, `ui/ToggleSwitch.tsx` | Ejecutar una intención del usuario o cambiar un valor booleano | normal, hover/focus, disabled, loading, destructive, checked |
| Campos | `ui/Input.tsx`, `ui/Textarea.tsx`, `ui/RangeInput.tsx`, `ui/SearchableSelectField.tsx`, `ui/SearchFilterBar.tsx` | Entrada y selección tipada | vacío, foco, valor, búsqueda, error, disabled, opción larga |
| Contenedores | `ui/Card.tsx`, `ui/Modal.tsx`, `ui/PageFrame.tsx` | Jerarquía, contenido y viewport | normal, scroll interno, modal abierto, error/empty slot |
| Retroalimentación | `ui/AlertBanner.tsx`, `ui/EmptyState.tsx`, `ui/LoadingState.tsx`, `ui/StatusPill.tsx` | Comunicar estado sin bloquear datos | info, success, warning, error, loading, empty |
| Navegación | `ui/SidebarItem.tsx`, `ui/SegmentedControl.tsx`, `ui/SectionHeader.tsx` | Navegar y filtrar superficie activa | normal, activo, expandido, colapsado, keyboard focus |
| Dispositivos comunes | `ui/DeviceTileBase.tsx`, `ui/DeviceTileShell.tsx`, `ConfirmModal.tsx`, `CoverPositionControl.tsx` | Presentar acciones permitidas sin conocer el driver | disponible, activo, offline, unsupported, pending |
| Tokens | `design-system/tokens.ts`, `index.css` | Escala visual única y responsive | light, dark, compact, touch |

## 7. Criterios de Aceptación

- [x] AC1: Los componentes del catálogo están mapeados a esta spec en la comprobación de cobertura.
- [x] AC2: Ningún primitivo UI requiere conocer una integración externa o un endpoint concreto.
- [x] AC3: Los componentes de entrada y navegación no recortan texto crítico en los breakpoints soportados.
- [x] AC4: Los modales tienen contenido desplazable y acciones visibles dentro del viewport de la aplicación.
- [x] AC5: Cada estado de error, vacío o carga conserva accesibilidad y traducción ES/EN.
- [x] AC6: Las vistas usan el selector modular único `SearchableSelectField` para toda opción de negocio; el buscador está siempre disponible.
- [x] AC7: Las filas de creación y renombrado de hogares o estancias alinean inputs y acciones con la altura base del design system.
- [x] AC8: `npm run check:i18n` valida paridad ES/EN y referencias literales de i18n, incluidas las expresadas con template literals sin interpolación, en la consola antes de una entrega.
- [x] AC9: El selector de Rutinas muestra Escenas y Automatizaciones con la misma jerarquía tipográfica, sin saltos de línea ni recorte visual.
- [x] AC10: El sidebar presenta etiqueta de marca, navegación, guía y perfil con texto compacto, truncado seguro y roles breves traducidos para su contexto.
- [x] AC11: `npm run check:ui-primitives` evita botones HTML convencionales fuera de `components/ui`, preservando la adopción del sistema modular.
- [x] AC12: `npm run check:ui-primitives` evita campos de texto y áreas de texto genéricos fuera de los primitivos UI, con la excepción explícita del compositor conversacional.
- [x] AC13: `npm run check:ui-primitives` evita `select` y `option` nativos fuera de los primitivos UI, preservando el selector de negocio único con búsqueda.
- [x] AC14: La CI ejecuta `check:i18n`, `check:spec-coverage` y `check:ui-primitives` junto con tipos, builds y pruebas.
- [x] AC15: `npm run check:ui-primitives` evita escalas tipográficas arbitrarias fuera de los primitivos UI, conservando la jerarquía compartida entre vistas.
- [x] AC16: `npm run check:ui-primitives` evita `alert`, `confirm` y `prompt` nativos fuera de los primitivos UI; usuarios y cámaras presentan feedback mediante componentes del design system.
- [x] AC17: Los rangos de posición, opacidad y recorte consumen `RangeInput`, conservan los límites y no ejecutan el comando de cortina más de una vez para un valor confirmado; `check:ui-primitives` evita rangos nativos fuera de UI.
- [x] AC18: La configuración de vistas de tablero consume `Modal`, respeta `isOpen` y mantiene guardar/eliminar en un pie fijo fuera del contenido desplazable.
- [x] AC19: Los modales compartidos exponen `role="dialog"`, `aria-modal`, títulos y descripciones asociados, foco inicial/restaurado y navegación de teclado contenida.
- [x] AC20: Las vistas de Automatizaciones, Workbench, Inicio, Tableros, Usuarios, Diagnósticos y Asistente, además de la transición de navegación diferida, usan `LoadingState` para su carga inicial, con mensaje traducido, `role="status"` y sin reemplazar contenido previamente cargado durante refresh.
- [x] AC21: Automatizaciones y Diagnósticos presentan errores generales mediante `AlertBanner`, con jerarquía, iconografía y escala tipográfica compartidas.

## 8. Notas Técnicas y Arquitectura

- Los tokens viven en `design-system/tokens.ts`; CSS y Tailwind deben consumir sus variables o escala equivalente documentada.
- Vistas orquestan datos y dominio; los componentes modulares renderizan props tipadas y emiten callbacks.
- Una tarjeta ligada a una entidad de negocio se documenta además en la spec de su dominio.

## 9. Preguntas Abiertas y TODOs

- TODO: Añadir pruebas visuales automatizadas por breakpoint cuando el entorno Playwright se incorpore a CI.
