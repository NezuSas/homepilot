# ModbusReadProbe

Referencia local del asistente de puesta en marcha de Sistema → Modbus TCP. Implementación: `apps/operator-console/src/components/ModbusReadProbe.tsx`; composición y editor: `apps/operator-console/src/views/ModbusView.tsx`; lectura: `packages/integrations/modbus/application/ModbusService.ts`. Contrato aprobado: [Integración Modbus TCP local V1](../../specs/modbus-tcp-local-integration-v1.md), AC8, AC9 y AC10. La configuración persistida se documenta en [ModbusConnectionCard](ModbusConnectionCard.md).

## Propósito y límites

Modo **Operate**: el instalador introduce un destino y rango explícitos, compara RAW y conversión y prepara una variable a partir de una fila válida. La prueba utiliza únicamente FC01–04; no escribe, activa polling ni guarda lecturas. No descubre redes ni infiere equivalencias de símbolos Xinje, M/D/X/Y, notación 40001 o firmware.

La extensión conserva la identidad de HomePilot: `index.css` y controles compartidos proporcionan los tokens y estados de ambos temas. Este documento describe la superficie local; no inicializa contexto de producto ni un sistema visual global.

## Contrato del componente

| Prop | Tipo | Responsabilidad |
| --- | --- | --- |
| `homeId` | `string` | Hogar de la prueba y de la configuración posterior. |
| `initial` | `ModbusConnection?` | Precargar host y Unit ID; aportar nombre al preparar conexión. La vista actual abre sin este valor. |
| `onClose` | `() => void` | Cerrar después de detener la lectura. |
| `onCreate` | `(selection: ModbusProbeSelection) => Promise<void>` | Preparar conexión y abrir el editor normal de variable; no guardar la variable automáticamente. |

`ModbusProbeSelection` contiene conexión sin `id/homeId` y variable sin `deviceId/connectionId`. La prueba, el resultado y la conversión viven en estado local; no hay store global nuevo. `apiFetch` envía POST `/api/v1/modbus/probe` con `homeId`, `host`, `unitId`, `area`, `start`, `end` y `timeoutMs`, asociado a un `AbortController`.

## Entradas y ciclo de lectura

Host es una IPv4 privada literal RFC1918, puerto fijo (502) y Unit ID (1–247). Áreas: coil, discrete input, holding register e input register. Dirección PDU cero-basada (0–65535), rango inclusivo de hasta 64 direcciones y timeout (250–5000 ms). Defaults: Unit ID (1), holding register, rango (100–120), timeout (2000 ms) y refresco manual. El servidor valida permisos y límites antes de contactar red; los atributos nativos del formulario no sustituyen esa validación.

Refresco ofrece manual o intervalos (1, 5, 10, 30 y 60 s). Cada nueva lectura se programa después de terminar la anterior y esperar el intervalo seleccionado; no es una frecuencia fija desde el inicio de la solicitud. Mientras está activo se bloquean destino, rango y refresco, y se anuncia leyendo o esperando. Detener cancela la solicitud activa y evita lecturas futuras; cerrar y desmontar también abortan y limpian el temporizador. El cierre se ignora durante la preparación de variable.

El servicio permite una prueba activa por hogar y serializa con la conexión existente si coinciden host y Unit ID. La prueba no depende de habilitar esa conexión ni modifica su configuración.

## Resultados, errores y conversión

La tabla muestra dirección PDU, RAW, tipo seleccionado, valor convertido, estado, tiempo de respuesta, error y Crear variable. RAW es un bit booleano o palabra `uint16` sin escala. El timestamp identifica la muestra y el estado se comunica mediante texto.

Se realiza una lectura de bloque: el tiempo mostrado en las filas pertenece a la operación del bloque. Una excepción Modbus afecta a todo el bloque; su código no identifica una dirección culpable. Se presentan errores de timeout, conexión, protocolo o excepción sin inventar valores. Ante error posterior se conserva el RAW anterior por dirección, marcado como anterior, con estado fallido y conversión no disponible. Un fallo de solicitud conserva las filas previas con error de conexión y tiempo desconocido. Cambiar destino o rango limpia el resultado.

