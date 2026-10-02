# Tareas — Modbus TCP local V1

- [x] AC16/AC17: tabla fija/filtros locales, unidades modulares y edición numérica segura; responsive focalizado.
  - Evidencia (2026-10-02): validación conjunta, 324/324 Jest y 21/21 responsive focalizados PASS; typecheck, lint y builds raíz/consola PASS. Tabla en móvil/tablet/escritorio y ambos temas revisada visualmente; filtros conservan el bloque completo para conversión de 32 bits. Sin conexión/escritura a PLC físico, migración SQL adicional, responsive completo, Git ni deploy.

## Perfiles PLC autorizados

- [x] AC11/AC12: resolver genérico versionado y mapa Xinje octal/capacidades físicas.
- [x] AC13: metadatos JSON compatibles y validación backend de resolución.
- [x] AC14: modo perfil modular en probe/editor; discovery readonly y áreas protegidas.
- [x] AC15: pruebas focalizadas, responsive, tipos/lint/build y documentación.

- [x] Alcance, compatibilidad, seguridad y reversión aprobados/documentados.
- [x] AC1/AC6: repositorio SQLite y migración aditiva con inventario transaccional.
- [x] AC2: validación de configuración, autorización Admin/hogar y rutas modulares.
- [x] AC3: cliente TCP con pruebas de PLC simulado y decodificación.
- [x] AC4/AC5: driver compartido, polling, backoff y lifecycle.
- [x] AC7: configuración modular Sistema, traducciones y skeleton específico.
- [x] Validación focalizada, typecheck, lint/build y controles de trazabilidad.
- [ ] Verificar mapa/firmware/puerto del PLC real con autorización separada; fuera de validación simulada.

## Evidencia local — 2026-10-02

### Evidencia de perfiles PLC — 2026-10-02

- Jest focalizado: 8 suites, 238/238 PASS; incluye mapas octales y expansiones, capacidades físicas, resolución y persistencia JSON, protección de escrituras, decoder compartido y cliente TCP en loopback simulado, rutas y regresión de comandos/servidor.
- Responsive focalizado `PLC address profiles|Modbus commissioning|Native Modbus configuration`: 14/14 PASS. Tras el último ajuste se repitió únicamente `PLC address profiles`: 4/4 PASS. Móvil, tablet portrait/landscape y desktop, ambos temas; símbolos, resolución, RAW/conversión, creación y recarga. Sin responsive completo.
- Typecheck, lint de Operator Console, build raíz y build de Operator Console PASS. Spec coverage, BDD, cobertura por módulo, arquitectura, no-production-any, i18n y políticas estáticas Tuya/Docker PASS; no se ejecutó Docker.
- Capturas finales en `.impeccable/review/plc-profiles/`; revisión visual fresca SHIP. Componentes modulares y paleta existente conservados.
- Sin migración SQL adicional, modificación de base real, Git/GitHub, deploy ni conexión/escritura al PLC físico. El mapa corresponde al alcance aprobado; no certifica firmware ni canales físicos. Byte-order dentro de cada registro fijo big-endian; wordOrder high_first/low_first configurable. Modo genérico sin perfil conservado.

### Ampliación puesta en marcha autorizada

- [x] AC8: lectura de bloque acotada, autorización y cancelación, sin efectos persistentes/escrituras.
- [x] AC9: UI Probar lectura/refresco/Detener/tabla/creación desde registro probado.
- [x] AC10: decodificador común uint32/int32, conversión y persistencia compatible.
- [x] Jest y responsive focalizados del asistente, typecheck/lint/builds y trazabilidad.

### Evidencia de puesta en marcha — 2026-10-02

- Jest focalizado: 7 suites, 136/136 PASS (101 Modbus y 35 regresión). Cobertura de conversión común, bloques RAW, permisos, entradas inválidas sin red, cancelación, cola compartida con polling y persistencia de tipos nuevos.
- Responsive focalizado `Modbus commissioning|Native Modbus configuration`: 10/10 PASS en la ejecución final; cuatro tamaños y ambos temas, creación desde lectura real del fixture, persistencia readonly, refresco sin solapar, RAW anterior tras fallo y Detener sin nuevas solicitudes. Sin suite responsive completa.
- Capturas finales de formulario y resultados en `.impeccable/review/modbus-commissioning/`; indicación horizontal persistente vinculada a la región de tabla accesible por teclado.
- Typecheck, lint, build raíz y build de consola PASS. Spec coverage, BDD, cobertura por módulo, arquitectura, no-production-any e i18n PASS. Revisión visual fresca SHIP tras resolver la navegación horizontal de resultados; documentos modulares actualizados.
- Sin migración SQL adicional. Los tipos uint32/int32 requieren convertir configuración o restaurar backup para downgrade al binario anterior. No se validó un PLC físico ni se ejecutaron Git/GitHub, Docker o deploy.

- Jest focalizado: 6 suites, 102/102 PASS (67 Modbus y 35 regresión de comandos/servidor). Cliente TCP únicamente en loopback simulado; SQLite temporal aislada.
- Responsive `Native Modbus configuration`: 5/5 PASS, móvil, tablet portrait/landscape, desktop, claro/oscuro y navegación no-Admin. Guardar completamente visible después del scroll interno del formulario móvil. Capturas asentadas en `.impeccable/review/modbus-v1/`.
- Typecheck, lint de Operator Console, build raíz y build de Operator Console PASS; spec coverage, BDD, cobertura por módulo, i18n, límites de arquitectura y no-production-any PASS.
- No Jest completo, responsive completo, Docker, Git/GitHub ni deploy. Sin conexión ni comandos al PLC físico. Warnings no bloqueantes: Browserslist desactualizado y tamaño de chunks existentes; WebSocket de realtime sin servidor en fixtures responsive.
- Revisión visual fresca: SHIP para la UI Modbus, tras corregir contraste heredado y repetir capturas asentadas; no equivale a aprobación de release/hardware. Documento modular `docs/components/ModbusConnectionCard.md`. La altura táctil heredada de Input/Toggle no se rediseñó globalmente.
- Antes de instalar en MiniPC: backup SQLite, verificar mapa/firmware/puerto y aislamiento LAN, reconstruir API + UI. No se certifica hardware a partir del simulador.
