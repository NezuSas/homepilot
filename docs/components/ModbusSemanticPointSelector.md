# Selector semántico PLC — AC42 / Fase B

Contrato: [Modbus TCP local](../../specs/modbus-tcp-local-integration-v1.md), AC41–AC42. Modo Operate: crear una variable mediante su uso y un punto compatible, sin exigir conocimiento del símbolo o PDU. Conserva primitivas, paleta y temas del proyecto.

## Componentes y flujo

`ModbusVariablePointEditor` coordina Uso → Perfil → Punto → Relaciones. `ModbusSemanticPointSelector` recibe perfil, rol, clasificación opcional, dirección, capacidades y callback. `ModbusSemanticAddressField` combina el selector con revisión técnica opcional. `modbusSemanticDraft` transforma exclusivamente el borrador local ante acciones explícitas.

Familias y roles vienen de `semantics`; módulos, radix, permisos y canales provienen de los segmentos. `profileChannel()` llama al único `format()`/`resolve()` del perfil. No hay parser alternativo ni reglas de prefijos Xinje en el selector. El resumen readonly muestra símbolo, clasificación, módulo cuando exista, área/PDU, FC de lectura y radix. Un registro sin módulo declarado no recibe un CPU ficticio.

| Uso | Selección y relaciones |
| --- | --- |
| Entrada | Entrada física; fuente lógica opcional explícita. «Valor mostrado desde» refleja la fuente que utiliza el servicio existente. |
| Salida | Salida física separada del punto de orden; feedback independiente y política conservada. |
| Comando PLC | Punto de orden, salidas relacionadas declarativas y feedback independiente. |
| Medición | Registro compatible; tipo/conversión/unidad y visualización del formulario existente. |
| Setpoint | Segmentos compatibles con rol y soporte de setpoint; permiso explícito existente. |
| Feedback / Diagnóstico | Mismo selector filtrado por metadata del rol; feedback es una señal independiente. |

El modo avanzado conserva controles técnicos y capacidad por módulo. Crear una variable nueva aplica validación semántica adicional local antes del guardado; el backend conserva sus validadores y autoridad. Resolver un punto no prueba hardware ni ejecuta una lectura.

### Formulario adaptativo

En creación manual, `usageSelected` es estado exclusivo de UI: el instalador elige Uso antes de ver dirección, relaciones y opciones; Guardar también comprueba esa elección. No se añade al payload. Edición existente y apertura desde Probe ya tienen contexto y muestran sus campos sin exigir una nueva selección. Desde 1024px el modal utiliza dos regiones laterales; en vertical/móvil se apilan. Se conservan Input/NumberInput/SearchableSelectField/MeasurementUnitSelect/ToggleSwitch y el modal protegido existentes, sin nuevos tamaños de control ni colores.

Guardar/Cancelar (y la retirada existente) utilizan el footer modular del modal, fuera del scroll del contenido; el botón de guardar mantiene su asociación HTML al formulario. Unidad/visualización/vista previa se ocultan para nuevas entradas y comandos binarios mientras se elige su punto, sin convertir su borrador ni ocultar controles numéricos históricos. Evidencia actual de este refinamiento en las tareas AC42: 371 tests focalizados y 16 escenarios responsive distintos, sin validar hardware real ni repetir la suite global.

## Compatibilidad y seguridad

- Abrir una configuración histórica, alternar modo o cancelar no modifica símbolos, PDU, IDs o relaciones. Históricos incompatibles se muestran con advertencia y escape avanzado, sin normalización automática.
- Cambiar uso o perfil con relaciones requiere confirmación; cancelar conserva el borrador. Confirmar descarta relaciones del borrador explícitamente, sin inventar relaciones nuevas.
- Seleccionar X0 no crea M0; Y0 no crea M200; M100 no crea Y0/Y1. El instalador declara cada relación.
- `relatedPhysicalOutputs`, feedback, sustained/pulse, actualState y destino de escritura mantienen sus contratos. No hay cambios de transporte o servicios.
- El Read Probe mantiene su flujo técnico; únicamente recibe controles de capacidad derivados del perfil para poder reutilizar después el selector.

## Ejemplos de selección Xinje

| Selección | Resultado |
| --- | --- |
| Entrada / familia X / CPU / ordinal 0 | X0 · coil · PDU 20480 · FC01 |
| Entrada / familia X / CPU / ordinal 8 | X10 · coil · PDU 20488 · FC01, dentro del espacio reservado si capacidad desconocida |
| Salida / familia Y / CPU / ordinal 0 | Y0 · coil · PDU 24576 · FC01; orden separada |
| Comando / memoria M / índice 100 | M100 · coil · PDU 100 · FC01 |
| Medición / registro D / índice 110 | D110 · holding register · PDU 110 · FC03 |

El perfil ficticio de tests usa `familyId=contacts`, módulo `rack-alpha`, radix 16 y `PORT:1A`; funciona mediante la misma metadata sin añadir condiciones de fabricante. No se registra en el catálogo de producción.

## Validación y límites

### Archivos de Fase B

Nuevos (7):

- `apps/operator-console/src/components/ModbusSemanticPointSelector.tsx`
- `apps/operator-console/src/components/ModbusSemanticAddressField.tsx`
- `apps/operator-console/src/components/ModbusVariablePointEditor.tsx`
- `apps/operator-console/src/lib/modbusSemanticDraft.ts`
- `apps/operator-console/src/components/ModbusSemanticPointSelector.test.tsx`
- `apps/operator-console/src/lib/modbusSemanticDraft.test.ts`
- `docs/components/ModbusSemanticPointSelector.md`

Modificados en esta fase (11):

- `apps/operator-console/src/components/ModbusAddressFields.tsx`
- `apps/operator-console/src/components/PlcBindingEditor.tsx`
- `apps/operator-console/src/components/ModbusReadProbe.tsx`
- `apps/operator-console/src/views/ModbusView.tsx`
- `apps/operator-console/src/locales/es/common.json`
- `apps/operator-console/src/locales/en/common.json`
- `apps/operator-console/tests/responsive-shell.spec.ts`
- `docs/components/ModbusAddressFields.md`
- `docs/spec-coverage-matrix.md`
- `specs/modbus-tcp-local-integration-v1.md`
- `specs/modbus-tcp-local-integration-v1.tasks.md`

Este inventario no incluye cambios previos de Fase A u otros objetivos que ya estaban en el working tree y se conservan.

Fase B: 367/367 Jest focalizados en 11 suites, incluyendo 20 pruebas nuevas de selector/borrador y regresión de integración. Responsive: 16 escenarios distintos PASS (4 AC42, 4 perfiles, 4 PLC I/O y 4 salidas declarativas); repetición final conjunta AC42/salidas declarativas 8/8 PASS. Móvil, tablet vertical/horizontal y desktop, ES/EN y claro/oscuro, con teclado, conservación histórica y advertencias. Evidencia final y límites en las tareas AC42.

No se certifican canales/firmware ni tablet física. No se contacta el PLC ni se accede a SQLite real. No se ejecuta Docker/runtime porque podría iniciar integraciones. No se repite la suite global ni responsive completo; la suite global anterior conserva fallos ajenos documentados en AC41. No es aprobación de release.
