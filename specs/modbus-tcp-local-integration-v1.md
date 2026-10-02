# Integración Modbus TCP local V1

**Estado:** Aprobado

## Alcance aprobado

Integración Edge nativa, sin Home Assistant ni cloud. Configuración exclusiva de Admin con pertenencia al hogar validada. La UI amplía Sistema con la misma paleta, campos, selector y modal existentes; no modifica Dashboard ni sus componentes Sensor/Button. Seguimiento local autorizado expresamente; sin GitHub, Git, Docker ni deploy.

Conexiones nuevas deshabilitadas y variables de solo lectura por defecto. Activar una conexión inicia polling; guardar no prueba ni modifica un PLC. El desarrollo solo utiliza servidores TCP simulados en loopback. El mapa Xinje, firmware y puerto del equipo real siguen pendientes de verificar; no se infiere ninguna equivalencia M/D/X/Y.

## Contrato y seguridad

- IPv4 privada RFC1918 literal, puerto TCP 502; sin DNS, loopback, direcciones públicas o multicast en configuración de producción.
- Unit ID 1–247, timeout 250–10000 ms, intervalo 1000–60000 ms. Máximo 16 conexiones por hogar y 128 variables por conexión.
- Dirección PDU cero-basada 0–65535, introducida explícitamente; no aceptar notación 40001 ni convertir símbolos de fabricante.
- Lecturas FC01 coils, FC02 discrete inputs, FC03 holding registers y FC04 input registers. Tipos boolean, uint16, int16, uint32, int32 y float32; orden de palabras alto/bajo configurable para tipos de 32 bits, escala y offset finitos.
- V1 permite escritura FC05 únicamente sobre coils explícitamente habilitadas, mediante los comandos existentes turn_on/turn_off/toggle de Button/switch. Registros permanecen de lectura; no se inventa un comando genérico ni pulsos con reset inseguro. Las seguridades y enclavamientos permanecen en el PLC.
- Tramas limitadas, transaction/unit/protocol/function/byte-count/echo validados, timeout absoluto y socket cerrado siempre. No reintentar escrituras: un timeout no demuestra que el PLC no recibió la orden.
- Modbus TCP clásico no aporta autenticación ni cifrado. Usar solo LAN confiable/segmentada y firewall, sin exposición a Internet; los permisos HomePilot no reemplazan el aislamiento de la red PLC.
- Operaciones serializadas por conexión; polling no solapa comandos. Cada intento abre nueva conexión; backoff de lectura acotado a 60 s. Error conserva último valor pero marca state unavailable y stale; no presentar una lectura antigua como actual.
- Variables se incorporan al inventario como PENDING, sin estancia. Asignación y selección de widgets siguen el flujo existente; fuente modbus-tcp, switch solo para coils escribibles, sensor para lectura. Cambiar permisos actualiza esa capacidad; el driver vuelve a verificar permiso, hogar y habilitación antes de transmitir.
- API /api/v1/modbus/connections y /:id/variables: listado, creación y actualización Admin; no endpoint de escritura fuera del dispatcher existente. Deshabilitar no borra dispositivos ni referencias. Eliminación de conexiones/variables queda fuera de V1 para no romper escenas, automatizaciones o bindings.

## Persistencia y reversión

Migración aditiva 035: tablas modbus_connections y modbus_variables con referencias al hogar y dispositivo. Configuraciones existentes no se migran ni alteran. Crear variable y dispositivo es transaccional. Antes de cualquier instalación en MiniPC hacer backup de SQLite. Para revertir, deshabilitar conexiones y regresar al binario anterior conservando tablas; no borrar dispositivos automáticamente. API y UI deberán reconstruirse posteriormente, sin desplegar durante esta tarea.

## Criterios de aceptación

- AC1: guardar y cargar configuración conserva mapa explícito; nuevas conexiones y escrituras desactivadas.
- AC2: no Admin ni hogar ajeno pueden leer/configurar; entradas inválidas no contactan red.
- AC3: las cuatro áreas se leen, escala/orden se respetan; protocolo malformado, excepción, cierre y timeout fallan explícitamente sin recursos abiertos.
- AC4: solo coil habilitada admite comandos existentes; entradas/registros/sensores no escriben; no hay retry de escritura.
- AC5: polling serial, reconexión/backoff y lectura stale preservan dato sin fingir disponibilidad; start/stop no dejan timers activos.
- AC6: variables alimentan inventario/snapshot/eventos existentes y conservan estancia al editar.
- AC7: UI Admin, estado inicial con skeleton propio, configuración compacta y accesible en desktop/tablet/mobile, claro/oscuro; sin controles físicos en configuración.

## Ampliación aprobada — asistente de puesta en marcha

- AC8: Admin puede ejecutar POST `/api/v1/modbus/probe` con hogar, IPv4 privada, Unit ID, área y rango PDU inclusivo. Solo FC01–04; nunca activar polling, guardar datos ni escribir durante la prueba. Máximo 64 direcciones por lectura, timeout 250–5000 ms, una prueba activa por hogar; no barrido automático de redes ni CLI. Lectura de bloque: una excepción afecta al bloque completo, no demuestra qué dirección falló. Tabla con RAW por dirección (palabra uint16 o bit), tipo seleccionado, valor convertido, estado, error y tiempo del bloque compartido por filas.
- AC9: refresco manual o periódico 1–60 s, sin solapamientos; Detener/cerrar cancela solicitud y futuras lecturas. Resultados se conservan marcados anteriores ante errores. Crear variable desde una fila válida abre el editor normal con dirección, área y conversión, siempre writable=false; conexión nueva se guarda deshabilitada solo por confirmación. No escribir ni inferir símbolos de fabricante.
- AC10: conversión compartida backend/frontend: uint16, int16, uint32, int32 y float32; 32 bits ocupan dos palabras consecutivas y requieren la siguiente dirección leída. Orden high_first/low_first, escala/offset/unidad y preview; ausencia/NaN muestran error, no valor ficticio. Tipos históricos se conservan y no hay migración SQL nueva. El JSON admite tipos nuevos; para volver al binario V1 previo, cambiar variables uint32/int32 a un tipo admitido o restaurar backup antes del downgrade. No convertir configuraciones históricas automáticamente.
- Desarrollo/pruebas solo con PLC simulado. Configuración y pruebas de lectura usan los mismos límites de red y permisos; seguridad física y aislamiento LAN siguen siendo responsabilidad del instalador.

## Referencias

Contrato de tramas y funciones: [Modbus Organization — especificaciones oficiales](https://www.modbus.org/modbus-specifications). No se afirma que se haya validado el mapa del Xinje real.
