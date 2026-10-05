# Reloj: contrato y validación geométrica AC56

## Revisión vigente de composición — 2026-10-05

Esta sección sustituye los umbrales y la matriz de las revisiones anteriores conservadas más abajo como evidencia histórica. Se toma como baseline la medida de Fase0 indicada por el usuario:300×160px, esfera110px y detalles visibles. La revisión conserva fecha/hora a12px mínimo y añade clima en el default; la esfera actual mide125,16px en ese caso, no110px.

El bloque esfera/detalles se centra, con máximo480px y gap proporcional8..20px. Su ancho real en300×160 es125,16+8,94+144=278,10px; el espacio adicional queda en márgenes. En1364×160 el bloque mide142+20+144=306px, sin separación artificial. Esfera limitada por ambos ejes y42% del ancho con detalles.

Elegir el nivel mejor factible antes de desempatar por proporción: horizontal L3≥200×104, L2≥228×132, L1≥244×160; vertical L3≥94×132, L2≥146×172. Vertical L1 requeriría70px de esfera+134px de detalles+8px gap+18px borde/padding=230px como mínimo; se reserva236px para holgura, fuera del máximo216px. L1 horizontal tiene detalles144px: hora25px + día16px + fecha16px + divisor17px + clima60px =134px; con borde/padding18px necesita152px, cabe en filas6=160px. Diámetro mínimo70px+144px de detalles+8px gap+18px padding/borde+2px de diferencia inline=242px; umbral244px proporciona2px de holgura. Prueba de frontera243/244px, ambos contextos. No se reduce texto bajo12px para encajar.

La diferencia exterior de2px se elimina únicamente en el wrapper clock_display: ClockShell conserva su borde y ambos consultan el mismo tamaño exterior. El barrido compara nivel, disposición y diámetro entre sección explícita, histórica automática e independiente. No se modifica JSON, contrato, grid ni dimensiones persistidas.

Marca: oculta bajo100px de diámetro, incluido fallback72px. Consulta el contenedor de la propia esfera (98px interiores +2px de borde), no el viewport. Se conserva la identificación del producto fuera de la esfera; ocultar evita competencia con manecillas sin reservar espacio adicional. Captura300-4x4.png: esfera74,66px limpia. No se promete ausencia de cruce de manecillas con la marca cuando es visible en diámetros mayores.

| Celdas | Sección300px | Sección700px | Sección1364px |
| --- | --- | --- | --- |
|4×4|L4, solo esfera|L3, horizontal|L3, horizontal|
|6×4|L4, solo esfera|L3, horizontal|L3, horizontal|
|8×4|L4, solo esfera|L3, horizontal|L3, horizontal|
|12×4|L3, horizontal|L3, horizontal|L3, horizontal|
|4×6|L3, vertical|L2, horizontal|L1, horizontal|
|6×6|L3, vertical|L1, horizontal|L1, horizontal|
|12×6|L1, horizontal|L1, horizontal|L1, horizontal|
|12×7|L1, horizontal|L1, horizontal|L1, horizontal|
|12×8|L1, horizontal|L1, horizontal|L1, horizontal|

Clima dentro del contrato: filas6..8 y columnas≥10 en sección300px, ≥5 en700px, ≥4 en1364px (mínimo permitido4). Equivalencia de ancho `(sectionWidth+8)*columns/12-8`. Casos300×160,300×188 y300×216: L1 horizontal, mismo resultado en los dos contextos.

### Evidencia de esta revisión

Build local `index-BUahPuuV.js` / `index-Cjdsfniz.css`, servido por vite preview4180. Chromium151.0.7922.34, Firefox153.0 y WebKit26.5 de Playwright en Windows. Cada motor pasó los cuatro barridos (6885 geometrías), matriz20 casos, fallback270 casos, dos editores y hoja de27 capturas. Muestreo de sección cada50px entre300 y límite útil del viewport, con extremos y4000px adicionales; se barre cada tamaño de4..12 columnas y4..8 filas, en tres caminos de render. Se exige mejor nivel/disposición, paridad, círculo, presupuesto de diámetro, bloque centrado/gap, contención, ausencia de scroll/solapamiento y textos≥12px visibles, salvo marca decorativa10px. No es el barrido entero por cada1px de la fase previa.

Resultado por navegador: Chromium9/9, Firefox9/9, WebKit9/9 contando la repetición de hoja de contacto. Ejecución conjunta26/27: el único fallo fue timeout30s al generar capturas WebKit; repetición con presupuesto120s pasó1/1 en23,1s. No se relajó ninguna aserción geométrica. El primer montaje de paridad borraba el inline borderWidth del componente al clonar; se corrigió para preservar el borde computado del original. Estos fallos de montaje/artefactos no se presentan como fallos de layout del renderer.

