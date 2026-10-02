# MeasurementUnitSelect

Source: `apps/operator-console/src/components/ui/MeasurementUnitSelect.tsx`; family spec AC80, Modbus AC17.

Controlled props: `value: string`, `onChange(string)`, optional label/disabled. Reuses SearchableSelectField's 44px trigger, portal, search, keyboard/visual viewport and theme behavior.

Catalog of common measurement units (temperature, pressure, electrical, energy, distance, flow, storage and others), plus translated No unit/Sin unidad. It is not an exhaustive universal enum: an unknown historical unit remains selectable unchanged. No magnitude conversion, backend restriction or migration. Switching units changes display metadata only.

Coverage: focal Modbus configuration/commissioning/profile responsive scenarios select °C and verify persistence. Component performs no asynchronous fetch and needs no independent loading skeleton.
