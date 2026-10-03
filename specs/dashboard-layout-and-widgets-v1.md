# SPEC: Dashboard Layout and Widgets V1

## Visualizadores Sensor y estabilidad — alcance autorizado

Refinamiento autorizado: no mostrar estado «Normal», punto verde ni leyenda textual de escala en Sensor, ni conservar su espacio vacío. Eliminar el pie sin avisos y sus filas mínimas; ausencia se muestra junto a la lectura y el skeleton no añade un pie vacío. Mantener límites, precisión, graduaciones y avisos reales. Durante el arrastre se previsualiza el traslado entre Sections y la colocación en slots, reacomodando el destino antes de soltar; persistir solo al soltar y restaurar al cancelar. Copia de tamaño real, origen tenue y transiciones de 150 ms; reduced-motion elimina movimiento de llegada/reacomodo. Mantener gestos, teclado, huecos persistidos y contratos sin cambiar algoritmo global ni biblioteca DnD.

- AC45: `visualStyle?: 'auto' | 'gauge' | 'thermometer' | 'level' | 'battery'` en la tarjeta, con selector modular y preview inmediato. Ausente conserva gauge histórico; nuevas tarjetas usan auto y metadatos semánticos antes que nombres. Temperatura → termómetro; batería → batería; nivel/porcentaje → nivel; humedad/presión/potencia y desconocidos → gauge. Persistencia y transferencias conservan el campo; sin migración ni cambios backend.
- Refinamiento visual AC45: nivel usa un depósito cilíndrico ancho con superficie de líquido y graduaciones, claramente distinto de la batería con terminal. Misma normalización, escala, proporción exterior y paleta; sin lectura no se inventa líquido ni carga. Mantener animación dependiente del dato y reduced-motion.
- Carcasa, escala configurada, precisión real, decimales opcionales, estados, paleta y skeleton no cambian. Renderers comparten normalización limitada 0–1, no fabrican valores ni estado de carga. Sin datos no hay relleno ni aguja. Cambios reales se interpolan con cancelación y reduced-motion inmediato. Pruebas de límites, negativos, ausencia, selección, recarga y geometría focalizada claro/oscuro.
- Clásico conserva espacio de metadatos y progreso tanto activo como inactivo; controles dependen de capacidades reales, nunca datos ficticios. Importar una pestaña selecciona su ID sin alternancia entre ruta anterior y nueva; navegación atrás/adelante sigue funcionando.
- Reversión: retirar selección/renderer y volver al gauge; el campo opcional puede ignorarse sin transformar datos. No SQL ni uso de base real, Git o deploy.

## Escala Sensor configurable — alcance autorizado

- AC42: El editor Sensor admite mínimo/máximo opcionales por tarjeta en `sensorScale: { min, max }` dentro de `config.extra.cards`. Ambos finitos y min < max; sin ambos se conserva la escala histórica. La escala configurada tiene prioridad sobre metadatos/automática, permanece fija al cambiar la lectura y no expresa umbrales de salud. Aguja limitada a extremos; número real y accesibilidad preservados. Preview, guardado/recarga e import/export conservan el rango. Sin migración SQL ni cambios de geometría. Para revertir, el editor anterior puede descartar el campo; hacer backup antes de downgrade.
- AC42 ampliado: `sensorDecimals?: boolean` por tarjeta; ausente/false muestra enteros redondeados, true hasta dos decimales. Solo formato visual: estado, aguja, umbrales y lectura accesible conservan precisión real. Preview y persistencia/import-export conservan la opción. Graduaciones del dial no cambian con el ancho ni la lectura; límites configurados se conservan incluso sin lectura, sin fabricar valor ni meter accesible.

Refinamiento de densidad y continuidad: Sensor usa padding vertical compacto y contenido sin expansión flexible, con o sin lectura, manteniendo esfera/unidad inline y geometría de carga estable. La identidad de arrastre se conserva localmente al trasladar una tarjeta a otra Section para que la animación de llegada alcance su nodo de destino; no cambia el ID persistido ni el formato de las tarjetas.

## Sensor analógico — referencia autorizada 2026-10-02

