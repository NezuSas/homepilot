# SensorMetricCard — instrumento analógico local

Refinamiento vigente: se omiten «Normal», punto verde y leyenda textual de escala. Límites/graduaciones/configuración y precisión no cambian; se mantienen ausencia y avisos de riesgo. Footer/skeleton mantienen reserva exterior estable, sin simular etiquetas eliminadas.

AC45: una única carcasa/modelo selecciona SensorAnalogGauge, SensorThermometer, SensorLevelGauge o SensorBatteryGauge. Los presenters verticales reutilizan el sistema de líquido de SensorLevelGauge; todos usan sensorNeedleFraction. `visualStyle` opcional viaja en extra.cards, sin SQL; ausente gauge histórico, nuevo auto por metadatos (nunca nombre como única fuente). Valor/unidad/estado accesible se presentan una sola vez por SensorMetricCard. Canvas interpola aguja 400 ms con RAF cancelable; líquido usa transform/transition 400 ms. Reduced-motion es inmediato. Sin lectura no hay relleno/aguja/meter ficticio. El viewport y la proporción 320/265 son iguales entre renderers; skeleton existente conserva la reserva exterior.

Validación: 181/181 Jest, 13/13 responsive focalizados, typecheck/lint/builds y trazabilidad PASS. Sin servicios físicos ni suites completas. La carga de batería solo se indica con metadatos booleanos reales charging/is_charging; nunca se infiere del porcentaje.

AC42: optional `sensorScale: { min, max }` comes from each Dashboard card. Finite min < max overrides device/automatic scale for live and preview. Real readings and out-of-range accessible text remain unchanged; needle is clamped only visually. Missing readings still have no fabricated meter. Editor clears both bounds to restore historical behavior. JSON extra.cards persists/imports it without SQL migration; earlier editors may discard it on downgrade.

## Overview

Este documento registra la extensión visual del Sensor existente, derivada del componente implementado. No define una identidad global nueva. HomePilot conserva su modelo de appliance local-first: el estado procede del snapshot del dispositivo y el navegador lo presenta, según [la arquitectura](../architecture.md).

El contrato vigente es el apartado «Sensor analógico — referencia autorizada 2026-10-02» de [Dashboard Layout and Widgets V1](../../specs/dashboard-layout-and-widgets-v1.md). La referencia del usuario contiene cuatro tarjetas principales; su composición se traduce en un instrumento real de datos con esfera de 240°, marcas, aguja, lectura, unidad y pie. No se afirma equivalencia píxel a píxel. Los párrafos históricos de fichas/barra y el texto anterior de AC40 no describen este presenter analógico.

Fuentes de implementación:

- `apps/operator-console/src/views/dashboards/widgets/SensorMetricCard.tsx`: lectura, categoría, severidad, composición y semántica accesible.
- `apps/operator-console/src/views/dashboards/widgets/SensorAnalogGauge.tsx`: escala, marcas y dibujo de la aguja.
- `apps/operator-console/src/index.css`: carcasa y bandas del Sensor, aproximadamente líneas 944–1130.
- `apps/operator-console/src/components/ui/DashboardCardSkeleton.tsx`: placeholder específico de Sensor.

## Colors

La tarjeta hereda los tokens HomePilot de ambos temas. La carcasa combina `--dashboard-surface-raised`, `--dashboard-surface` y `--dashboard-edge`; texto y apoyos usan `--foreground` y `--muted-foreground`. La esfera utiliza `--card`, `--popover` y `--border`; el tramo recorrido y la aguja combinan `--primary` y `--light-active`. Estos nombres siguen siendo la fuente normativa de color; no se duplica una paleta fija aquí.

**Regla de escala sin diagnóstico.** El acento del recorrido indica posición de la lectura, no una zona saludable. Temperatura, presión y otras magnitudes sin política previa no reciben umbrales inventados.

El pie conserva la política existente: batería/señal baja o crítica, memoria de uso elevado y humedad fuera de su intervalo establecido. Los puntos de estado usan `success`, `warning` o `danger` con una etiqueta textual. La ausencia usa superficie y texto neutros, sin punto de estado normal.

## Typography

