# Cierre local PLC I/O — 2026-10-03

Proyecto trabajado: `C:\Users\ocuen\Developer\Nezu\homepilot-main-integration`. Extensión aprobada de la integración existente; no reescritura. Contratos: `modbus-tcp-local-integration-v1` AC19–AC27 y `automation-rules-engine-v1` ampliación de comparaciones PLC. Sin Git/GitHub, Docker, deploy ni conexiones/escrituras al PLC físico.

## 1. Archivos de este cierre

Inventario de las piezas editadas durante este alcance, no auditoría del working tree ni lista de todos los cambios históricos. No se utilizó Git para reconstruir diferencias.

### Nuevos

- `packages/integrations/modbus/domain/PlcBinding.ts`
- `packages/integrations/modbus/domain/ModbusEncoder.ts`
- `packages/integrations/modbus/__tests__/PlcBinding.test.ts`
- `packages/devices/domain/automation/stateComparison.ts`
- `packages/devices/__tests__/automation/stateComparison.test.ts`
- `apps/operator-console/src/components/PlcBindingEditor.tsx`
- `apps/operator-console/src/components/PlcBindingEditor.test.tsx`
- `apps/operator-console/src/components/PlcCommandDialog.tsx`
- `docs/components/PlcBindingEditor.md`
- `docs/components/PlcCommandDialog.md`
- Este informe.

### Modificados

- `packages/integrations/modbus/domain/Modbus.ts`
- `packages/integrations/modbus/domain/ModbusAddressProfile.ts`
- `packages/integrations/modbus/application/ModbusPorts.ts`
- `packages/integrations/modbus/application/ModbusService.ts`
- `packages/integrations/modbus/infrastructure/ModbusTcpClient.ts`
- `packages/integrations/modbus/__tests__/ModbusService.test.ts`
- `packages/integrations/modbus/__tests__/ModbusTcpClient.test.ts`
- `packages/devices/domain/commands.ts`
- `packages/devices/domain/CapabilityResolver.ts`
- `packages/devices/domain/CommandCapabilityValidator.ts`
- `packages/devices/__tests__/CommandCapabilityValidator.test.ts`
- `packages/devices/domain/automation/types.ts`
- `packages/devices/domain/automation/createAutomationRule.ts`
- `packages/devices/domain/automation/updateAutomationRule.ts`
- `packages/automation/application/AutomationEngine.ts`
- `packages/automation/__tests__/AutomationEngine.test.ts`
- `__tests__/buildAutomationModule.test.ts`
- `apps/api/routes/DeviceRoutes.ts`
- `apps/api/__tests__/ModbusRoutes.test.ts`
- `apps/api/__tests__/DeviceRoutes.state-sync.test.ts`
- `apps/operator-console/src/components/ModbusConnectionCard.tsx`
- `apps/operator-console/src/components/AutomationBuilderTypes.ts`
- `apps/operator-console/src/components/AutomationBuilderTriggerSection.tsx`
- `apps/operator-console/src/views/ModbusView.tsx`
- `apps/operator-console/src/views/AutomationBuilderModal.tsx`
- `apps/operator-console/src/locales/en/common.json`
- `apps/operator-console/src/locales/es/common.json`
- `apps/operator-console/tests/responsive-shell.spec.ts`
- `specs/modbus-tcp-local-integration-v1.md`
- `specs/modbus-tcp-local-integration-v1.tasks.md`
- `specs/automation-rules-engine-v1.md`
- `specs/automation-rules-engine-v1.tasks.md`
- `docs/spec-coverage-matrix.md`
- `docs/components/ModbusConnectionCard.md`

`ModbusRoutes.ts`, `SQLiteModbusRepository`, `ModbusReadProbe`, el mapa Xinje V1 y los widgets Dashboard se reutilizan; no se crea otro inventario/dispatcher/polling/store ni una API PLC paralela.

## 2. Arquitectura y persistencia

`Device → dispatcher/DeviceCommandService → ModbusService → cliente TCP genérico`. La semántica PLC se valida en dominio/perfil, no en el transporte.

`ModbusVariable.plc?` conserva rol, command/physical/feedback/logical, política/timeout de feedback, modo/duración de pulso y límites min/max. Cada binding guarda perfil/símbolo/área/PDU resueltos y revalidados en backend. Se guarda en el JSON existente de `modbus_variables`; no SQL nuevo. Histórico sin `plc` mantiene el comportamiento anterior. Diagnósticos y confirmaciones de comando son efímeros.

Roles: input/output/output_command/output_feedback/measurement/setpoint/diagnostic. Se conservan Device sensor/binary_sensor/switch y su asignación a Room. Nunca se infiere M100→Y0→M200.

## 3. API y UI

Las rutas Modbus existentes aceptan los campos opcionales validados y el listado añade diagnósticos. Administración exige autenticación, Admin y hogar; el guard Admin ya estaba presente y ahora se demuestra con AuthGuard real. Los comandos físicos siguen `POST /api/v1/devices/:id/command`, con autorización común.

Editor modular de bindings, asignación de estancia, agrupación PLC I/O, diagnóstico técnico desplegable y diálogo de escritura explícita. Input/NumberInput/Modal/SearchableSelectField/Alert y paleta existentes se conservan. Skeleton propio; refresh conserva datos. Estado solicitado y estado real permanecen etiquetados por separado durante pending/unconfirmed. Read Probe sigue exclusivamente readonly.

## 4. Flujos

Comando: autorización/capacidades → cola compartida → validar binding/writable → publicar pending sin cambiar lectura real → FC05/FC06/FC16 → lectura/confirmación → state sync y registro común.