Refinamiento autorizado: unidad junto al número; tamaño tipográfico común para lecturas habituales (incluidos cuatro dígitos y decimales), reducción excepcional solo para lecturas largas que no caben. Compactar bandas y ausencia sin recortar contenido; cinco graduaciones legibles también en tarjetas estrechas. Arrastre: copia elevada de tamaño real para tarjeta/Section, mantener pulsado 500 ms en el fondo de Section (no controles ni tarjetas), sin grip de seis puntos; teclado sigue disponible. Slots conservados por columna con colocación masonry densa para poder mover a la columna bajo una Section más baja; sin cambio de schema/backend.

- Sustituye las fichas numéricas/barra de AC40 por esfera dominante de 240°, marcas, aguja, lectura y unidad inferior, dentro de la paleta Dashboard en claro/oscuro. Fuente: `codex-clipboard-d0377bd6-c268-4723-82c1-96d749161ab7.png`, cuatro tarjetas principales. Canvas es un gráfico vectorial de datos, no una imagen de valores ficticios.
- Modelo, binding, edición, menú funcional y tamaño medio del Sensor se conservan. Binarios/categorías mantienen lectura informativa, no se convierten en medidores ni switches. No repetir estancia dentro del Dashboard.
- La aguja usa la lectura real. `min`/`max` o `min_value`/`max_value` válidos de atributos/estado determinan la escala; porcentajes sin límites usan 0–100. Sin límites, ventanas visuales de referencia: °C −10–50, °F 0–120, bar 0–6, hPa 950–1050. Valores fuera de esas ventanas u otras unidades usan escala automática que los contiene. El pie identifica la escala automática; no se llama «rango normal» ni se inventan umbrales de salud.
- Políticas existentes de batería/memoria/humedad se conservan, sin añadir salud de presión/temperatura. Aguja limitada visualmente a extremos cuando hay escala explícita; lectura accesible conserva el valor real. Sin lectura: esfera neutra sin aguja/valor ficticio, «— / Sin lectura», sin unidad ni meter numérico.
- Carcasa y skeleton específico comparten reserva proporcional y bandas; se autoriza la altura necesaria del instrumento sin cambiar el grid/masonry global, otros widgets, backend, schema ni persistencia. Preview usa el mismo componente. Reversión: restaurar el presenter anterior; no hay migraciones ni datos que transformar.
- Cobertura: rangos/signos/decimales/cero/desbordes, meter accesible, ausencia, modo claro/oscuro, móvil/tablet/escritorio/kiosco, estabilidad skeleton → contenido, preview y Espacios.

## Refinamiento local autorizado — edición y transferencia por pestaña

- El encabezado tiene una única entrada «Editar» con lápiz dentro de «Más», en todos los tamaños. Ese modo permite cambiar el nombre del Dashboard y editar su contenido; «Finalizar» sigue accesible. No hay un lápiz separado para renombrar.
- La UI exporta exclusivamente la pestaña activa como `homepilot-dashboard-tab`, versión 1; importar añade una pestaña privada nueva al Dashboard propio, nunca reemplaza las existentes ni cambia «Abrir al cargar». Se conservan validación de bindings autorizados, remapeo de IDs/slots/enlaces internos, reporte de pendientes y exclusión de fondos locales. Nombres repetidos reciben sufijo «Importado». Los endpoints históricos de transferencia completa se conservan por compatibilidad, pero no se exponen en este menú. Nuevos endpoints de pestaña requieren propietario; no hay migración de DB. Reversión: volver a la UI anterior; las pestañas añadidas siguen usando el schema existente y el historial conserva una revisión previa a importar.
- Vista normal y edición comparten la distribución de Sections y sus slots vacíos, sin convertirlas en filas de altura uniforme al editar. Los controles de edición no rediseñan tarjetas.
- Mouse y teclado siguen funcionando. Touch activa el arrastre con pulsación de 500 ms y tolerancia de 8 px, sin ejecutar la tarjeta; movimiento previo cancela para permitir scroll. Las Sections se arrastran desde su superficie libre, fuera de tarjetas y controles, sin grip de seis puntos; las tarjetas usan su superficie. Cancelar no persiste cambios.
- Las tarjetas pueden reordenarse dentro de su Section y trasladarse a otra Section de la misma pestaña (también vacía), preservando configuración, binding, tamaño efectivo e ID. La actualización de ambas Sections se guarda conjuntamente; no hay duplicación ni movimiento entre Dashboards.
- Cobertura focalizada: encabezado único, renombrado, exportación de una pestaña, importación no destructiva/privada y RBAC, layouts normal/edición con alturas distintas, movimiento touch/mouse/teclado entre Sections, cancelación y recarga.

