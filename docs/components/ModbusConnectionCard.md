# ModbusConnectionCard

Referencia local de la configuración Modbus TCP de Sistema. Implementación: `apps/operator-console/src/components/ModbusConnectionCard.tsx`; composición y formularios: `apps/operator-console/src/views/ModbusView.tsx`. Contrato aprobado: [Integración Modbus TCP local V1](../../specs/modbus-tcp-local-integration-v1.md), especialmente AC1, AC2 y AC7.

## Propósito y límites

Modo **Operate**: mostrar conexiones y mapas explícitos de variables para que Admin configure la integración local. La tarjeta resume configuración; el estado habilitado indica polling configurado, no conectividad ni disponibilidad actual del PLC. No muestra valores en vivo ni ejecuta órdenes físicas. Inventario, asignación a estancia y selección de widgets siguen los flujos existentes.

Esta extensión conserva los tokens y controles de HomePilot. `index.css` y los componentes compartidos son la autoridad visual existente; este documento no establece un sistema global ni crea `PRODUCT.md`, `DESIGN.md` o sidecars de Impeccable.

## Contrato del componente

`ModbusConnectionSummary` combina `ModbusConnection` con `variables: ModbusVariable[]`.

| Prop | Tipo | Responsabilidad |
| --- | --- | --- |
| `connection` | `ModbusConnectionSummary` | Nombre, host, puerto, Unit ID, habilitación y variables de la conexión. |
| `onEdit` | `() => void` | Solicitar que la vista abra el editor de conexión. |
| `onAdd` | `() => void` | Solicitar que la vista abra una variable nueva para esta conexión. |
| `onVariable` | `(variable: ModbusVariable) => void` | Solicitar el editor de la variable seleccionada. |

La tarjeta no consulta API, no mantiene formularios y no controla autorización. `ModbusView` conserva conexiones, carga, errores, editor y formularios en estado local; reutiliza `useDeviceSnapshotStore` para obtener el primer hogar y refrescar el inventario, sin crear otro store global. Los cambios se guardan mediante `apiFetch`; después se recargan conexiones y snapshot.

## Composición y apariencia

Cada sección tiene nombre accesible igual al nombre de conexión, título de nivel 2, icono Cable decorativo, dirección `host:port`, Unit ID y texto de habilitación. El botón secundario Configurar abre la conexión. Las variables forman una lista dividida por bordes: nombre, área, dirección PDU, tipo y permiso de escritura; cada fila tiene Configurar con nombre accesible específico. La acción Añadir variable permanece al final. Una conexión sin variables muestra una explicación breve.

Se reutilizan superficie de tarjeta, borde semántico, radio de sección y padding (16 px). Texto principal y modal fijan explícitamente `text-card-foreground` para conservar legibilidad en claro/oscuro; metadatos utilizan el token de texto atenuado y el icono utiliza el primario. La tarjeta no añade sombra propia. Nombres y direcciones pueden partirse y los contenedores permiten encogerse.

La vista muestra una columna de conexiones en móvil y tablet estrecha, y dos desde `lg`; separación entre tarjetas (16 px). La cabecera de tarjeta apila contenido en pequeño y distribuye resumen/acciones desde `sm`. Las filas de variables permiten envolver acciones. Formularios usan una columna en pequeño y dos desde `sm`, con errores, toggles y acciones ocupando todo el ancho. El modal compartido tiene máximo `max-w-xl`, cabecera alineada al inicio y contenido desplazable dentro del viewport.

Los botones principales de configuración utilizan tamaño `lg`, con altura mínima (44 px). Los controles compartidos conservan sus medidas actuales: `Input` (40 px de alto) y `ToggleSwitch` por defecto (32 px de alto). Son una limitación de tamaño táctil frente a un objetivo uniforme de 44 px; esta extensión no modifica globalmente dichos controles ni declara que todos los elementos alcanzan ese objetivo.

## Editores y estados

- **Carga inicial:** `ModbusSettingsSkeleton({ label, className? })` envuelve dos `ModbusConnectionCardSkeleton()` y un placeholder de cabecera en `LoadingState`. El skeleton pertenece a esta superficie, no sustituye tarjetas ya cargadas al refrescar.
- **Vacío:** `EmptyState` presenta título y ayuda si no hay conexiones y no existe error. Añadir conexión está deshabilitado cuando no hay hogar.
- **Error de carga:** `AlertBanner` peligro con Reintentar. Si había conexiones, sus datos se conservan mientras se informa el fallo.
- **Edición:** `Modal`, `Input`, `SearchableSelectField`, `ToggleSwitch` y `Button` compartidos. La apertura limpia el error anterior y copia la configuración actual o defaults.
- **Guardado:** envío POST/PUT, botón Guardar con carga y Cancelar deshabilitado; el cierre del editor se ignora mientras `busy`. Fallos muestran un aviso dentro del formulario y conservan el editor. Éxito cierra y refresca.

