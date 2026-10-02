# EventFilters

Filtro compartido de fecha local, acción y nombre parcial en Diagnósticos, Auditoría e Historial. Reutiliza DateField, SearchableSelectField y SearchInput. Tres columnas alineadas cuando hay espacio; una columna en móvil. Controles de 44px y skeleton propio con los mismos breakpoints.

`EventFilterValues` contiene `date`, `action`, `name`; el componente no consulta ni modifica registros. Los consumidores conservan correlaciones y filtran únicamente eventos recientes cargados. `eventNames` resuelve nombres de metadata explícita o relaciones con dispositivos conocidos, nunca busca IDs ni inventa vínculos. Spec: observability-diagnostics-v1; operator-console-v1 AC58.