### Historial visual de AC40 — sustituido por Sensor analógico

Los tres refinamientos siguientes documentan decisiones anteriores; la presentación vigente se define en «Sensor analógico — referencia autorizada 2026-10-02» y AC40.

Rediseño AC40 autorizado desde referencia: icono destacado y cabecera, lectura central en fichas grandes, unidad y barra porcentual inferior accesible. Se conserva exclusivamente la paleta Dashboard en claro/oscuro. Signos y decimales se conservan; los valores largos permanecen tipográficos. Estados binarios/categóricos usan una lectura visual no interactiva; sin lectura se muestra «—» y «Sin lectura». La carcasa Sensor puede crecer proporcionalmente al ancho para esta composición, con idéntica reserva inicial y skeleton propio, sin modificar el algoritmo masonry ni otros widgets. No se inventan tendencias, rangos, autonomía ni historial.

Refinamiento visual AC40 aprobado tras rechazo de la primera composición: encabezado, lectura y apoyo inferior ocupan bandas comunes; el meter no desplaza la lectura central. Las fichas tienen peso y profundidad contenidos. En tarjetas estrechas, el encabezado se reorganiza para mostrar nombres completos con saltos naturales, sin depender de tooltips. El tamaño se adapta al ancho sin grandes áreas vacías y el skeleton Sensor reproduce las mismas bandas. La validación técnica no sustituye la aprobación visual del usuario.

Refinamiento de densidad autorizado: Sensor ocupa siempre tamaño medio, incluidos valores históricos/importados, sin selector de tamaño ni resize. Dashboard y Espacios no repiten la estancia en cada Sensor; se compactan altura, cabecera y separaciones manteniendo fichas, unidad, meter y ausencia de lectura. No cambia el schema ni se migran datos.

**Estado:** Implementado  
**Autor:** HomePilot Engineering  
**Fecha:** 2026-07-17  
**Código trazado:** `apps/api/routes/DashboardRoutes.ts`, `packages/topology`, `apps/operator-console/src/views/DashboardView.tsx`, `apps/operator-console/src/views/dashboards/`

## 1. Declaración del Problema

Los usuarios necesitan tableros personales, locales y configurables que agrupen controles, cámaras, métricas, habitaciones, escenas y reproductores sin exponer información de otros usuarios.

## 2. Alcance

- Gestionar dashboards, pestañas, secciones, orden y widgets por usuario.
- Configurar título, visibilidad, fondo, icono y disposición responsive.
- Renderizar widgets de dispositivo, cámara, escena, habitación, sensor, reloj y media player.
- Filtrar la navegación y acceso a vistas por usuario autorizado, independientemente de su rol.

## 3. Fuera de Alcance

- Sincronización de diseños con Home Assistant.
- Edición colaborativa simultánea.
- Dashboards Cloud o compartidos entre hogares.

## 4. Requisitos Funcionales

- **REQ-01:** Cada dashboard pertenece a un hogar y conserva una política explícita de visibilidad por usuario.
- **REQ-02:** Solo el propietario o administrador autorizado puede modificar su configuración, secciones y widgets.
- **REQ-03:** Cada widget solo puede asociarse a entidades compatibles con su tipo.
- **REQ-04:** Reordenar secciones o widgets debe persistir su orden sin superposición de placeholders.
- **REQ-05:** El fondo cubre el viewport visible del tablero sin alterar el scroll de contenido.
- **REQ-06:** Las tarjetas de control reflejan el estado real y ejecutan solo acciones soportadas por su entidad.
- **REQ-07:** Las variables de identidad del título se resuelven exclusivamente desde el contexto autenticado de HomePilot.
- **REQ-08:** El menú del propietario exporta la pestaña activa como archivo versionado e importa una pestaña privada nueva en su Dashboard, sin sobrescribir pestañas ni cambiar la predeterminada. Los endpoints históricos de transferencia completa se conservan solo por compatibilidad.
  La importación conserva bindings solo si el target compatible existe en un hogar accesible al importador; en caso contrario mantiene el widget/card desasignado y reporta el pendiente, sin remapear por nombre ni rechazar el tablero completo. Los fondos integrados viajan por ID lógico; los uploads locales nunca viajan como ruta o binario y se notifican como no portables.
  Un Botón de sección almacena una escena nativa como `kind: action` y `entityId` de escena; las automatizaciones usan el prefijo `automation:` y los comandos de pantalla `device-action:<deviceId>:<actionKey>`. El informe solo señala bindings realmente ausentes o incompatibles; el título visible nunca se usa para resolverlos.
