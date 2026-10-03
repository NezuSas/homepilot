# PlcCommandDialog

Confirmación modular de escritura PLC. Implementación: `apps/operator-console/src/components/PlcCommandDialog.tsx`; composición en ModbusView y ejecución por DeviceCommandService/ModbusService existentes.

## Propósito y contrato

Modo Operate: probar explícitamente una variable persistida/escribible con advertencia de actuación física. Conserva paleta/tokens y reutiliza Modal, NumberInput, SearchableSelectField, Button y AlertBanner.

| Prop | Tipo | Responsabilidad |
| --- | --- | --- |
| variable | `ModbusVariable & { diagnostic?: ModbusDiagnostic }` | Device, binding, writable, límites persistidos y diagnóstico opcional actualizado por la vista. |
| onClose | Callback | Cerrar diálogo. |
| onExecuted | Callback Promise<void> | Recargar conexiones y snapshot. |

La tarjeta abre solo para binding PLC escribible y deshabilita acción con conexión deshabilitada. El diálogo comprueba busy/writable; autorización definitiva, pertenencia al hogar y política de escritura pertenecen al servidor. La autorización Admin de configuración no reemplaza permisos del comando común.

## Interacción

Título Autorizar comando, descripción con nombre de variable y aviso de escritura. Sostenido ofrece ON/OFF, inicial ON, y envía turn_on/turn_off. Pulse envía pulse con duración persistida y advertencia de watchdog externo. Setpoint solicita número y muestra min/max/unidad; envía `{ name: 'set_value', params: { value } }`. Confirmar se deshabilita con número no finito o fuera de límites.

Confirmar escritura envía POST `/api/v1/devices/:deviceId/command`; no usa Probe ni endpoint PLC paralelo. Backend valida opt-in, rol, perfil/segmento, codec, rango y límites. D/HD escribibles exigen v2 y rol setpoint; v1 conserva política original y Read Probe permanece READ ONLY.

Mientras busy, Cancelar se deshabilita, Confirmar muestra carga y cierre se ignora. Respuesta fallida muestra alerta y refresca; éxito refresca/cierra. Excepción conserva diálogo con error. No hay reintento automático ni repetición de escritura.

## Feedback y límites físicos

Escritura no demuestra actuación física. El servicio conserva estado solicitado/confirmación; polling existente lee principal y relaciones explícitas. Feedback configurado prevalece como estado real; física se conserva independiente. Required espera confirmación hasta timeout sin repetir escritura; divergencia conserva pending/unconfirmed. Optional usa lectura disponible sin certificar confirmación inmediata; none conserva comportamiento sin feedback independiente.

[ModbusConnectionCard](ModbusConnectionCard.md) muestra Estado solicitado y Estado real separados, incluso ON solicitado/OFF observado. Diagnóstico/último comando son efímeros, sin historial persistente. Pulse intenta reset OFF y comunica reset_failed; caída de proceso/red puede impedirlo. Watchdog, interlocks, Ladder y seguridad física son responsabilidad externa del PLC y no se certifican por la UI.

## Apariencia, accesibilidad y evidencia

Modal max-w-md con cabecera al inicio, nombre con salto de línea y scroll interno dentro del viewport. Formulario de una columna; acciones envuelven al final con borde semántico y botones lg (mínimo 44 px). Advertencia/error usan texto y tokens existentes. Modal proporciona dialog, aria-modal, título/descripción y foco; cierre explícito disponible fuera de busy. Controles tienen etiquetas/ayudas/límites y error role alert. Copy plc.* y modbus.cancel traducido. Envío conserva formulario con carga del botón; el skeleton inicial pertenece a la vista.

El coordinador reportó responsive Modbus 22/22 y final PLC 4/4, cuatro tamaños (390×844, 768×1024, 1024×768, 1440×900) y temas claro/oscuro, scroll y acciones accesibles sin overflow global, además de pruebas focales y controles aprobados. Evidencia en [Cierre PLC I/O](../modbus-plc-io-closeout.md). Este handoff no ejecutó pruebas. No hubo PLC físico ni certificación de actuación, seguridad funcional o accesibilidad completa; tampoco aprobación de release/deploy.

## Setpoint y error conservado — AC31

El setpoint presenta valor actual, unidad y símbolo antes del campo objetivo. Prioriza `variable.diagnostic.value` sobre `lastKnownState.value`; diagnóstico no online muestra «No disponible» y ausencia de valor muestra «Esperando lectura». El campo empieza vacío (`NaN`), acepta decimales (`step="any"`) y muestra mínimo, máximo y unidad persistidos. Confirmar se deshabilita si el objetivo no es finito, queda fuera de límites o faltan límites; un objetivo finito muestra además un resumen explícito de nombre, valor y unidad antes de escribir.

El comando mantiene el endpoint común de Device y el payload `set_value` existente. Error HTTP conserva diálogo y objetivo, presenta traducción segura mediante `plcResponseError` y refresca diagnóstico; una excepción usa `plc.command_failed`. Otro intento requiere una acción explícita. La vista actualiza la variable del diálogo con el resumen recibido, sin sustituir el estado local del objetivo. Éxito refresca y cierra; busy bloquea Cancelar/cierre y muestra carga. Esto no confirma actuación física ni repite comandos automáticamente.

Advertencias de escritura/watchdog y error usan AlertBanner con foreground y opacidad completa en esta composición local. Se preservan icono/fondo/borde semánticos y `role="alert"`; el AlertBanner compartido no cambia. La evidencia histórica anterior sigue separada de la fase AC28–AC32: el coordinador comunicó 611/611 Jest en 30 suites focalizadas tras las correcciones, 80/80 en tres suites UI por separado, responsive focalizado 18/18 y confirmación final 4/4. Typecheck, lint y ambos builds aprobaron después de las correcciones; la revisión fresca reportó SHIP y ambos hallazgos materiales resueltos. [Cierre UI PLC / Modbus](../modbus-plc-ui-closeout.md) centraliza el resultado final. No se ejecutaron pruebas en este handoff ni hubo hardware, Docker o publicación.