Feedback required: lectura independiente limitada por timeout, sin repetir escritura; discrepancia termina unconfirmed/FEEDBACK_TIMEOUT. Optional lee feedback sin espera de confirmación. Sin feedback se conserva lectura histórica. Polling posterior detecta cambios reales y puede confirmar; no usa el comando como valor optimista permanente.

State sync: polling existente → decoder compartido → publishState/syncDeviceStateUseCase → DeviceStateUpdatedEvent → AutomationEngine/WebSocket → widgets existentes. Excepciones Modbus/mapping/conversión por variable no invalidan las demás; fallos reales de conexión disparan unavailable/backoff común.

## 5. Escritura y seguridad

Encoder inverso `(engineering-offset)/scale`, uint16/int16/uint32/int32/float32, bytes big-endian y wordOrder configurable; valida finitud, escala no cero, rango, overflow y fracción de enteros. FC06 una palabra; FC16 dos palabras; echo validado, sin reintento automático.

XinJe V1 inmutable. V2 habilita únicamente D/HD para setpoint explícito con min/max y writable opt-in; no convierte segmentos protegidos ni variables genéricas de registro en escribibles. X readonly; pulsos sobre Y rechazados. Pulse 100–5000 ms: ON → duración → un intento OFF; ante ON ambiguo también intenta OFF, reset fallido visible. Esto no reemplaza watchdog/Ladder/interlocks del PLC.

## 6. Validación comprobada

- Jest focalizado final: **30 suites, 556/556 PASS**, salida 0. Incluye Modbus, API, comandos, automation, SceneExecutionService, Assistant, Sonoff y OperatorConsoleServer. TCP loopback simulado y SQLite temporal. No suite Jest completa.
- Responsive focalizado: **22/22 PASS** para PLC I/O/perfiles/probe/configuración/eliminación/tabla. Tras el fix visual, solo PLC I/O **4/4 PASS**, incluidos solicitado ON frente a actual OFF, límites, autorización, guardado/recarga, cuatro tamaños y dos temas. No responsive completo.
- Typecheck raíz/consola, lint consola, build raíz y build consola: **PASS**.
- Spec coverage (963 fuentes), BDD (23 flujos), módulos (10), i18n (1981 claves después del fix), architecture boundaries, no-production-any, políticas estáticas Tuya/Docker: comprobaciones locales. El check de perfiles Docker no ejecuta Docker.
- Detector UI una vez: `[]`. Revisión fresca del listado/editor en 16 capturas; P2 solicitado/real corregido y verdict pass **ship** para ese fix sobre ocho capturas actualizadas del listado. La skill impeccable guio revisión limitada, responsive y documentación modular; no rediseñó la identidad.
- Warning Jest de salida tardía, pero termina con código 0; Browserslist antiguo, chunks existentes grandes y WebSocket ausente en fixture no son fallos funcionales. `test.api.db` generado por la suite y cerrado fue eliminado; no se tocó ninguna base real.

## 7. Cobertura y límites operativos

Casos: persistencia/reapertura de binding; X0 OFF→ON→OFF; comando ON con feedback OFF; optional/required/timeout; reset fallido y ON ambiguo; cinco tipos/wordOrder/escala/offset; límites antes de red; roles reales y hogar; aislamiento de conversión/excepción; state sync real en SQLite/EventBus; motor ensamblado usa estado real y no commandedState. No se midió porcentaje global de líneas ni se declara cobertura completa de producto.

No se añaden precondiciones a Scenes: inputs son estado/triggers/condiciones de Automatizaciones, no acciones ejecutables de Escena. El constructor de Automatizaciones conserva acciones de comando existentes, sin añadir parámetros setpoint a ese contrato. Assistant usa el inventario/dispatcher común; no se certifica comprensión de lenguaje natural para todos los roles PLC.

Verificación física de firmware/mapa/expansiones/Ladder/watchdog sigue pendiente y requiere autorización separada. Modbus TCP no aporta autenticación/cifrado; requiere LAN segmentada. Un proceso/host que muere durante pulse no garantiza OFF. Diagnóstico sin historial persistente de latencia. No optimización de agrupación de lecturas ni TCP persistente nueva.

Antes de instalar: backup SQLite/configuración, desactivar escrituras para downgrade y restaurar backup o convertir/eliminar bindings V2 incompatibles antes de volver al binario anterior; nunca confiar en que el binario viejo interprete políticas nuevas. Reconstruir API y UI, con validación de release separada. Ningún despliegue ejecutado.

## 8. Matriz de capacidades

| Capacidad | Antes | Después |
| --- | --- | --- |
| Modbus TCP | Existente | Reutilizado; FC06/FC16 añadidos |
| Xinje profile | Existente | V1 conservado; V2 D/HD limitado |
| Read Probe | Existente | Reutilizado, readonly |
| PLC Input | Parcial | Rol/binding físico/lógico explícito |
| PLC Output | Parcial | Comando/físico/feedback separados |
| Command binding | No | Persistente y validado |
| Feedback binding | No | Independiente, optional/required |
| Pulse | No | Acotado, OFF cleanup, sin retry |
| Holding register write | No | FC06/FC16 + encoder inverso |
| Setpoint | No | D/HD V2, límites, autorización |
| RBAC Admin backend | Parcial | Guard real comprobado + hogar |
| PLC diagnostics | Parcial | Estado/RAW/latencia/error por variable |
| E2E command→feedback | No | PASS con TCP/SQLite simulados |