- **REQ-09:** Cada actualización de tablero crea una revisión local recuperable por su propietario; la restauración debe crear otra revisión del estado actual antes de aplicar la elegida.
- **REQ-10:** En modo edición, el encabezado de una vista usa los mismos affordances que una tarjeta: lápiz centrado al hover/foco y menú contextual con editar y eliminar; fuera de edición no expone esos controles.

## 5. Requisitos No Funcionales

- **NFR-01:** El canvas debe responder correctamente en móvil, tablet y escritorio, conservando scroll vertical.
- **NFR-02:** El encabezado del tablero permanece accesible durante scroll normal y de edición.
- **NFR-03:** Ningún widget debe introducir cadenas visibles fuera de i18n ES/EN.
- **NFR-04:** Los iconos se resuelven a través del catálogo MDI cargado bajo demanda.
- **NFR-05:** Las métricas de sensores usan tokens tipográficos responsive con nombre semántico; los widgets no definen escalas de texto arbitrarias en línea.
- **NFR-06:** La grilla conserva flujo secuencial: el placeholder final no rellena huecos ni se superpone visualmente a otras zonas.
- **NFR-07:** Los iconos comunes del tablero se resuelven sin cargar el catálogo MDI completo; los iconos personalizados mantienen compatibilidad mediante carga diferida al requerirse.
- **NFR-08:** La transferencia excluye propietario, visibilidad y fondos locales; la copia importada usa identificadores nuevos y solo es visible para quien la importa.
- **NFR-09:** El historial no guarda ni restaura imágenes de fondo locales; las revisiones no deben exponer secretos, permisos de otros usuarios ni rutas de archivos de otra instalación.
- **NFR-10:** Las tarjetas de reproductor multimedia ocupan el ancho completo de su sección para conservar comandos, títulos y progreso legibles. El visor ampliado de cámara prioriza la proporción del medio y aprovecha el viewport sin crear una columna vertical vacía.
- **NFR-11:** En edición, el lienzo ocupa como mínimo el área visible restante del viewport, incluso cuando una pestaña todavía no contiene widgets.
- **NFR-12:** El reordenamiento de zonas funciona mediante puntero y teclado desde el control de arrastre. Si una interacción se cancela, el estado visual transitorio se limpia sin alterar el orden persistido.
- **NFR-13:** Los kioscos verticales de alta resolución usan como máximo dos columnas en el canvas para conservar controles legibles a distancia, sin modificar los breakpoints de móvil, tablet o escritorio.
- **NFR-14:** En teléfonos, el canvas no excede su ancho disponible y las secciones presentan dos columnas internas; desde el breakpoint sm conservan las cuatro columnas de escritorio.`r`n- **NFR-14:** En teléfonos, el canvas no excede su ancho disponible y las secciones presentan dos columnas internas; desde el breakpoint `sm` conservan las cuatro columnas de escritorio.
- **NFR-15:** El fondo del tablero conserva un contenedor anclado al viewport durante la navegación. La siguiente imagen se precarga antes de reemplazar la anterior; una pestaña sin fondo limpia la imagen inmediatamente, sin modificar el box model del canvas.
- **NFR-16:** Las tarjetas asíncronas del Dashboard reservan su geometría durante la primera carga sin datos útiles. Un umbral visual compartido de 190 ms evita flashes; los refrescos conservan el último estado conocido y los estados offline/error no se confunden con carga. Los placeholders son decorativos, no interactivos, usan tokens claro/oscuro y respetan movimiento reducido.
- **NFR-17:** El refinamiento premium oscuro usa una veladura de fondo independiente de la imagen, superficies graphite translúcidas de Section y tiles con acento solo en estado activo real. Ninguna de esas superficies altera medidas, grid, spans, masonry ni la geometría del skeleton. Light conserva sus tokens propios.
- **NFR-18:** El catálogo ofrece un solo Reloj. Las cuatro variantes históricas de tarjeta y sus estilos persistidos siguen aceptados sin migración ni campo nuevo, pero todos renderizan HomePilotClock. Una nueva tarjeta usa el kind existente `clock_premium` y el mismo formato JSON.
- **NFR-19:** El preset lógico `homepilot-amber-residence` apunta a `/dashboard-backgrounds/homepilot-amber-residence.webp`. Solo se ofrece en el selector si ese asset independiente carga; al instalar el archivo aparece sin modificar el formato ni afectar fondos locales o portabilidad.

