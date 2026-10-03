# UI PLC / Modbus — cierre local

Proyecto: `C:\Users\ocuen\Developer\Nezu\homepilot-main-integration`. Alcance autorizado: `modbus-tcp-local-integration-v1` AC28–AC32. Extensión de la integración existente, conservando HomePilot y su paleta; no SCADA ni inventario paralelo. Trazabilidad local por excepción expresa. Sin Git/GitHub, Docker, deploy, cambios Ladder ni PLC físico.

## Archivos de esta fase

Nuevos:
- `apps/operator-console/src/lib/plcUi.ts`
- `apps/operator-console/src/lib/__tests__/plcUi.test.ts`
- Este informe.

Modificados:
- `packages/integrations/modbus/domain/Modbus.ts`
- `packages/integrations/modbus/application/ModbusService.ts`
- `packages/integrations/modbus/__tests__/ModbusService.test.ts`
- `apps/operator-console/src/views/ModbusView.tsx`
- `apps/operator-console/src/components/ModbusConnectionCard.tsx`
- `apps/operator-console/src/components/ModbusAddressFields.tsx`
- `apps/operator-console/src/components/PlcCommandDialog.tsx`
- `apps/operator-console/src/components/PlcBindingEditor.test.tsx`
- `apps/operator-console/src/views/dashboards/widgets/SensorMetricCard.tsx`
- `apps/operator-console/src/views/dashboards/widgets/SensorMetricCard.test.tsx`
- `apps/operator-console/src/locales/en/common.json`
- `apps/operator-console/src/locales/es/common.json`
- `apps/operator-console/tests/responsive-shell.spec.ts`
- `specs/modbus-tcp-local-integration-v1.md`
- `specs/modbus-tcp-local-integration-v1.tasks.md`
- `docs/spec-coverage-matrix.md`
- `docs/components/ModbusConnectionCard.md`
- `docs/components/ModbusAddressFields.md`
- `docs/components/PlcCommandDialog.md`
- `docs/components/SensorMetricCard.md`

Lista del alcance de esta fase, no auditoría de todo el working tree. No se utilizó Git.

## Pantallas y reutilización

Sistema → Modbus TCP: conexión, grupos PLC I/O, edición de variables y autorización de comandos/setpoints. El editor prioriza símbolo y rol, con dirección/conversión técnicas en disclosures cerrados. No se cambian los controles ni el flujo readonly de Read Probe.

Se conservan ModbusView/ConnectionCard/ReadProbe/AddressFields, PlcBindingEditor/CommandDialog, Device, repositorio JSON, resolver versionado, codec, dispatcher, state sync, Rooms y consumidores existentes. UI: Modal, SearchableSelectField, NumberInput, Input, ToggleSwitch, Button, AlertBanner, LoadingState, EmptyState y skeleton propio. Mediciones: SensorMetricCard y sus visualizadores reales, sin otro sistema de sensores.

## Flujos

1. Conexión: IP privada, Unit ID, perfil y lectura opt-in. Habilitada no equivale a conectada. Diagnóstico diferencia conexión, desconexión, backoff/reconexión y error. Conserva última comunicación válida; muestra latencia, variables OK/con error y errores sanitizados.
2. Input: símbolo X0, binding físico/lógico explícito, estancia, solo lectura. Sin controles de escritura.
3. Output: comando M100, físico Y0 y feedback M200 separados. Sin feedback: No configurado. Momentáneo muestra duración y acción Activar; límites/seguridad permanecen en backend.
4. Feedback: solicitado y real independientes; pending/unconfirmed no convierten el comando en confirmación física. El listado y diálogo leen diagnóstico/state sync existentes.
5. Measurement: tipo/escala/offset/word order, unidad del selector común y visualización Auto/Circular/Termómetro/Nivel/Batería. Preview solo usa lectura del mapping guardado; cambios de dirección/tipo/escala/offset no inventan valor.
6. Setpoint: actual, unidad, min/max y valor objetivo, resumen de escritura y confirmación explícita. Fuera de rango no se envía. Error traducido conserva diálogo/valor; otro envío requiere nueva acción explícita.
7. Room: asignación por endpoint común. Tras mutar se fuerza el refresco existente para que reabrir no muestre una asignación antigua debido a la caché de snapshot. Refresh de resúmenes se serializa; no se añade polling del PLC.

## Persistencia y compatibilidad

