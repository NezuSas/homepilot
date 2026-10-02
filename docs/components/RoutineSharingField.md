# RoutineSharingField

Campo modular de acceso de Escenas/Automatizaciones. Privado por defecto (`[]`), búsqueda por nombre y selección de varios usuarios activos del directorio sanitizado. Mantiene selección al filtrar. Skeleton propio durante carga; error explícito sin alterar concesiones existentes. El backend verifica hogar, concesiones y creator-only para administración. Compartir no transfiere ownership.

Propiedades: `value: string[]`, `onChange(ids)`. Checkbox nativo, etiqueta asociada y targets táctiles de 44px, catálogo desplazable. Specs: scene-lifecycle-v1 AC6; automation-rules-engine-v1; operator-console-v1.