Rubik es la familia residente de HomePilot y también la familia de las marcas Canvas. El nombre tiene peso medio (500), tamaño adaptable al contenedor y saltos naturales. La lectura analógica tiene peso (550), dígitos tabulares y un tamaño común para valores de hasta seis caracteres, incluidos signos y decimales. Solo lecturas excepcionalmente largas se reducen para no desbordar. La unidad se sitúa junto al número, sobre la misma línea y alineada a su baseline. El pie y la escala tienen jerarquía secundaria y admiten saltos.

Las marcas usan `formatSensorGaugeTick`: cuatro cifras significativas, sufijo `k` desde magnitudes de 10 000 y `M` desde 1 000 000. Así, 150 000 y 75 000 se dibujan como `150k` y `75k`. Esta compactación afecta exclusivamente las marcas; no modifica límites, lectura real ni texto completo de escala del pie.

## Layout

El Sensor conserva el tamaño medio y su integración en el grid existente, incluidos valores históricos/importados. El presenter no modifica el algoritmo de masonry ni la distribución de otras tarjetas. Dashboard y Espacios muestran el nombre una vez sin repetir la estancia; la prop opcional `roomName` continúa disponible para un contexto que la necesite.

La composición reserva tres bandas: cabecera con icono y nombre; instrumento dominante con lectura/unidad; pie con estado y escala. La carcasa no impone altura mínima adicional: usa padding vertical de 0.5rem, cabecera mínima de 2rem y bloque central sin expansión flexible, con padding de 0.25rem. El padding horizontal se adapta al contenedor `sensor-card`. El instrumento ocupa el ancho disponible con máximo (22rem) y relación Canvas (320/265). Por debajo de un ancho de instrumento de 200px se dibujan cuatro divisiones (cinco etiquetas) y en anchos mayores cinco divisiones (seis etiquetas), conservando los extremos. El pie reserva las mismas filas con o sin estado para evitar saltos durante carga.

El skeleton Sensor usa la misma carcasa, cabecera, banda del instrumento, relación de aspecto y reserva del pie. No representa una lectura. La selección del skeleton durante la primera carga corresponde al contenedor existente; esta extensión no cambia el contrato de carga ni añade estado al store. Los placeholders son decorativos, no interactivos y heredan la política compartida de movimiento reducido.

## Elevation & Depth

La carcasa usa el gradiente y la sombra suave existentes del Sensor, con luz interior. Tres aros concéntricos, superficie radial y pivote aportan profundidad al instrumento. El dibujo se recalcula al variar ancho, lectura/límites, clase de tema y disponibilidad de fuentes; el backing Canvas se adapta al DPR. La profundidad está subordinada a la legibilidad de marcas y lectura.

## Shapes

La carcasa mantiene esquinas suavizadas (1rem). La esfera recorre 240°, desde 150° hasta 390°, y deja espacio inferior para lectura y unidad. La aguja triangular parte del pivote central y su ángulo deriva del valor real normalizado a la escala. La etiqueta de estado conserva forma de cápsula. Ninguna geometría de este componente se convierte en una regla global para otras tarjetas.

## Components

### Resolución de lectura y datos

`getSensorReading` busca el primer valor textual válido en `state`, `value`, `native_value`, `level`, `battery` del estado y luego en `state`, `value`, `native_value`, `battery_level` de atributos. La unidad prioriza metadatos del estado, después atributos y finalmente una unidad reconocida dentro del valor. La clase explícita del dispositivo precede a las heurísticas de nombre/unidad.

Las lecturas numéricas admiten signo y separador decimal punto o coma. Estados vacíos, `none`, `null`, `unknown`, `unavailable` y `offline` se consideran ausencia. Binarios y categorías siguen siendo información textual con símbolo; no tienen medidor numérico ni se convierten en switches.

### Prioridad de escala

| Orden | Fuente | Comportamiento |
| --- | --- | --- |
| 1 | `attributes.min_value`, `attributes.min`, `state.min_value`, `state.min`; orden equivalente para máximo | El primer candidato por extremo se acepta si ambos son números finitos y máximo es mayor que mínimo. |
| 2 | Porcentaje sin límites válidos | Escala de 0 a 100. |
| 3 | Ventana de instrumento según unidad | °C: −10 a 50; °F: 0 a 120; bar: 0 a 6; hPa: 950 a 1050, cuando contiene la lectura. |
| 4 | Otras unidades o valor fuera de ventana | Escala automática que contiene la lectura, con pasos derivados de su magnitud. |