Jest48/48, typecheck raíz/consola, lint, builds raíz/consola, controles spec/BDD/cobertura modular/i18n/primitivas/arquitectura/ausencia de any PASS; detector de layout sin hallazgos. Capturas pequeñas y default inspeccionadas. Evidencia en `C:/Users/ocuen/.codex/visualizations/2026/08/31/01a059d6-a4fc-7c90-8fca-5c6c50bfa212/clock-composition-review`: `verified` contiene Chromium/Firefox y pruebas multimotor; `webkit-contact` contiene la hoja WebKit repetida; `review.diff` compara exactamente los seis archivos contra snapshots previos a esta revisión, normalizando únicamente finales LF/CRLF y sin Git.

No se certifican Safari/iPad reales, versiones mínimas antiguas, tablet física, todos los textos/localizaciones/condiciones meteorológicas, cada ancho entero de sección ni suite global/Docker. Se mantienen truncamientos de localización/condición larga existentes. Sin Git, deploy, SQLite, backend ni PLC. Contrato4×4..12×8 y JSON histórico intactos.

## Medidas de Fase 0

La grilla interior conserva 12 columnas, filas de 20 px y gaps de 8 px. Ancho de tarjeta: `(ancho útil + 8) × columnas / 12 − 8`; altura explícita: `filas × 28 − 8`.

| Viewport | Sección útil observada | Ancho de celda observado | Mayor sección útil posible en ese viewport, sidebar cerrado |
| --- | ---: | ---: | ---: |
| 360 | 300 | 17,6562 | 300 |
| 768 | 314 | 18,8281 | 692 |
| 1024 | 442 | 29,5 | 948 |
| 1440 | 329,328 | 20,1094 | 1364 |

Las medidas iniciales corresponden a la interfaz desplegada. La comprobación final usa exclusivamente `vite preview` del build compilado localmente, con fixtures autenticados simulados. Los escenarios verifican bundles `/assets/` y ausencia de `/@vite/client`.

Build final comparado: `apps/operator-console/dist`, entrada `index-BAFbbHne.js`, CSS `index-pTIt3kiN.css` y dashboard `DashboardsView-kBZnmTQm.js`, servido en loopback 127.0.0.1:4173. No es el build del sitio remoto.

`dashboardUtils` limita el número de slots por pestaña, no los píxeles del canvas. Por tanto no existe un máximo global finito de ancho de sección. El barrido visita cada ancho entero desde 300 hasta el máximo de cada viewport, más una sección de 4000 px. No equivale a certificar todos los anchos infinitos posibles.

## Contrato

Fuente única: `clockRegistry.ts`, `CLOCK_GRID` y `getClockGridOptions()`.

- Default: 12×6, altura 160 px; confirma la hipótesis del tamaño histórico en el caso de sección de 300 px.
- Mínimo: 4×4, aproximadamente 94,67×104 px en sección de 300 px. Esfera de al menos 70 px, incluida su marca; las alternativas inmediatas de tres columnas o tres filas no cumplen ese presupuesto.
- Máximo: 12×8, altura 216 px, alineado con la matriz actual de diseño.
- Filas automáticas históricas se proyectan localmente a seis; no se reescribe JSON al abrir. Al guardar una edición se conservan dimensiones explícitas y acotadas.
- Editor de sección, guardado, selector, render, creación y editor del reloj independiente consumen el contrato. Los límites del helper de resize se prueban con este mismo contrato; no se reintroducen handles retirados.

## Contenido y composición

Los niveles dependen de dimensiones del content box en píxeles, no de las celdas. La esfera usa el mismo `min()` para ancho y alto. `container-type: size` tiene siempre altura explícita; no utiliza ResizeObserver ni clase compacta como fuente de verdad.

| Forma y presupuesto | Nivel | Contenido |
| --- | --- | --- |
| Horizontal, al menos 400×188 | 1 | Esfera/marca, fecha, hora y clima |
| Horizontal, al menos 320×132 | 2 | Esfera/marca, fecha y hora |
| Horizontal, al menos 280×104 | 3 | Esfera/marca y hora |
| Vertical/cuadrado, al menos 160×216 | 2 | Esfera arriba; fecha y hora debajo |
| Vertical/cuadrado, al menos 120×188 | 3 | Esfera arriba; hora debajo |
| Resto del rango permitido | 4 | Solo esfera, con marca interior |