Frontend y transporte usan el mismo `convertModbusValue` de dominio. Registros ofrecen `uint16`, `int16`, `uint32`, `int32` y `float32`; bits fijan `boolean`, escala (1), offset (0) y unidad vacía. `int16` interpreta complemento a dos. Tipos de 32 bits requieren dos palabras consecutivas con lectura válida y orden `high_first` o `low_first`; la última fila del rango no puede convertirse sola. El cálculo numérico es `valor decodificado × escala + offset`; escala debe ser finita y distinta de cero y offset finito. Unidad admite hasta 24 caracteres. Un dato ausente, palabra inválida o resultado no finito muestra raya y error de conversión y deshabilita crear variable. El preview formatea hasta seis decimales sin modificar RAW.

## Preparar una variable

Crear variable detiene la prueba y prepara una selección con dirección, área, tipo, orden, escala, offset y unidad, siempre `writable=false`. `ModbusView` reutiliza una conexión con el mismo host y Unit ID; si no existe, la acción crea una conexión deshabilitada con puerto (502), timeout de la prueba e intervalo de polling (5000 ms). La acción es la confirmación de esa creación. Cierra el asistente y abre el [editor normal](ModbusConnectionCard.md) para revisar y guardar la variable. Cancelar ese editor no borra una conexión que ya se creó. Una conexión reutilizada conserva su estado de habilitación.

El nombre propuesto usa área y dirección. La variable solo se persiste al pulsar Guardar en el editor; inventario, estancia y widgets siguen los flujos existentes. La prueba no habilita escritura física; el editor normal conserva el opt-in independiente para coils.

## Composición, accesibilidad e internacionalización

`Modal`, `Input`, `SearchableSelectField`, `Button`, `AlertBanner` y `LoadingState` compartidos mantienen comportamiento y foco. El modal utiliza ancho máximo `max-w-5xl` y texto de tarjeta explícito. Campos se apilan en móvil, pasan a dos columnas desde `sm` y a cuatro desde `lg`; conversión utiliza hasta cinco desde `lg`. Acciones envuelven y el overflow se limita a la tabla, con altura máxima (20 rem), cabecera fija, bordes semánticos y números tabulares. Superficies, texto, errores y foco heredan tokens de claro/oscuro sin paleta nueva. Botones `lg` conservan altura mínima (44 px); los inputs compartidos mantienen (40 px), por lo que no se declara objetivo táctil uniforme de 44 px.

La tabla tiene caption accesible, encabezados de columna y dirección como encabezado de fila. Su contenedor es una región nombrada, enfocable con `tabIndex=0` para desplazamiento por teclado. Una ayuda visible y traducida explica el desplazamiento horizontal; `aria-describedby` la relaciona mediante `useId`. Estado de lectura usa `role="status"`; fallos usan `role="alert"`. Campos conservan etiqueta y límites nativos del control compartido.

`ModbusProbeTableSkeleton` tiene una cabecera y tres filas visuales y se oculta del árbol accesible; `LoadingState` aporta anuncio de carga. Solo aparece al leer sin resultados: refrescar conserva la tabla anterior. Las barras compartidas respetan preferencia de movimiento. Copy y errores proceden de `modbus.*`; host, direcciones, RAW y códigos de tipo son datos técnicos. Excepciones interpolan código y la muestra utiliza hora local.

## Seguridad, compatibilidad y evidencia

Ruta y API son exclusivas de Admin; backend verifica pertenencia al hogar. No se aceptan DNS, loopback, IP pública ni multicast en configuración de producción. Las pruebas de desarrollo usan simuladores TCP; los permisos HomePilot no aportan autenticación/cifrado a Modbus TCP ni sustituyen segmentación LAN, firewall o enclavamientos del PLC.

No hay migración SQL nueva para esta ampliación. Tipos históricos se conservan; JSON admite `uint32/int32`. Antes de volver al binario V1 anterior, convertir explícitamente esas variables a un tipo admitido o restaurar backup. No hay conversión automática de configuraciones históricas.

La ejecución principal reportó 136 pruebas Jest focales aprobadas en siete suites (101 Modbus y 35 de regresión), además de typecheck, lint y ambos builds aprobados. La repetición final de diez escenarios responsive focales pasó después del ajuste de ayuda de desplazamiento; revisión visual fresca SHIP sobre capturas finales. El alcance cubre móvil (390×844), tablet vertical (768×1024), tablet horizontal (1024×768) y desktop (1440×900), ambos temas, RAW/conversión, apertura del editor y conservación tras error con Detener. Los controles de spec coverage, BDD, cobertura por módulo e i18n también pasaron. Esta documentación registra resultados de la ejecución principal, no pruebas adicionales.

No se validaron PLC físico, mapa Xinje, suites completas ni despliegue. La evidencia focal no constituye autorización de publicación ni certificación completa de accesibilidad.