Las ventanas de referencia pertenecen a la fuente `automatic` y el pie las identifica como escala automática. No significan «rango normal». Si los límites explícitos no contienen el valor, aguja y `aria-valuenow` se limitan visual/semánticamente a los extremos; la lectura visible y `aria-valuetext` conservan el valor real.

### Ausencia y preview

**Regla de ausencia neutra.** Sin lectura se conserva el nombre, esfera neutra y pivote, pero no se dibujan aguja ni números de escala. Se muestran «—» y «Sin lectura», sin unidad ni rol `meter` ni valor ficticio.

La preview usa el mismo componente. Cuando recibe un dispositivo, usa sus datos. Solo una preview explícita sin dispositivo ofrece la muestra existente de batería (50 %); no es un fallback de telemetría para tarjetas reales.

### Accesibilidad y reutilización

La lectura numérica con escala expone `role="meter"`, nombre configurado, mínimo, máximo, valor acotado y texto del valor real con unidad. El Canvas y el icono decorativo tienen `aria-hidden`; la información accesible permanece en HTML. Nombre y texto de estado complementan el color. Los estados categóricos mantienen lectura HTML informativa. El componente no emite comandos físicos.

`SectionCardContent` monta el mismo presenter en Dashboard y preview; `TopologyDeviceTile` lo reutiliza en Espacios. El contenedor conserva binding, edición y menú funcional. No se añade un menú decorativo al instrumento.

### Evidencia y límites de verificación

Validación final local: 75/75 pruebas Jest en SensorMetricCard, SensorAnalogGauge, DashboardCardSkeleton y TopologyDeviceTile, incluidos cinco casos de marcas compactas. Responsive focalizado: 17/17 escenarios de Sensor/Espacios/estabilidad inicial y confirmación 5/5 Sensor con presión/humedad en ambos temas. Typecheck, lint y builds raíz/consola PASS. Esto no equivale a ejecutar toda la matriz responsive ni a aprobación visual del usuario; tablet física/Safari siguen sin certificar.

El alcance es presentación de frontend. No cambia backend, contratos de API, autenticación, stores globales, schema, persistencia ni migraciones. La reversión restaura el presenter anterior sin transformar datos. No se generan `DESIGN.md` global ni sidecar de componentes ficticios.

## Do's and Don'ts

- Conservar una sola composición modular para Dashboard, Espacios y preview, los tokens de ambos temas y la misma reserva de skeleton/contenido.
- Conservar el valor real en lectura y texto accesible aunque la aguja esté limitada por límites explícitos.
- Identificar las escalas automáticas; no derivar salud, tendencias, autonomía o historial de la posición de la aguja.
- Mantener ausencia neutral, sin valores de ejemplo en tarjetas reales ni estado saludable ficticio.
- No reutilizar como norma las fichas partidas, estilos `sensor-reading-digit` ni barra porcentual de la composición descartada. Las reglas CSS residuales no justifican reintroducir esa presentación.
- No considerar esta documentación evidencia de publicación, aprobación visual o ejecución de validaciones aún pendientes.
## Precisión y rango fijo por tarjeta

`sensorDecimals` ausente/false presenta enteros redondeados; true presenta hasta dos decimales. No modifica el estado, severidad ni posición de la aguja; `aria-valuetext` conserva el valor original. El editor y preview comparten esta opción persistida en JSON junto a `sensorScale`, compatible con import/export, sin SQL nuevo. Cuando una entidad seleccionada no está disponible, el preview no inventa la lectura de catálogo.

La escala configurada se usa directamente y permanece visible aun sin lectura; sin lectura no hay meter accesible ni aguja inventada. Seis graduaciones estables independientemente del ancho y formato de etiquetas sin redondeo a cuatro cifras significativas; límites de tarjeta preceden siempre a metadatos y ventanas automáticas. No cambia la carcasa, paleta ni tamaño exterior.