## 6. Criterios de Aceptación

- [x] AC1: Un usuario no ve ni accede por URL a un dashboard sin visibilidad asignada.
- [x] AC2: Crear, editar, mover y eliminar pestañas, secciones y widgets persiste al recargar.
- [x] AC3: El selector de entidad muestra solo tipos compatibles con la tarjeta elegida.
- [x] AC4: Los placeholders aparecen al final de la grilla disponible y no cubren tarjetas existentes.
- [x] AC5: Cámara, media, reloj, sensor y control mantienen una presentación válida en los tres breakpoints.
- [x] AC6: Los valores, porcentajes y títulos de sensores conservan una jerarquía legible mediante tokens responsive compartidos.
- [x] AC7: El saludo del tablero utiliza el nombre visible o usuario de la sesión autenticada y conserva un fallback traducido.
- [x] AC8: Un tablero con iconos comunes conserva sus controles visibles en móvil, tablet y escritorio sin requerir la carga inicial del catálogo MDI completo.
- [x] AC9: Exportar desde el menú produce un paquete `homepilot-dashboard-tab` de la pestaña activa, versionado y sin fondos locales ni políticas de acceso; la API histórica completa conserva `homepilot-dashboard`.
- [x] AC10: Importar desde el menú añade una pestaña privada con IDs nuevos, preservando las existentes y «Abrir al cargar». La API histórica completa conserva su contrato de copia privada.
- [x] AC11: Cada guardado de tablero deja una revisión local que su propietario puede restaurar sin perder la posibilidad de deshacer la restauración.
- [x] AC12: Restaurar una revisión no restituye referencias de imágenes de fondo locales eliminadas.
- [x] AC13: Las tarjetas multimedia a ancho completo, el visor ampliado de cámara y el inspector técnico preservan contenido y acciones legibles en móvil, tablet y escritorio, sin desborde ni áreas vacías desproporcionadas.
- [x] AC14: Una pestaña nueva en edición conserva el fondo cuadriculado y los placeholders hasta el borde inferior del viewport visible.
- [x] AC15: Una zona puede reordenarse desde su control de arrastre mediante teclado y una cancelación no deja overlay ni opacidad residual.
- [x] AC16: Las tarjetas de sensor, clima y cortina mantienen jerarquía visual, controles táctiles y ausencia de overflow horizontal a 320px, 768px y 1440px. Las lecturas y porcentajes siguen siendo legibles sin alterar sus contratos de datos ni comandos.
- [ ] AC17: `DashboardsView` espera la configuración inicial del tablero, pero monta el lienzo mientras llega el primer snapshot de dispositivos. Las tarjetas dinámicas sin datos muestran su propio placeholder tras el umbral compartido y no enseñan brevemente un estado "sin asignar"; las tarjetas con datos cacheados se renderizan de inmediato.
- [x] AC18: Un kiosco vertical de 1080×1920 distribuye el canvas en dos columnas y mantiene controles legibles, mientras móvil, tablet y escritorio conservan sus breakpoints existentes.
- [x] AC19: Cada tarjeta dentro de una `SectionWidget` reclama únicamente las filas de grid que necesita según su altura real medida (masonry denso), en vez de compartir la altura de la tarjeta más alta de su fila.
- [x] AC20: Reordenar tarjetas dentro de una sección funciona igual con mouse, teclado y touch (`@dnd-kit`), igualando el soporte táctil que ya tenía el lienzo externo de widgets.
- [x] AC21: Tanto una tarjeta de sección como un widget del lienzo externo pueden redimensionarse arrastrando una manija en la esquina inferior derecha, además del selector categórico existente; el arrastre siempre resuelve a uno de los tamaños ya soportados (no introduce un modelo de tamaño libre nuevo).
- [x] AC22: El catálogo de "agregar tarjeta" permite filtrar por categoría (Control, Información, Automatización, Reloj) además de la búsqueda de texto libre.
- [x] AC23: El campo `tab.layout` ('sections'/'masonry'/'sidebar'/'panel'), que no tenía ningún lector real en el código, fue eliminado del modelo de datos (frontend y backend) en vez de dejarse como una opción que aparentaba funcionar sin hacerlo.
- [x] AC24: In section edit mode, light and one-shot activator tiles may use the quarter-width size (four cards per row). Media-player cards always use full width, including imported legacy configurations; their width selector and resize handle are absent. Every other card is constrained to medium or full width.
- [x] AC25: Section cards are reordered by dragging the card surface. Editing remains directly available from a centered pencil, while the top-right overflow menu contains only Edit and Delete actions.
- [x] AC26: Editing preserves a section's normal spacing and dimensions. Its grid uses natural compact row flow instead of measured masonry placement, so mixed card heights never reserve an empty row before the next card. Empty-section add affordances use one compact tile cell, and card edit controls appear only on hover or keyboard focus.
- [x] AC27: Card edit affordances use a subtle hover/focus scrim. Editing renders each section as a bounded dashed surface with direct move, edit, delete, and resize controls, with an integrated 1–4 section-width selector; the new-section affordance occupies one canvas column. Deleting a section requires an explicit destructive confirmation before the layout changes.
- [x] AC28: Light and one-shot activator previews share the same compact icon tile and semantic surfaces as their live cards in light and dark themes. The dashboard navigation control remains reachable at the 1080×1920 portrait-kiosk breakpoint after the sidebar drawer is closed.
- [x] AC29: A single visible catalog option named Button lets the operator assign a light, compatible local button, scene, or routine. Existing action cards remain readable and executable; light targets retain their real on/off state, while one-shot targets use the exact light-tile on style during execution and briefly after success before returning to the same off style. No separate spinner, check, visible status word, or alternate success color appears; failures return the tile to off and remain announced accessibly. The editor relies on measured card height rather than a manual height control.
- [x] AC30: The background settings offer four bundled HomePilot backgrounds that are selectable without upload, persist as local dashboard values, and resolve from the operator-console origin in both light and dark themes. Custom uploaded backgrounds retain their existing API-hosted resolution path.
- [x] AC32: Static visual assets use URL-appropriate browser caching: fingerprinted bundles are immutable, named HomePilot visual assets are revalidated in the background, and locally stored user media remains private while replacement URLs are cache-busted.
- [x] AC33: La pestaña activa conserva su borde completo al hover; la tarjeta multimedia y el encabezado solo muestran acciones de desborde durante edición. El encabezado ofrece lápiz centrado y menú Editar/Eliminar con confirmación antes de borrarse.
- [x] AC34: A 320px el canvas y el modal de configuración no generan desborde horizontal; las pestañas del modal usan iconos accesibles y las tarjetas de sección conservan un ancho táctil de dos columnas.`r`n- [x] AC34: A 320px el canvas y el modal de configuración no generan desborde horizontal; las pestañas del modal usan iconos accesibles y las tarjetas de sección conservan un ancho táctil de dos columnas.
- [x] AC35: Las cámaras de Gestor de Dispositivos y ambos tipos de tarjeta del Dashboard comparten la presentación original del Dashboard: imagen protagonista con nombre y espacio superpuestos al pie. Muestran carga hasta el primer fotograma, dejan la imagen sin márgenes ni etiquetas redundantes y permiten ampliar pulsando la tarjeta completa, sin un botón flotante que tape la imagen y con acceso por teclado. El visor ampliado adapta su superficie a la proporción real del fotograma para mostrarlo completo, sin recortar bordes ni crear franjas internas; «En vivo», cierre y nombre permanecen superpuestos al video, sin cabecera ni pie.
- [ ] AC36: El round-trip conserva orden, iconos, spans y apariencia; los enlaces internos a pestañas usan los nuevos IDs. Bindings externos se conservan solo si existen, son compatibles y pertenecen a un hogar autorizado; los ausentes quedan desasignados y aparecen en un reporte seguro y opcional de la respuesta API, manteniendo el cuerpo Dashboard compatible.
- [ ] AC37: Un fondo built-in viaja por ID lógico y recupera su opacidad; un fondo local subido no serializa su ruta y al importar usa el fallback seguro con reporte de asset omitido. Archivos mal formados devuelven DASHBOARD_IMPORT_INVALID.
- [ ] AC38: La importación conserva el título si es único y, ante colisiones visibles para el usuario, añade el sufijo determinista «· Importado»/«· Imported» y luego un número sucesivo; el reporte describe asignaciones pendientes sin mostrar IDs internos.
- [x] AC39: En todos los tamaños el encabezado ofrece una sola entrada «Editar» dentro de «Más», junto a transferencia de pestaña e historial. Edición permite renombrar y modificar contenido; «Finalizar» permanece visible y no hay desborde horizontal.
- [x] AC40: La tarjeta Sensor usa la referencia analógica autorizada: icono, nombre una vez, esfera de 240° con marcas y aguja proporcional al dato real, lectura grande y unidad debajo, sin repetir estancia en Dashboard/Espacios. Conserva tamaño medio sin selector ni resize, incluidos datos históricos/importados. Los números usan límites reales o escala automática explícita; las graduaciones compactas conservan el límite (150000 → 150k, no 2e+5). Escala no implica rango saludable. Binarios/categorías son información, no switches; el pie mantiene avisos existentes. Sin lectura: esfera neutra sin aguja ficticia, «— / Sin lectura», sin unidad, meter ni estado normal. Componente, preview y skeleton comparten carcasa responsive y reserva estable en móvil, tablet vertical/horizontal, escritorio y kiosco, claro/oscuro. No se añade ellipsis decorativo, backend ni cambios al grid global.
- [ ] AC41: El reloj predeterminado es digital y muestra hora, fecha y clima con jerarquía ambiental; las variantes analógicas existentes siguen disponibles pero su hora numérica secundaria no compite con la esfera.
- [ ] AC42: Al cambiar entre tableros con imagen, sin imagen y con presets o uploads, el fondo conserva sus bounds y el canvas mantiene su posición en desktop y tablet; la imagen nueva no reemplaza a la anterior hasta cargarse.
- [ ] AC43: Sensor, dispositivo, cámara, media y energía usan skeletons semánticos únicamente durante su primera carga sin contenido. Cámara conserva proporción 4:3 y un fotograma anterior; reloj muestra la hora inmediatamente y limita el placeholder al clima; botones/escenas con configuración local no muestran carga falsa. Un error u offline finaliza el skeleton; si falla el primer snapshot de dispositivos, el tablero ofrece un aviso y reintento sin cambiar el contrato del store.
- [ ] AC44: En escritorio, tablet, móvil y kiosco vertical, la transición skeleton → contenido mantiene bounds de tarjetas, sección y canvas sin overflow horizontal. Los placeholders no reciben foco ni ejecutan comandos; la animación se desactiva con `prefers-reduced-motion`.

