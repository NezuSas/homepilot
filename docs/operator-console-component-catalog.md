# Catálogo de Componentes Modulares de Operator Console

Este documento operacional complementa la spec `operator-console-modular-components-v1.md`. No define reglas de negocio: documenta qué componente reutilizar y evita duplicar UI.

## Primitivos obligatorios

| Necesidad | Componente | No usar para |
|---|---|---|
| Acción textual o destructiva | `ui/Button` | Navegación de icono sin texto |
| Acción compacta de icono | `ui/IconButton` | Acción principal sin etiqueta accesible |
| Texto o valor editable | `ui/Input` | Selectores con opciones |
| Selección corta | `ui/Select` / `ui/SelectField` | Menús ad hoc sin teclado |
| Selección buscable o descriptiva | `ui/SearchableSelectField` | Portales de selección implementados dentro de una vista |
| Búsqueda | `ui/SearchFilterBar` | Inputs locales duplicados |
| Confirmación crítica | `ConfirmModal` | `window.confirm` |
| Modal dentro de la app | `ui/Modal` | Overlay global fuera del shell |
| Estado pequeño | `ui/StatusPill` | Texto de estado sin semántica visual |
| Sin resultados | `ui/EmptyState` | Contenedor vacío sin explicación |
| Navegación lateral | `ui/SidebarItem` | Enlaces estilizados manualmente |

## Fichas individuales

Cada componente modular tiene una ficha de propósito, contrato, uso y criterios de
aceptación en `docs/components/`:

`AlertBanner`, `AssistantCard`, `Button`, `Card`, `DeviceTileBase`,
`DeviceTileShell`, `EmptyState`, `IconButton`, `Input`, `Modal`, `PageFrame`,
`SearchFilterBar`, `SectionHeader`, `SegmentedControl`, `Select`, `SelectField`,
`SearchableSelectField`,
`SidebarItem`, `StatusPill`, `ConfirmModal`, `CoverPositionControl`,
`AudioInputPicker` e `InlineTabCreator`.

La comprobación `npm run check:spec-coverage` falla si cualquiera de estas fichas
desaparece.

## Reglas de composición

1. Una vista reúne datos y permisos; un componente modular no consulta directamente una integración.
2. Una entidad de dispositivo usa `DeviceTileBase` o `DeviceTileShell` y solo expone acciones habilitadas por capacidades.
3. Una tarjeta propia de cámara, media, escena, sensor, habitación o dashboard se rige también por la spec de su dominio.
4. Todo texto nuevo se registra en `locales/es/common.json` y `locales/en/common.json` antes de mostrarse.
5. No crear un modal, botón, selector ni tarjeta paralela si ya existe un componente de esta tabla.

## Checklist de revisión

- ¿El componente usa tokens visuales?
- ¿Es usable con teclado y foco visible?
- ¿Soporta texto largo y ambos idiomas?
- ¿Sus acciones están visibles dentro del viewport en móvil?
- ¿Mantiene datos existentes mientras refresca?
- ¿Su estado depende de props tipadas y no de lógica de dominio oculta?
