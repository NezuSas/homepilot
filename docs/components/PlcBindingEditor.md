# PlcBindingEditor

Editor modular PLC I/O del formulario de variable de ModbusView. Implementación: `apps/operator-console/src/components/PlcBindingEditor.tsx`; validación autoritativa: `packages/integrations/modbus/domain/PlcBinding.ts`.

## Propósito y contrato

Modo Operate: relaciones explícitas sin inferir Ladder ni correspondencia X/M/Y. Conserva paleta, tokens, tipografía, foco y controles HomePilot: Input, NumberInput, SearchableSelectField y AlertBanner. No introduce sistema visual, store global ni API paralelos.

| Prop | Tipo | Responsabilidad |
| --- | --- | --- |
| variable | ModbusVariable sin deviceId/connectionId | Borrador completo y binding opcional. |
| onChange | Callback del borrador | Actualizar estado local del formulario padre. |
| commandField | ReactNode opcional | Campo simbólico principal del padre, renderizado una sola vez después de Salida física para output. |

No consulta API ni guarda solo. Nombre, perfil/símbolo, conversión, unidad, writable y habitación pertenecen a ModbusView. Para output, ModbusView entrega el mismo campo simbólico principal como Comando PLC: se muestra una sola vez dentro del editor, después de Salida física (ancho completo y valor destacado). Para output_command se conserva el resumen readOnly. Guardar reconstruye command desde la dirección principal resuelta como antes; editar física cambia únicamente physical. Entradas usa Entrada física y conserva lógica opcional. Bindings opcionales se persisten en JSON existente sin SQL nuevo y variables históricas sin binding conservan compatibilidad. AC34 no modifica feedback, actualState, confirmación, permisos, ejecución ni backend; no se infiere ninguna relación Ladder.

## Roles y edición

| Rol | Campos específicos |
| --- | --- |
| Histórico | Elimina binding PLC. |
| input | Física y lógica opcional. |
| output | Comando, física, política/feedback y modo. |
| output_command | Comando, política/feedback y modo. |
| output_feedback | Rol de feedback; dirección principal en padre. |
| measurement | Rol de medición; conversión en padre. |
| setpoint | Mínimo/máximo; registro y permiso en padre. |
| diagnostic | Rol diagnóstico; dirección principal en padre. |

Seleccionar rol reinicia writable=false y propone política none, timeout (2000 ms), modo sustained y duración (500 ms). Outputs toman el comando de la variable principal; setpoint propone límites (0/100) ajustables. Falta de perfil muestra aviso. None elimina feedback; optional/required muestran feedback requerido y timeout (250–10000 ms). Pulse muestra duración (100–5000 ms) y advertencia de watchdog externo. NumberInput permite borrador vacío como NaN, que el backend rechaza si no se corrige.

## Validación y seguridad

Backend resuelve direcciones con perfil/capacidades y rechaza discrepancias de área/PDU. Resolución provisional inválida conserva borrador inválido, sin certificar dirección. Relaciones de bits deben resolver a coil; roles de bits exigen boolean y measurement/setpoint tipo numérico. Output requiere física; outputs escribibles requieren comando coincidente con variable y perfil autorizado. Feedback debe ser independiente del comando y concordar con política. Lógica solo corresponde a input.

Setpoint exige holding register D/HD del perfil separado `xinje-xl5e-16t-v2`, límites finitos min menor que max y opt-in separado. V1 permanece inmutable; X y segmentos protegidos siguen de lectura. Pulse requiere comando y no permite Y directo; duración acotada no reemplaza interlocks/watchdog ni garantiza reset ante caída de proceso/red. Guardar no ejecuta escritura; [PlcCommandDialog](PlcCommandDialog.md) proporciona prueba confirmada y Read Probe sigue READ ONLY.

## Apariencia, accesibilidad y evidencia

Fieldset con legend PLC I/O, borde semántico, separación y campos en una columna/dos desde sm. El bloque ocupa todo el ancho del formulario padre. Ayudas atenuadas y advertencias textuales conservan legibilidad en ambos temas. Copy plc.* traducido; controles compartidos aportan etiquetas, ayudas y foco. Modal padre conserva cierre explícito, scroll interno y acciones Guardar/Cancelar accesibles. Carga inicial usa skeleton PLC propio; refresh conserva datos.

El coordinador reportó responsive Modbus 22/22 y final PLC 4/4 en cuatro tamaños (390×844, 768×1024, 1024×768, 1440×900) y ambos temas, con controles y validación focal aprobados. Evidencia consolidada en [ModbusConnectionCard](ModbusConnectionCard.md) y [Cierre PLC I/O](../modbus-plc-io-closeout.md). Este handoff documenta código/evidencia recibida sin ejecutar pruebas. No implica aprobación de release ni validación de firmware, Ladder, cableado o PLC físico.