## 7. Notas Técnicas y Arquitectura

- API: `/api/v1/dashboards/*` mediante `DashboardRoutes`.
- Las estructuras de dashboard pertenecen al contexto de topología; los widgets no contienen reglas de negocio de dispositivos.
- `DashboardCanvas` y el catálogo de widgets son el único punto de montaje visual de tarjetas.
- El resolver de importación valida Botones de dispositivo con `resolveCapabilitiesForDevice` y `CAPABILITY_DEFINITIONS`, como la API de dispositivos. El repositorio almacena tipos de capacidad, no necesariamente el arreglo `commands` enriquecido que recibe la UI; una escena HA con `activate` no debe quedar desasignada por esa diferencia de representación.
- `DashboardsView` conserva `LoadingState` para la configuración inicial del tablero y llama `refreshSnapshot()` al montar. La espera del primer snapshot se representa dentro de cada tarjeta dinámica; el store conserva dispositivos previos durante refresh y la presentación no añade estado de skeleton al dominio.

## 8. Preguntas Abiertas y TODOs

- El paquete de transferencia no incluye fondos locales. Estos dependen del almacenamiento de cada Edge y se vuelven a configurar después de importar.
- Deliberadamente fuera de esta pasada de paridad con Home Assistant (2026-08-22): una barra de badges en la parte superior de una vista, y un modo de edición YAML/código por vista. El export/import de tablero completo ya cubre parte de ese caso de uso; se evaluará si vale la pena un editor granular por vista más adelante.
