# ModbusAddressFields

Referencia local de los controles de direccionamiento de Sistema → Modbus TCP. Implementación: `apps/operator-console/src/components/ModbusAddressFields.tsx`; resolución pura: `packages/integrations/modbus/domain/ModbusAddressProfile.ts`; catálogo inicial: `domain/profiles/XinjeXL5E.ts`. Contrato: [Integración Modbus TCP local V1](../../specs/modbus-tcp-local-integration-v1.md), AC11–AC15. Se compone en el [editor normal](ModbusConnectionCard.md) y la [prueba de lectura](ModbusReadProbe.md).

## Propósito y contrato

Modo **Operate**: introducir un símbolo y revisar área y dirección PDU efectiva antes de leer o guardar. Reutiliza `Input`, `SearchableSelectField` y `ToggleSwitch`, los tokens de `index.css` y ambos temas. No añade store, paleta ni sistema visual global; los valores pertenecen al formulario padre.

| Control | Props | Comportamiento |
| --- | --- | --- |
| `ModbusProfileSelect` | `value?: string`, `onChange: (value: string) => void`, `disabled?: boolean` | Selector controlado; genérico se representa con cadena vacía al padre. Etiqueta los perfiles con fabricante, familia, modelo y versión. |
| `ModbusAddressFields` | `profileId: string`, `symbol: string`, `end?: string`, `capacities?: ModbusModuleCapacities`, `disabled?: boolean`, `onSymbol: (value: string) => void`, `onEnd?: (value: string) => void` | Un símbolo para el editor; dos extremos para probe. Convierte entrada a mayúsculas, limita a 32 caracteres y resuelve en cada render. El campo final aparece cuando existen `end` y `onEnd`. |
| `ModbusModuleCapacityFields` | `capacities?: ModbusModuleCapacities`, `onChange: (value: ModbusModuleCapacities) => void`, `disabled?: boolean` | Selección local de CPU o expansión 1–16; configuración controlada por el padre. Activar capacidad conocida inicializa entradas/salidas en 0; desactivarla elimina el módulo del mapa. |

La resolución válida muestra símbolo normalizado, área y PDU en `role="status"`; la inválida muestra error traducido en `role="alert"`, sin conservar una resolución anterior. Cuando falta capacidad física para X/Y aparece una advertencia de dirección reservada. Los campos se apilan en móvil y pasan a dos columnas desde `sm`; el bloque ocupa todo el ancho del formulario. Etiquetas, foco, ayuda y estados disabled proceden de los controles compartidos; copy de `modbus.*`.

## Perfil y resolución

La capa pura conserva fabricante/familia/modelo/versión y segmentos explícitos, independiente del transporte. El catálogo inicial contiene Xinje XL5E-16T v1 (`xinje-xl5e-16t-v1`); ese identificador versionado es un contrato inmutable y futuros mapas deben usar otro ID. No verifica firmware ni compatibilidad física del equipo.

M, SM, T, C, HM, HT, HC y D, SD, TD, CD, HD, HTD, HCD usan índices decimales. X/Y usan octal estricto: `X8` y `Y9` son inválidos. X/Y CPU reservan 64 posiciones; expansiones 1–16 empiezan en símbolo octal `10000`, avanzan `100` octal por módulo y tienen 64 posiciones cada una. Ejemplos: `D100` → holding register/PDU 100, `X10` → coil/PDU 20488, `X10000` → coil/PDU 20736. El mapa completo y sus bases están en AC11.

Se rechazan perfil desconocido, sintaxis inválida, huecos y extremos fuera de segmento. Un rango inclusivo debe ser ascendente, de máximo 64 direcciones y permanecer en el mismo segmento. Tipos de 32 bits consumen dos registros consecutivos y el backend rechaza cruzar el límite del segmento. La resolución indica direccionamiento, no una lectura ni existencia física confirmada.

`moduleCapacities` es un mapa opcional por `CPU` o claves `1`–`16`, con `inputs` y `outputs` enteros de 0–64. Omitir una capacidad significa desconocida, nunca 64 canales físicos. Una capacidad conocida de 0 no permite canales de ese tipo. Valores declarados limitan símbolos X/Y, rangos y guardado; el servidor usa las capacidades guardadas de la conexión como autoridad al guardar variables y, si existen, al probar el mismo host/Unit ID. Reducir capacidad se rechaza si invalidaría variables existentes.

## Seguridad, persistencia y evidencia

La UI aporta preview; el backend vuelve a resolver y comprueba concordancia de `profileId`/`symbolicAddress` con `area`/`address`. M, Y y HM admiten únicamente el opt-in de escritura ya existente; los demás segmentos, incluidas X y áreas de sistema, rechazan `writable=true` en backend. La prueba siempre es de lectura y no habilita conexiones. El modo genérico conserva su política histórica de coils.

Conexión guarda `profileId` y capacidades opcionales; variable guarda `profileId` y símbolo opcionales junto a área/PDU. Se usa el JSON existente sin SQL nuevo; configuraciones genéricas históricas siguen funcionando. Un editor anterior puede perder estos metadatos al volver a guardar aunque conserve área/PDU; realizar backup antes de instalar o revertir. También aplicar la limitación histórica de tipos de 32 bits descrita en [ModbusReadProbe](ModbusReadProbe.md).

La ejecución principal reportó 238 pruebas Jest aprobadas en ocho suites (203 Modbus y 35 de regresión), 14 escenarios responsive focales y cuatro recapturas finales aprobados; typecheck, lint, builds raíz/consola y controles de spec coverage, BDD, cobertura por módulo, i18n, arquitectura y ausencia de `any` de producción aprobados. Revisión fresca SHIP sobre 16 capturas en `.impeccable/review/plc-profiles`: móvil (390×844), tablet vertical (768×1024), tablet horizontal (1024×768), desktop (1440×900), formulario/resultados y ambos temas. Este handoff documental recoge esa evidencia y no repite pruebas funcionales.

No se validaron PLC físico, firmware, base real, suites completas ni despliegue. La evidencia focal no certifica compatibilidad física ni accesibilidad completa y no autoriza publicación.