Horizontal significa relación ancho/alto mayor que 1,2. El nivel 5 no es necesario: el contrato no permite franjas de menos de 104 px. Texto contextual de 12 px, hora de 20–32 px; la marca interior escala de 10–12 px. El umbral se evalúa en content box: los bordes del wrapper independiente pueden desplazar una transición marginal respecto al wrapper de sección.

Ejemplos del reloj de sección, sin borde exterior adicional:

| Tamaño en celdas | Sección útil | Tarjeta | Nivel | Disposición |
| --- | ---: | --- | --- | --- |
| 4×4 | 300 | 94,67×104 | 4 | Esfera centrada |
| 6×6 | 300 | 146×160 | 4 | Esfera centrada |
| 6×8 | 300 | 146×216 | 3 | Vertical |
| 8×8 | 300 | 197,33×216 | 2 | Vertical |
| 12×6 | 300 | 300×160 | 3 | Horizontal |
| 6×6 | 692 | 342×160 | 2 | Horizontal |
| 12×8 | 692 | 692×216 | 1 | Horizontal |

## Diff funcional, sin operaciones Git

- `clockRegistry.ts`: contrato y clamp; nuevo `clockRegistry.test.ts`: compatibilidad, límites y presupuesto mínimo.
- `SectionClockPreview.tsx`: elimina observer/clase compacta y utiliza default compartido.
- `SectionCardItem.tsx`: proyección histórica y contenedor de alto explícito.
- `SectionCardEditorModal.tsx`, `CardGridSizePicker.tsx`, `SectionWidget.tsx`: límites compartidos, sin automático para reloj, preview y guardado coherentes.
- `DashboardWidget.tsx`: contenedor clock-card, dimensiones acotadas y editor independiente con preview.
- `dashboardMutations.ts`: creación independiente con default compartido.
- `index.css`: niveles por container queries, esfera circular y tipografía legible; elimina topes anteriores de 110/170 px.
- `cardGridResize.test.ts`, `responsive-shell.spec.ts`: contrato y geometría real de los tres caminos de render, límites por teclado y edición independiente.
- Spec/tareas de dashboard y matriz de cobertura: trazabilidad AC56 y actualización por el nuevo archivo de prueba.

## Alcance de verificación

Jest focalizado: seis suites, 48 pruebas. Responsive: cuatro barridos y dos escenarios de edición. El barrido cubre 45 dimensiones por ancho y tres renderizadores (sección explícita, sección histórica automática e independiente), con 285120 combinaciones: 270 / 53190 / 87750 / 143910 para los cuatro viewports. Comprueba esfera cuadrada/legible/contenida, contenido correspondiente al nivel, ausencia de overflow y superposición de textos/esfera. Espera las fuentes antes de medir.

Typecheck raíz/consola, lint, builds raíz/consola, spec, BDD, cobertura modular, i18n, arquitectura, primitivas UI y ausencia de `any` forman la validación focalizada. Las capturas y JSON geométricos se producen en los resultados Playwright.

Resultado final: 48/48 Jest, 6/6 escenarios responsive (3,1 minutos), y todos los controles anteriores PASS. El build backend necesitó autorización de escritura de artefactos tras un EPERM del sandbox; su repetición autorizada pasó. El frontend mantiene warnings de Browserslist antiguo y tamaño de chunks, no errores. Se inspeccionaron las capturas de 360 y 1024 px. Los adjuntos geométricos se incluyen como evidencia del escenario; las cuatro capturas `clock-contract.png` permanecen bajo `apps/operator-console/test-results/`.

No se certifican tablet física, Safari/Firefox, todos los idiomas/datos meteorológicos posibles, suite global de regresión ni ejecución Docker. No se abre producción ni se contacta PLC; no se modifica SQLite. El rediseño conserva la paleta existente. No se realizan operaciones Git ni deploy.

## Evidencia adicional tras revisión

La prueba anterior no detectaba un tope simétrico de 110px si la esfera seguía circular y contenida. Se confirmó mediante CSS temporal en Chromium. Se reforzó el barrido para comprobar el diámetro disponible y el scroll del wrapper; con la mutación falla el escenario de 360px (`dial does not fill available budget`) y sin ella pasan 7/7 escenarios, incluidos los cuatro barridos y una hoja de contacto de 16 capturas. La UI y CSS de producción no cambiaron en esta revisión. Jest 48/48, typecheck, lint y spec/BDD/cobertura modular PASS.

El mínimo 4×4 produjo tarjeta94,66×104px y esfera74,66px, nivel4, marca10px sin overflow. Es un mínimo geométrico inspeccionado visualmente, no certificación de legibilidad en hardware/distancia arbitrarios. Las combinaciones se midieron en DOM clonado dentro del navegador real, no en jsdom ni mediante únicamente el modelo matemático. El motor de navegador del kiosco real sigue sin constar de forma verificable en el proyecto.

