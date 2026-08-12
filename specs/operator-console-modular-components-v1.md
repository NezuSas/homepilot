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
- **REQ-10:** Los controles segmentados con etiquetas largas deben conservar una escala tipográfica compacta, una sola línea por opción y etiquetas legibles sin desborde en móvil, tablet y escritorio. Cuando una etiqueta no puede conservarse íntegra en el ancho disponible, el control debe desplazarse dentro de sus propios límites en vez de truncar el destino.
- **REQ-11:** La navegación lateral debe usar la escala tipográfica compartida; las variantes compactas de marca, guía y rol no pueden recortar información crítica ni reutilizar descripciones extensas de otras vistas.
- **REQ-12:** Las acciones convencionales de la consola deben usar `Button` o `IconButton`; los elementos HTML nativos solo pueden residir dentro de los primitivos UI o corresponder a una semántica especializada documentada.
- **REQ-13:** Los campos generales de texto, contraseña, correo, búsqueda y texto multilínea deben usar `Input` o `Textarea`; las selecciones de negocio deben usar `SearchableSelectField`; archivo, radio y el compositor conversacional mantienen su control nativo especializado.
- **REQ-14:** La tipografía de vistas y componentes debe usar escalas con nombre del design system; las utilidades Tailwind arbitrarias `text-[…]` no se permiten fuera de `components/ui`.
- **REQ-59:** La interfaz debe cargar familias locales desde el repositorio: `Rubik` para lectura y controles, y `Disket Mono` únicamente para datos técnicos, labels y estados. Los componentes consumen `font-sans` o `font-mono`; no declaran familias directamente.
- **REQ-60:** La CI debe ejecutar una comprobación responsive automatizada de la consola en móvil, tablet y escritorio, verificando ausencia de overflow horizontal y la carga de las familias tipográficas de marca.
- **REQ-15:** Las confirmaciones y errores visibles deben usar `ConfirmModal`, `AlertBanner` u otro componente modular de feedback; no se permiten diálogos nativos del navegador en la consola.
- **REQ-16:** Los rangos especializados de la consola deben usar `RangeInput`, manteniendo el callback continuo, la confirmación diferida cuando aplique y un foco/estado deshabilitado consistente.
- **REQ-17:** `Modal` debe establecer foco al abrir, devolverlo al cerrar, cerrar con Escape cuando existe `onClose` y mantener la navegación Tab dentro de su contenido.
- **REQ-18:** Los estados de carga iniciales de las vistas deben usar `LoadingState`, exponer estado accesible, mantener una escala visual única y recibir su mensaje desde i18n. Las actualizaciones posteriores deben conservar los datos visibles.
- **REQ-19:** Los errores generales de una vista deben usar `AlertBanner`; las tarjetas o formularios pueden conservar feedback localizado cuando el error pertenece a una acción concreta.
- **REQ-20:** `SectionHeader` debe preservar el ancho disponible para títulos y subtítulos, permitir acciones contextuales envolventes y presentar dichas acciones a ancho completo en móvil, sin desborde ni recorte en tablet o escritorio.
- **REQ-21:** `EmptyState` debe ajustar de forma segura texto largo y acción contextual, reducir su espacio vertical en móvil y conservar una jerarquía centrada en tablet y escritorio sin provocar overflow horizontal. Debe asociar título y descripción, anunciar el estado de forma no intrusiva y mantener su icono decorativo.
- **REQ-22:** `AlertBanner` debe mantener mensajes legibles sin capitalización excesiva, anunciar su severidad de forma accesible, asociar título y mensaje cuando existan y reorganizar contenido y acción sin solapamiento desde 320px.
- **REQ-23:** `StatusPill` debe conservar su escala compacta y limitarse al ancho disponible, permitiendo etiquetas largas con ajuste seguro sin expandir tarjetas o desplazar controles adyacentes.
- **REQ-24:** `Card` y sus subcomponentes deben preservar contenido, títulos, descripciones y acciones dentro del ancho disponible; su padding debe adaptarse entre móvil y escritorio sin crear scroll horizontal. Los botones directos de `CardFooter` ocupan el ancho táctil disponible en móvil y recuperan su ancho natural desde tablet.
- **REQ-25:** `SidebarItem` debe distribuir icono, etiqueta y badge dentro del ancho disponible; etiquetas largas se ajustan en el sidebar expandido y el ítem activo comunica la ubicación actual de forma accesible.
- **REQ-26:** `PageFrame` debe actuar como límite de ancho de una vista, permitiendo que los hijos flexibles se reduzcan dentro del viewport y evitando overflow horizontal no intencional.
- **REQ-27:** `Input` debe mantener su altura base tokenizada y permitir reducción dentro de composiciones flexibles; sus etiquetas, ayudas y errores deben adaptarse a texto largo sin desborde. Las ayudas y errores deben asociarse al control mediante `aria-describedby`, y el error debe comunicar `aria-invalid`.
- **REQ-28:** `Textarea` debe mantener su altura mínima tokenizada y permitir reducción dentro de composiciones flexibles; sus etiquetas, ayudas y errores deben adaptarse a texto largo sin desborde.
- **REQ-29:** `RangeInput` debe permitir reducción dentro de composiciones flexibles y distribuir sus límites y valor actual sin desborde horizontal.
- **REQ-30:** `SearchableSelectField` debe conservar búsqueda, foco y selección dentro del viewport, permitiendo reducción segura de trigger, etiqueta y ayuda en composiciones flexibles.
- **REQ-31:** `Button` debe conservar su altura y área táctil tokenizadas, permitiendo que etiquetas largas se ajusten dentro del ancho disponible sin estirar filas, tarjetas o modales. Durante carga debe quedar deshabilitado y comunicar `aria-busy`.
- **REQ-32:** `ToggleSwitch` debe conservar su dimensión táctil, foco y semántica booleana dentro de filas responsivas, exponiendo su estado para estilos consistentes sin conocer la regla de negocio.
- **REQ-33:** `SearchFilterBar` debe permitir que búsqueda y filtros se reduzcan dentro de paneles responsivos, conservando las opciones navegables sin provocar overflow horizontal de la vista. En móvil mantiene controles apilados y desde tablet adopta una fila compacta. La búsqueda activa debe poder limpiarse con una acción localizada integrada al campo, sin cambiar su geometría.
- **REQ-34:** `DeviceTileBase` debe conservar el contenido, estados y acciones de una tarjeta de dispositivo en móvil, tablet y escritorio; textos largos se ajustan y las acciones contextuales siguen disponibles sin depender exclusivamente de hover.
- **REQ-35:** `DeviceTileShell`, `DeviceTileBase` y `AssistantCard` deben reducirse con seguridad dentro de grids y paneles responsivos, preservando estados accesibles, jerarquía visual y acciones largas en móvil, tablet y escritorio. Las tarjetas interactivas deben poder activarse con Enter o Espacio sin duplicar controles internos. Un hallazgo descartado no debe conservar contexto para tecnologías asistivas.
- **REQ-36:** `SegmentedControl`, `IconButton`, `ToggleSwitch` y `Modal` deben conservar interacción táctil, estado accesible y composición segura dentro del viewport, sin competir entre controles, textos y acciones en pantallas angostas. `IconButton` y `ToggleSwitch` pueden comunicar carga con `aria-busy` sin alterar sus dimensiones.
- **REQ-37:** Los flujos modulares de creación rápida y selección de audio deben limitar campo, trigger y menú al ancho disponible, manteniendo teclado, cierre y selección accesibles sin alterar sus contratos.
- **REQ-38:** La navegación de pestañas y el compositor de conversación deben adaptarse al viewport con títulos largos, acciones móviles y área segura, manteniendo visibles las acciones esenciales durante la interacción.
- **REQ-39:** Las confirmaciones sensibles deben reutilizar el diálogo modular para foco, teclado y viewport; los controles de posición no deben introducir etiquetas en un idioma fijo y deben recibirlas traducidas desde su consumidor.
- **REQ-40:** Las acciones sugeridas por el asistente deben reutilizar el diálogo modular, mantener sus formularios de dominio aislados y bloquear cierre o doble envío mientras se ejecuta una intención.
- **REQ-41:** La edición de perfil debe reutilizar el diálogo modular, conservar recorte local de avatar y exponer todos sus textos y etiquetas accesibles desde i18n ES/EN.
- **REQ-42:** El constructor de escenas debe reutilizar el diálogo modular, conservar selección local de acciones compatibles y mantener el guardado disponible en un pie fijo sin duplicar infraestructura de modal.
- **REQ-43:** El visor ampliado de cámara debe reutilizar el diálogo modular, conservar sus estados de streaming y error, y reservar un área flexible de video con encabezado y pie visibles dentro del viewport. En modo ampliado no debe producir scroll vertical: el medio se ajusta con `object-contain` al alto disponible en móvil, tablet y escritorio.
- **REQ-44:** El selector de iconos debe reutilizar el campo modular, limitar su menú portal al viewport y exponer estado, lista y cierre mediante teclado de forma accesible.
- **REQ-45:** Las superficies laterales deben reutilizar un cajón modular que preserve portal, foco, Escape, ciclo de Tab, cierre y viewport sin duplicar infraestructura por dominio.
- **REQ-46:** La guía guiada debe mantener el paso visible tanto en escritorio como en móvil, con foco, teclado, textos i18n y una composición que no dependa de coordenadas disponibles en pantalla angosta.
- **REQ-47:** Los estados y mensajes de conversación deben conservar jerarquía tipográfica tokenizada, opciones largas legibles e indicadores anunciables, sin textos visibles fijos fuera de i18n.
- **REQ-48:** La cabecera y el compositor de conversación deben usar etiquetas localizadas, conservar ayudas accesibles y permitir títulos, subtítulos y estados largos sin truncado horizontal. Los indicadores visuales de estado deben anunciar su estado localizado.
- **REQ-49:** La escala de texto y el espaciado tipográfico deben consumir tokens con nombre; las utilidades arbitrarias de `text-[…]` o `tracking-[…]` no se permiten fuera de primitivas UI documentadas.
- **REQ-50:** El selector de entrada de audio debe conservar sus opciones legibles dentro del viewport y permitir selección completa con teclado, sin alterar el flujo de captura de voz.
- **REQ-51:** Las opciones exclusivas que requieran título y contexto deben usar una tarjeta de selección reutilizable, con semántica de radio, foco visible y contenido legible desde móvil hasta escritorio.
- **REQ-52:** El selector general con búsqueda debe permitir abrir, filtrar, recorrer y confirmar opciones extensas con teclado, sin perder foco ni desbordar el viewport.
- **REQ-53:** Modal y Drawer deben compartir el contrato de foco, teclado y bloqueo de scroll, preservando el documento bloqueado mientras exista al menos una superficie superpuesta abierta. Solo la superficie superior puede retener foco, incluso ante cambios programáticos o capas anidadas.
- **REQ-54:** Los componentes de feedback deben conservar acciones directas utilizables desde móvil y exponer estados visuales de solo icono o punto con semántica accesible explícita.
- **REQ-55:** Los controles continuos o booleanos deben conservar un único contrato de cambio: el rango confirma una vez al finalizar interacción o explícitamente con Enter, y el interruptor no puede perder su cambio controlado por handlers adicionales.
- **REQ-56:** Los encabezados compartidos deben entregar acciones directas táctiles a ancho completo en móvil y conservar alineación semántica entre icono, título y subtítulo cuando se usan como grupos.
- **REQ-57:** Los controles segmentados de selección exclusiva deben exponer semántica de radio y permitir recorrer opciones disponibles con flechas, Inicio y Fin, conservando foco y selección visibles.
- **REQ-58:** Las guías contextuales no modales deben permitir completar la acción resaltada sin atrapar foco ni bloquear scroll; deben conservar una salida explícita y cierre con Escape cuando no exista una superficie modal superior.
- **REQ-61:** `DatabaseBackupsCard` debe presentar únicamente metadatos seguros de copias locales, conservar la lista visible durante actualización, bloquear creación duplicada y mantener acciones con nombre accesible.
- **REQ-62:** Las superficies de media y cámara deben usar el tamaño disponible de su contenedor: la tarjeta multimedia compacta refluye sus comandos sin ocultar capacidades, y el visor ampliado debe anular límites genéricos para aprovechar el viewport sin paneles verticales vacíos. El inspector técnico usa como máximo dos columnas dentro del cajón, conserva identificadores técnicos con corte seguro y muestra el nombre legible de la estancia en vez de su identificador interno.

