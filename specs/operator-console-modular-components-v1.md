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
- **REQ-20:** `SectionHeader` debe preservar el ancho disponible para títulos y subtítulos, permitir acciones contextuales envolventes y presentar dichas acciones a ancho completo en móvil, sin desborde ni recorte en tablet o escritorio.
- **REQ-21:** `EmptyState` debe ajustar de forma segura texto largo y acción contextual, reducir su espacio vertical en móvil y conservar una jerarquía centrada en tablet y escritorio sin provocar overflow horizontal.
- **REQ-22:** `AlertBanner` debe mantener mensajes legibles sin capitalización excesiva, anunciar su severidad de forma accesible y reorganizar contenido y acción sin solapamiento desde 320px.
- **REQ-23:** `StatusPill` debe conservar su escala compacta y limitarse al ancho disponible, permitiendo etiquetas largas con ajuste seguro sin expandir tarjetas o desplazar controles adyacentes.
- **REQ-24:** `Card` y sus subcomponentes deben preservar contenido, títulos, descripciones y acciones dentro del ancho disponible; su padding debe adaptarse entre móvil y escritorio sin crear scroll horizontal.
- **REQ-25:** `SidebarItem` debe distribuir icono, etiqueta y badge dentro del ancho disponible; etiquetas largas se ajustan en el sidebar expandido y el ítem activo comunica la ubicación actual de forma accesible.
- **REQ-26:** `PageFrame` debe actuar como límite de ancho de una vista, permitiendo que los hijos flexibles se reduzcan dentro del viewport y evitando overflow horizontal no intencional.
- **REQ-27:** `Input` debe mantener su altura base tokenizada y permitir reducción dentro de composiciones flexibles; sus etiquetas, ayudas y errores deben adaptarse a texto largo sin desborde.
- **REQ-28:** `Textarea` debe mantener su altura mínima tokenizada y permitir reducción dentro de composiciones flexibles; sus etiquetas, ayudas y errores deben adaptarse a texto largo sin desborde.
- **REQ-29:** `RangeInput` debe permitir reducción dentro de composiciones flexibles y distribuir sus límites y valor actual sin desborde horizontal.
- **REQ-30:** `SearchableSelectField` debe conservar búsqueda, foco y selección dentro del viewport, permitiendo reducción segura de trigger, etiqueta y ayuda en composiciones flexibles.
- **REQ-31:** `Button` debe conservar su altura y área táctil tokenizadas, permitiendo que etiquetas largas se ajusten dentro del ancho disponible sin estirar filas, tarjetas o modales.
- **REQ-32:** `ToggleSwitch` debe conservar su dimensión táctil, foco y semántica booleana dentro de filas responsivas, exponiendo su estado para estilos consistentes sin conocer la regla de negocio.
- **REQ-33:** `SearchFilterBar` debe permitir que búsqueda y filtros se reduzcan dentro de paneles responsivos, conservando las opciones navegables sin provocar overflow horizontal de la vista.
- **REQ-34:** `DeviceTileBase` debe conservar el contenido, estados y acciones de una tarjeta de dispositivo en móvil, tablet y escritorio; textos largos se ajustan y las acciones contextuales siguen disponibles sin depender exclusivamente de hover.
- **REQ-35:** `DeviceTileShell` y `AssistantCard` deben reducirse con seguridad dentro de grids y paneles responsivos, preservando estados accesibles, jerarquía visual y acciones largas en móvil, tablet y escritorio.
- **REQ-36:** `SegmentedControl`, `IconButton` y `Modal` deben conservar interacción táctil, estado accesible y composición segura dentro del viewport, sin competir entre controles, textos y acciones en pantallas angostas.
- **REQ-37:** Los flujos modulares de creación rápida y selección de audio deben limitar campo, trigger y menú al ancho disponible, manteniendo teclado, cierre y selección accesibles sin alterar sus contratos.
- **REQ-38:** La navegación de pestañas y el compositor de conversación deben adaptarse al viewport con títulos largos, acciones móviles y área segura, manteniendo visibles las acciones esenciales durante la interacción.
- **REQ-39:** Las confirmaciones sensibles deben reutilizar el diálogo modular para foco, teclado y viewport; los controles de posición no deben introducir etiquetas en un idioma fijo y deben recibirlas traducidas desde su consumidor.
- **REQ-40:** Las acciones sugeridas por el asistente deben reutilizar el diálogo modular, mantener sus formularios de dominio aislados y bloquear cierre o doble envío mientras se ejecuta una intención.
- **REQ-41:** La edición de perfil debe reutilizar el diálogo modular, conservar recorte local de avatar y exponer todos sus textos y etiquetas accesibles desde i18n ES/EN.
- **REQ-42:** El constructor de escenas debe reutilizar el diálogo modular, conservar selección local de acciones compatibles y mantener el guardado disponible en un pie fijo sin duplicar infraestructura de modal.

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
- [x] AC22: Los encabezados de vista, sección y grupo conservan títulos y subtítulos largos legibles; las acciones se ajustan al ancho disponible, se envuelven cuando es necesario y no provocan overflow horizontal desde 320px.
- [x] AC23: Los estados vacíos conservan icono, título, descripción y acción legibles desde 320px; el espacio vertical es compacto en móvil y la acción se adapta al ancho disponible sin recorte.
- [x] AC24: Los avisos muestran texto largo con ajuste seguro, acción a ancho completo en móvil y alineación horizontal desde tablet; advertencias/errores usan `role="alert"` e información/éxito usan `role="status"`.
- [x] AC25: Las insignias de estado conservan su tamaño compacto y presentan etiquetas largas sin overflow horizontal dentro de tarjetas, listados y cabeceras responsivas.
- [x] AC26: Las tarjetas compartidas reducen padding en móvil, permiten títulos y descripciones largas y envuelven acciones del pie sin recortar contenido desde 320px.
- [x] AC27: Los ítems del sidebar conservan icono, etiqueta y badge sin overflow desde 320px; etiquetas largas se ajustan al ancho disponible y el ítem activo declara `aria-current="page"`.
- [x] AC28: El marco de página se limita al ancho del viewport desde 320px y no impide que las composiciones flexibles internas reduzcan su tamaño disponible.
- [x] AC29: Campos generales conservan altura visual `h-10` y foco visible en todos los breakpoints; dentro de filas o grids flexibles no crean overflow horizontal y sus textos auxiliares se ajustan con seguridad.
- [x] AC30: Campos multilínea conservan altura mínima y foco visible en todos los breakpoints; dentro de grids o filas flexibles no crean overflow horizontal y sus textos auxiliares se ajustan con seguridad.
- [x] AC31: Los rangos conservan foco y control continuo; al presentar límites, priorizan el valor actual y no desbordan la superficie desde 320px.
- [x] AC32: El selector con búsqueda no desborda formularios o grids desde 320px; trigger, buscador, etiqueta y ayuda respetan el ancho disponible y el menú conserva su posición portal dentro del viewport.
- [x] AC33: Botones compartidos conservan foco, loading, variante y escala; sus etiquetas largas se ajustan sin overflow horizontal desde 320px.
- [x] AC34: Interruptores compartidos conservan `role="switch"`, `aria-checked`, foco, área táctil y estado visual explícito, sin encogerse ni crear overflow desde 320px.
- [x] AC35: La barra de búsqueda y filtros conserva foco, consulta y filtros disponibles desde 320px; sus columnas se reducen de forma segura y las opciones largas permanecen navegables sin desbordar la superficie.
- [x] AC36: La tarjeta base de dispositivo reduce padding en móvil, ajusta títulos y subtítulos largos sin overflow, y mantiene las acciones contextuales accesibles tanto con puntero como en superficies táctiles.
- [x] AC37: Las tarjetas estructurales y del asistente no crean overflow horizontal desde 320px; conservan acciones envolventes, contenido largo legible y estado deshabilitado accesible cuando corresponde.
- [x] AC38: Los controles segmentados anuncian su selección, los botones de icono responden de forma táctil y los modales reservan espacio para cierre, texto largo y acciones envolventes desde 320px.
- [x] AC39: El creador de pestañas y selector de audio se reducen dentro de navegación o composición móvil; el menú de audio permanece dentro del viewport y está asociado semánticamente con su trigger.
- [x] AC40: Las pestañas de tablero conservan selección, títulos accesibles y desplazamiento horizontal seguro; el compositor permanece visible, conserva el foco y envuelve sus controles sin overflow desde 320px.
- [x] AC41: Confirmaciones críticas comparten portal, foco, cierre y composición responsive con `Modal`; controles de posición exigen etiqueta accesible traducida y no ejecutan confirmaciones duplicadas.
- [x] AC42: Las acciones del asistente comparten portal, foco, cierre, scroll y pie responsive con `Modal`; su ejecución bloquea cierre y reintentos hasta finalizar.
- [x] AC43: El perfil de usuario comparte portal, foco, cierre, scroll y pie responsive con `Modal`; bloquea reintentos durante guardado y sus etiquetas visibles o accesibles existen en ES/EN.
- [x] AC44: El constructor de escenas comparte portal, foco, cierre, scroll y pie responsive con `Modal`; mantiene sus acciones compatibles, búsqueda y feedback localizados, y bloquea cierre o reintentos durante guardado.

## 8. Notas Técnicas y Arquitectura

- Los tokens viven en `design-system/tokens.ts`; CSS y Tailwind deben consumir sus variables o escala equivalente documentada.
- Vistas orquestan datos y dominio; los componentes modulares renderizan props tipadas y emiten callbacks.
- Una tarjeta ligada a una entidad de negocio se documenta además en la spec de su dominio.

## 9. Preguntas Abiertas y TODOs

- TODO: Añadir pruebas visuales automatizadas por breakpoint cuando el entorno Playwright se incorpore a CI.