Campo opcional `ModbusVariable.visualStyle` en el JSON existente: `auto | gauge | thermometer | level | battery`. Validación backend; rechazado en booleanos. `null` permite limpiar explícitamente al pasar de medición a bit. Sin migración SQL, reescritura masiva ni cambios a variables históricas.

State sync publica `plcVisualStyle`. SensorMetricCard lo hereda solo para fuente `modbus-tcp` y solo cuando la tarjeta no tiene override propio. Home Assistant ignora esa metadata y conserva el comportamiento anterior.

`retryAt` expone el schedule/backoff existente únicamente como diagnóstico efímero; no es un motor ni historial nuevo.

## Consumidores y permisos

Dashboard: widget Sensor existente hereda la preferencia; botones/bindings existentes se mantienen.
Automations: entidades/triggers/comparaciones y comandos existentes. No se añade acción parametrizada de setpoint: falta contrato de parámetros en ese editor/modelo.
Scenes: salidas como acciones existentes. No se añaden condiciones de entrada: el modelo de Scene no ofrece precondiciones.
Assistant: inventario, resolución y dispatcher comunes; sin sintaxis Xinje nueva ni certificación lingüística universal para roles PLC.

Admin/hogar se validan en backend existente. Configuración no-Admin sigue bloqueada; consumidores usan autorización común. No se modifica RBAC ni se habilitan escrituras por defecto.

## Evidencia de validación

- Jest focalizado final: **611/611 PASS, 30 suites**, salida 0. Modbus/API/estado/comandos/Scenes/Automation/Assistant/Sonoff/UI; TCP loopback simulado y SQLite temporal. Tras el último ajuste también se confirmaron por separado las tres suites UI: 80/80 PASS. No Jest completo.
- Typecheck, lint de consola, build raíz y build de consola: PASS.
- Spec coverage: 965 fuentes, 30 specs; BDD: 23 flujos; módulos: 10; i18n: 2018 claves. Arquitectura, no-production-any y políticas estáticas Tuya/Docker: PASS. El check Docker no ejecuta Docker.
- Detector UI una vez sobre los cuatro componentes/vista modificados: `[]`.
- Responsive focalizado: **18/18 PASS** (PLC I/O, perfiles, probe y configuración), más confirmación final PLC I/O **4/4 PASS** tras las correcciones de revisión. Móvil, tablet vertical/horizontal y desktop, claro/oscuro; teclado mediante visualViewport simulado. No responsive completo.
- Capturas finales: `.impeccable/review/plc-ui-confirmation/`. Las recapturas intermedias corrigieron solo la posición de scroll al tomar evidencia, sin relajar expectativas de geometría ni cambiar producción por recortes de screenshots.
- La revisión independiente detectó y se corrigieron dos defectos materiales: disponibilidad incoherente entre texto/visualizador ante conexión `error`, y contraste de mensajes PLC. Se comparte el predicado de disponibilidad en listado/preview; AlertBanner conserva sus tokens e iconos, con texto foreground y opacidad completa únicamente en las superficies PLC.
- Handoff fresco de confirmación: **ship** para el alcance local revisado AC28–AC32; ambos hallazgos materiales resueltos. No equivale a certificación de release o hardware.

Los primeros fallos de ampliación responsive fueron locators de pruebas (warning/error con igual rol, labels EN/ES y scope de helper). La cobertura de Room identificó un fallo real de refresco inmediato, corregido sin relajar expectativas. Se mantienen controles accesibles, scroll interno y adaptación al visual viewport.

## Límites y operación

No se ejecutaron suites completas ni se certifica Safari/tablet física, firmware, mapa instalado, Ladder, watchdog o estados del PLC real. El teclado se simula reduciendo visualViewport; no es una sesión de hardware táctil.

No hay historian de latencias ni nuevas condiciones de Scene/acciones parametrizadas de Automatización. Se conserva la semántica y seguridad de pulse: caída de proceso/red no garantiza OFF sin watchdog del PLC.

Antes de instalar en MiniPC: backup SQLite/configuración, revisar compatibilidad de bindings/perfil v2 para downgrade y reconstruir API + UI. Esta fase no aprueba release ni deploy.

Warnings de tooling: Browserslist antiguo y chunks existentes grandes. Fixtures sin servidor realtime producen warnings WebSocket; recarga/navegación puede cancelar refresh de snapshots. No equivalen a validar conectividad del PLC.