## 5. Requisitos No Funcionales

- **NFR-01:** No se crean stores globales solo para resolver estado local de un componente.
- **NFR-02:** No se eliminan datos existentes durante refresh; loading no debe causar flicker innecesario.
- **NFR-03:** Los componentes deben funcionar con teclado, foco visible y atributos accesibles apropiados.
- **NFR-04:** La composición debe adaptarse a 320px+, tablet y escritorio sin overflow horizontal no intencional.
- **NFR-05:** El componente no debe utilizar `any` para ocultar contratos incompletos.
- **NFR-06:** La CI debe validar tipos, compilación, pruebas, traducciones, cobertura de specs y adopción de primitivos UI antes de aceptar cambios.
- **NFR-07:** La instantánea de dispositivos debe deduplicar solicitudes concurrentes, reutilizar datos recientes durante la navegación y actualizarse forzosamente ante eventos realtime relevantes, sin sondeo fijo que compita con las vistas.
- **NFR-08:** El catálogo completo de iconos MDI debe cargarse bajo demanda: de inmediato únicamente al abrir el selector de iconos y en tiempo ocioso para iconos personalizados ya visibles en un tablero.

## 6. Catálogo de Contratos

| Familia | Implementación principal | Responsabilidad | Estados mínimos |
|---|---|---|---|
| Acciones | `ui/Button.tsx`, `ui/IconButton.tsx`, `ui/ToggleSwitch.tsx` | Ejecutar una intención del usuario o cambiar un valor booleano | normal, hover/focus, disabled, loading, destructive, checked |
| Campos | `ui/Input.tsx`, `ui/Textarea.tsx`, `ui/RangeInput.tsx`, `ui/SearchableSelectField.tsx`, `ui/SearchFilterBar.tsx` | Entrada y selección tipada | vacío, foco, valor, búsqueda, error, disabled, opción larga |
| Contenedores | `ui/Card.tsx`, `ui/Modal.tsx`, `ui/Drawer.tsx`, `ui/PageFrame.tsx` | Jerarquía, contenido y viewport | normal, scroll interno, modal/cajón abierto, error/empty slot |
| Retroalimentación | `ui/AlertBanner.tsx`, `ui/EmptyState.tsx`, `ui/LoadingState.tsx`, `ui/StatusPill.tsx` | Comunicar estado sin bloquear datos | info, success, warning, error, loading, empty |
| Navegación | `ui/SidebarItem.tsx`, `ui/SegmentedControl.tsx`, `ui/SectionHeader.tsx` | Navegar y filtrar superficie activa | normal, activo, expandido, colapsado, keyboard focus |
| Dispositivos comunes | `ui/DeviceTileBase.tsx`, `ui/DeviceTileShell.tsx`, `ConfirmModal.tsx`, `CoverPositionControl.tsx` | Presentar acciones permitidas sin conocer el driver | disponible, activo, offline, unsupported, pending |
| Resiliencia local | `DatabaseBackupsCard.tsx` | Consultar y crear copias locales sin revelar paths internos | loading, empty, error, latest backup, creating |
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
- [x] AC66: La tarjeta de copias locales conserva los metadatos previos al refrescar, solo permite una creación por vez y no muestra rutas del filesystem al operador.
- [x] AC11: `npm run check:ui-primitives` evita botones HTML convencionales fuera de `components/ui`, preservando la adopción del sistema modular.
- [x] AC12: `npm run check:ui-primitives` evita campos de texto y áreas de texto genéricos fuera de los primitivos UI, con la excepción explícita del compositor conversacional.
- [x] AC13: `npm run check:ui-primitives` evita `select` y `option` nativos fuera de los primitivos UI, preservando el selector de negocio único con búsqueda.
- [x] AC14: La CI ejecuta `check:i18n`, `check:spec-coverage` y `check:ui-primitives` junto con tipos, builds y pruebas.
- [x] AC15: `npm run check:ui-primitives` evita escalas tipográficas arbitrarias fuera de los primitivos UI, conservando la jerarquía compartida entre vistas.
- [x] AC16: `npm run check:ui-primitives` evita `alert`, `confirm` y `prompt` nativos fuera de los primitivos UI; usuarios y cámaras presentan feedback mediante componentes del design system.
- [x] AC17: Los rangos de posición, opacidad y recorte consumen `RangeInput`, conservan los límites y no ejecutan el comando de cortina más de una vez para un valor confirmado; `check:ui-primitives` evita rangos nativos fuera de UI.
- [x] AC18: La configuración de vistas de tablero consume `Modal`, respeta `isOpen` y mantiene guardar/eliminar en un pie fijo fuera del contenido desplazable.
- [x] AC19: Los modales compartidos exponen `role="dialog"`, `aria-modal`, títulos y descripciones asociados, foco inicial/restaurado y navegación de teclado contenida.
- [x] AC20: Las vistas de Automatizaciones, Workbench, Inicio, Tableros, Usuarios, Diagnósticos, Asistente, auditoría, registros de ejecución, Descubrimiento/Gestor y Showcase de Resiliencia, además de la transición de navegación diferida, usan `LoadingState` para su carga inicial, con mensaje traducido, `role="status"` y sin reemplazar contenido previamente cargado durante refresh.
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
- [x] AC33: Botones compartidos conservan foco, loading, variante y escala; sus etiquetas largas se ajustan sin overflow horizontal desde 320px y el estado de carga expone `aria-busy`.
- [x] AC34: Interruptores compartidos conservan `role="switch"`, `aria-checked`, foco, área táctil y estado visual explícito, sin encogerse ni crear overflow desde 320px.
- [x] AC35: La barra de búsqueda y filtros conserva foco, consulta y filtros disponibles desde 320px; sus columnas se reducen de forma segura y las opciones largas permanecen navegables sin desbordar la superficie.
- [x] AC36: La tarjeta base de dispositivo reduce padding en móvil, ajusta títulos y subtítulos largos sin overflow, y mantiene las acciones contextuales accesibles tanto con puntero como en superficies táctiles.
- [x] AC37: Las tarjetas estructurales y del asistente no crean overflow horizontal desde 320px; conservan acciones envolventes, contenido largo legible y estado deshabilitado accesible cuando corresponde. Las acciones internas no activan la tarjeta contenedora desde teclado.
- [x] AC38: Los controles segmentados anuncian su selección; los botones de icono y booleanos responden de forma táctil y pueden comunicar carga sin cambiar su área; y los modales reservan espacio para cierre, texto largo y acciones envolventes desde 320px.
- [x] AC39: El creador de pestañas y selector de audio se reducen dentro de navegación o composición móvil; el menú de audio permanece dentro del viewport y está asociado semánticamente con su trigger.
- [x] AC40: Las pestañas de tablero conservan selección, títulos accesibles y desplazamiento horizontal seguro; el compositor permanece visible, conserva el foco y envuelve sus controles sin overflow desde 320px.
- [x] AC41: Confirmaciones críticas comparten portal, foco, cierre y composición responsive con `Modal`; controles de posición exigen etiqueta accesible traducida y no ejecutan confirmaciones duplicadas.
- [x] AC42: Las acciones del asistente comparten portal, foco, cierre, scroll y pie responsive con `Modal`; su ejecución bloquea cierre y reintentos hasta finalizar.
- [x] AC43: El perfil de usuario comparte portal, foco, cierre, scroll y pie responsive con `Modal`; bloquea reintentos durante guardado y sus etiquetas visibles o accesibles existen en ES/EN.
- [x] AC44: El constructor de escenas comparte portal, foco, cierre, scroll y pie responsive con `Modal`; mantiene sus acciones compatibles, búsqueda y feedback localizados, y bloquea cierre o reintentos durante guardado.
- [x] AC45: El visor de cámara comparte portal, foco, cierre y viewport con `Modal`; prioriza el stream directo estable, conserva fallback a snapshot, y mantiene encabezado, medio y pie visibles sin scroll vertical en móvil, tablet y escritorio.
- [x] AC46: El selector de iconos mantiene búsqueda y selección, limita su menú portal al ancho disponible y declara controles accesibles que permiten cerrarlo con Escape.
- [x] AC47: El cajón lateral comparte portal, foco, cierre, scroll y viewport; el inspector de dispositivos conserva sus pestañas y confirmaciones sin infraestructura duplicada.
- [x] AC48: La guía guiada mantiene el resaltado y explica el paso en escritorio; en móvil muestra una tarjeta inferior accesible, enfocada y cerrable con Escape.
- [x] AC49: La conversación presenta mensajes, opciones y estado de escritura con texto uniforme, ajuste seguro y etiquetas ES/EN completas.
- [x] AC50: La cabecera y el compositor preservan etiquetas ES/EN, ayudas para lector de pantalla, estado operativo anunciable y composición legible desde móvil hasta escritorio.
- [x] AC51: La activación y el editor de tableros usan tokens de tracking, y la validación de primitivas bloquea nuevos espaciados tipográficos arbitrarios fuera de UI.
- [x] AC52: El selector de audio conserva nombres largos sin recorte en sus opciones, se cierra de forma predecible y permite navegar con flechas, Inicio, Fin y Escape desde móvil hasta escritorio.
- [x] AC53: La selección de perfiles y resultados de descubrimiento de cámaras nativas comparte tarjetas de opción accesibles, sin radios locales duplicados ni desbordes de contenido.
- [x] AC54: El selector con búsqueda conserva etiquetas y descripciones largas legibles, permite navegación con flechas, Inicio, Fin y Escape, y devuelve el foco al trigger al confirmar o cerrar.
- [x] AC55: Modal y Drawer reutilizan el mismo contrato de overlay; foco, Escape, Tab y el bloqueo de scroll se conservan incluso cuando existen superficies superpuestas.
- [x] AC56: AlertBanner y EmptyState adaptan sus acciones directas a todo el ancho en móvil; LoadingState anuncia cambios de forma atómica y StatusPill permite describir indicadores de solo punto.
- [x] AC57: RangeInput confirma al finalizar un gesto, al perder foco o con Enter, y ToggleSwitch permite observación o cancelación explícita sin que un onClick externo sustituya su transición controlada.
- [x] AC58: SectionHeader presenta acciones directas a ancho completo en móvil y elimina sangría residual del subtítulo de grupo cuando no existe icono.
- [x] AC59: SegmentedControl permite seleccionar y enfocar opciones disponibles con flechas, Inicio y Fin, sin incluir opciones deshabilitadas.
- [x] AC60: Rubik y Disket Mono se cargan localmente y se exponen mediante tokens de familia compartidos, sin dependencia de CDN ni declaraciones de familia por componente.
- [x] AC61: La pantalla de acceso se valida automáticamente a 320px, tablet y escritorio; no produce overflow horizontal y mantiene cargadas Rubik y Disket Mono.
- [x] AC62: La pantalla de acceso valida automáticamente el orden de foco por teclado, la activación por Enter, el área táctil mínima del envío y el anuncio semántico de error en móvil, tablet y escritorio.
- [x] AC63: Un tablero autenticado se valida automáticamente a 320px, tablet y escritorio; conserva su título visible y no genera overflow horizontal.
- [x] AC64: `npm run verify:quality` y CI ejecutan el mismo control de calidad para traducciones, primitives, specs, responsividad, lint, pruebas, tipado y compilaciones. La prueba responsive se ejecuta desde el workspace `operator-console` para usar una única instancia de Playwright y su configuración local.
- [x] AC65: El catálogo completo MDI se carga de forma diferida para los tableros; los iconos operativos de la consola usan importaciones explícitas y no incorporan el catálogo completo de Lucide en la carga inicial.
- [x] AC66: Todo `SegmentedControl` declara una etiqueta accesible traducida; conserva foco visible, navegación por flechas, Inicio y Fin, y no permite grupos de radios sin nombre.
- [x] AC67: La navegación entre vistas reutiliza la instantánea de dispositivos durante una ventana corta de frescura, comparte solicitudes simultáneas y conserva los datos visibles; eventos realtime relevantes invalidan esa ventana para sincronizar el cambio de inmediato.
- [x] AC68: Los tableros no bloquean su primer render con el catálogo MDI completo; el selector de iconos conserva la carga inmediata de su catálogo y los iconos personalizados visibles se resuelven al quedar libre el navegador.
- [x] AC69: Tarjeta multimedia, visor de cámara e inspector técnico conservan texto, controles y proporción útil dentro de grids, overlays y cajones angostos sin overflow horizontal ni espacios vacíos desproporcionados; el visor ampliado puede ocupar el ancho disponible y el inspector no expone UUIDs de estancias en superficies residenciales.
- [x] AC70: Inicio, Asistente, topología e inventario reducen cabeceras y etiquetas repetidas; las sugerencias conservan sus acciones con una jerarquía compacta, los dispositivos agrupados no repiten la estancia en su nombre o pie, y los nombres largos pueden ocupar dos líneas sin desbordar.
- [x] AC71: La conversación residencial no duplica una cabecera operativa dentro de la vista. Sin mensajes, conserva únicamente accesos rápidos compactos y el compositor, sin pantalla introductoria, capacidades repetidas ni espacio vacío desproporcionado.

## 8. Notas Técnicas y Arquitectura

- Los tokens viven en `design-system/tokens.ts`; CSS y Tailwind deben consumir sus variables o escala equivalente documentada.
- Vistas orquestan datos y dominio; los componentes modulares renderizan props tipadas y emiten callbacks.
- Una tarjeta ligada a una entidad de negocio se documenta además en la spec de su dominio.

## 9. Preguntas Abiertas y TODOs

- [x] Pruebas responsive automatizadas por breakpoint mediante Playwright en CI para la pantalla de acceso y la tipografía de marca.