## Comparación de contenido y compatibilidad (2026-10-05)

No se dispone de un snapshot verificable del CSS/observer inmediatamente anterior a AC56. La otra copia local `homepilot` es una versión distinta, no un baseline válido. Por tanto, no se certifica el contenido visible ANTES ni una pérdida exacta de contenido histórico; no se realizaron operaciones Git para recuperarlo. Esta limitación no se sustituye por inferencias a partir del marcado.

Matriz AHORA comprobada con Chromium sobre el frontend compilado localmente (`index-FknoDori.js`, `index-DEp-Faa6.css`). Todos muestran esfera y marca. El encabezado Reloj queda oculto en todos los casos.

| Celdas | Sección útil px | Antes | Ahora sección | Ahora independiente |
| --- | ---: | --- | --- | --- |
| 12×6 | 300 | No verificable | L3: hora digital | L3: hora digital |
| 12×6 | 700 | No verificable | L2: hora, día y fecha | L2: hora, día y fecha |
| 12×6 | 1364 | No verificable | L2: hora, día y fecha | L2: hora, día y fecha |
| 12×7 | 300 | No verificable | L3: hora digital | L3: hora digital |
| 12×7 | 700 | No verificable | L1: hora, día, fecha y clima | L2: hora, día y fecha |
| 12×7 | 1364 | No verificable | L1: hora, día, fecha y clima | L2: hora, día y fecha |

La diferencia 12×7 entre contextos está medida: el borde exterior independiente resta 2px y deja 186px de alto consultable, inferior al umbral L1 de 188px. No se modifica este umbral en esta revisión.

Los escenarios reales `Clock editing / A section clock can be resized with bounded design and moved or removed` y `Clock editing / A standalone clock shares the bounded design contract (AC56)` ejercitan los límites por teclado (20 intentos repetidos por extremo), selección en la matriz y guardado. El editor de sección verifica además la celda 2×2 deshabilitada. No existen handles de drag-resize para estos relojes: no se afirma que se hayan probado handles inexistentes. `cardGridResize.test.ts` protege el helper de redimensionado por separado, en Jest.

### Fallback progresivo

La versión mínima de las características CSS es Chrome/Edge105, Firefox110 y Safari16/iOS16. Fuentes oficiales: https://developer.chrome.com/docs/css-ui/style-queries y https://webkit.org/blog/13152/webkit-features-in-safari-16-0/. Esto no certifica el soporte de toda la aplicación en esas versiones ni identifica el navegador instalado en kioscos.

El CSS base muestra únicamente esfera de 72×72px y su marca, centradas, sin detalles ni unidades de contenedor. La composición moderna se habilita con `@supports` para container-type y cqw/cqh/cqi. No introduce JavaScript, observer, cambios de contrato ni persistencia.

El escenario `Unsupported queries retain a bounded dial (AC56)` elimina solo el bloque de mejora progresiva de la hoja CSS compilada interceptada en Playwright: prueba la base real, no una sobreescritura ficticia de tamaños. Comprueba 270 geometrías (45 tamaños × 3 anchos × 2 contextos), esfera72px, contenido L4, contención y ausencia de scroll. No equivale a ejecutar Safari15/Chromium104; esos motores siguen sin validar. El escenario `Default content matrix (AC56)` comprueba las 12 filas observables de la tabla.

La primera ejecución sobre el servidor de desarrollo existente fue rechazada por la aserción de assets compilados; la evidencia válida se obtiene con `vite preview` separado en 127.0.0.1:4180. En una ejecución conjunta, el test de edición tomó dos boundingBox en instantes distintos tras cambiar viewport y falló; la repetición aislada pasó sin cambios. Se corrigió únicamente esa medición para consultar ambos rectángulos en una misma evaluación y esperar estabilización, manteniendo el límite de 1px de overflow. No se relajó el contrato ni se modificó el renderer.

Validación final: 9/9 Playwright PASS (3,2 minutos), incluidos 285120 casos modernos, matriz12 casos, fallback270 casos y dos editores. Jest48/48, typecheck raíz/consola, lint, builds raíz/consola, spec/BDD/cobertura modular/i18n/arquitectura/primitivas/ausencia de any PASS. Evidencia: `C:/Users/ocuen/.codex/visualizations/2026/08/31/01a059d6-a4fc-7c90-8fca-5c6c50bfa212/clock-ac56-compatibility-verified`. Configuración temporal de puerto retirada y servidor propio detenido; servidor ajeno en4173 intacto. No se ejecutó Docker, suite global, Git, deploy, SQLite ni PLC.
