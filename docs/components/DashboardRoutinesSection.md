# DashboardRoutinesSection

**Fuente:** `apps/operator-console/src/components/DashboardRoutinesSection.tsx`
**Spec de familia:** `specs/routines-unified-console-v1.md`

## Propósito

Compone en Inicio las escenas y automatizaciones marcadas como favoritas bajo una única superficie de Rutinas favoritas.

## Contrato

Recibe las listas de escenas y automatizaciones, sus identificadores favoritos, el identificador en proceso y callbacks para ejecutar escenas, alternar automatizaciones y abrir la gestión de Rutinas.

## Comportamiento

- Las escenas aparecen como rutinas **Manual** y se ejecutan al pulsarlas.
- Las automatizaciones aparecen como rutinas **Automática** y alternan entre activas y pausadas al pulsarlas.
- Si no hay favoritos, comunica el estado vacío y ofrece acceso a la gestión de Rutinas.
- Mantiene etiquetas ES/EN y usa una grilla responsive de una, dos o tres columnas.