Conexiones nuevas: deshabilitadas, puerto fijo de solo lectura (502), Unit ID (1), timeout (2000 ms) e intervalo (5000 ms). Los campos indican límites de Unit ID (1–247), timeout (250–10000 ms) e intervalo (1000–60000 ms); el backend mantiene la validación autoritativa.

Variables nuevas: holding register, dirección (0), `uint16`, escala (1), offset (0), orden `high_first` y escritura desactivada. Área coil/discrete input fija tipo boolean; registros ofrecen `uint16`, `int16`, `uint32`, `int32` y `float32`. Cambiar área restablece tipo, escritura, escala y offset. Campos escala/offset/unidad solo aparecen en tipos numéricos y orden de palabras en `uint32`, `int32` y `float32`. Dirección PDU cero-basada: máximo (65535), o (65534) para esos tipos de dos registros. El permiso de escritura solo aparece en coils y exige activación explícita.

La acción Probar lectura de la cabecera abre [ModbusReadProbe](ModbusReadProbe.md). Desde una fila válida se abre este mismo editor con dirección, área y conversión precargadas y `writable=false`; una conexión nueva se guarda deshabilitada y la variable solo se persiste al confirmar Guardar en el editor.

## Accesibilidad e internacionalización

Los iconos de tarjeta y botones se ocultan del árbol accesible. La sección nombrada y la lista permiten navegar cada conexión y variable. Los textos visibles de botones identifican acciones; el botón por variable incorpora su nombre en `aria-label`. No se transmite habilitación o escritura solamente por color.

`Input` vincula etiqueta, campo y ayuda mediante IDs; los campos requeridos y límites numéricos usan semántica nativa. `ToggleSwitch` proporciona `role="switch"`, `aria-checked`, etiqueta y foco visible. `Modal` aporta `role="dialog"`, `aria-modal`, título/descripción relacionados y el comportamiento de foco del overlay compartido. El error de guardado es `role="alert"`.

`LoadingState` anuncia carga con `role="status"`, `aria-live="polite"`, `aria-busy` y etiqueta traducida; sus barras se ocultan a tecnología asistiva. La animación de pulso solo se aplica cuando el usuario permite movimiento. El skeleton de tarjeta aislado es visual: el anuncio accesible lo proporciona su contenedor.

La superficie obtiene copy de `modbus.*` y `common.loading` mediante `react-i18next`. Nombres configurados, host, direcciones y códigos técnicos de tipo son datos, no copy traducido. Las áreas y permisos sí usan traducciones; `modbus.edit_variable` interpola el nombre de variable.

## Frontera de seguridad

La ruta `/system/modbus` y navegación son exclusivas de Admin; esta restricción pertenece a la composición de aplicación, no a la tarjeta. El servidor debe verificar rol y pertenencia al hogar en cada operación. La UI no reemplaza RBAC ni la validación de IP privada RFC1918, puerto, cantidades, tipos o límites de dirección.

Guardar configuración no es una prueba de conexión ni una escritura física; habilitar la conexión inicia polling. Solo una coil con permiso explícito puede recibir comandos existentes desde los flujos de dispositivos. Registros y entradas permanecen de lectura. No hay botón de orden física, eliminación o descubrimiento automático en esta superficie.

Las direcciones se introducen manualmente. No se infiere equivalencia de símbolos Xinje como M100/D100, notación 40001 o firmware. La verificación posterior del mapa y equipo real es un requisito operativo pendiente. Permisos de HomePilot no proporcionan autenticación/cifrado a Modbus TCP ni reemplazan segmentación LAN y seguridades del PLC.

## Evidencia de validación y alcance

La ejecución principal reportó 102 pruebas Jest aprobadas (67 Modbus y 35 de regresión), cinco escenarios responsive focales aprobados, typecheck, build raíz, build de consola, lint, cobertura, límites de arquitectura e i18n aprobados. Esta documentación recoge esa evidencia; el handoff documental no volvió a ejecutar pruebas.

`apps/operator-console/tests/responsive-shell.spec.ts` cubre la configuración focal en móvil (390×844), tablet vertical (768×1024), tablet horizontal (1024×768) y desktop (1440×900): creación deshabilitada, dirección manual, variable de lectura, coil con opt-in, persistencia tras recarga, modal dentro del viewport, acción Guardar visible y ausencia de overflow en claro/oscuro. El quinto escenario verifica que navegación directa de no Admin no solicita configuración ni ofrece la ruta/acción. Las pruebas de API y servicio cubren los límites de permisos y contrato; el componente no los demuestra por sí solo.

No se ejecutaron la matriz responsive completa ni pruebas con PLC real. La evidencia focal no constituye autorización de publicación, validación del mapa físico ni certificación completa de accesibilidad táctil.
