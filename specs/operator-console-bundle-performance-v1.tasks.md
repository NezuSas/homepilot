# Tasks — Operator Console Bundle Performance V1

- [x] Registrar el alcance en una Issue real de GitHub. Evidencia: NezuSas/homepilot#4. [id: 1.1]
- [x] Medir el artefacto base y localizar la carga completa de @mdi/js. Evidencia: apps/operator-console/dist/assets/mdi-*.js (~2.80 MB). [id: 1.2]
- [x] Definir el contrato de rendimiento, accesibilidad, compatibilidad y reversión. Evidencia: specs/operator-console-bundle-performance-v1.md. [id: 1.3]
- [x] Reemplazar el catálogo dinámico completo por imports MDI tipados y un catálogo residencial compacto. Evidencia: apps/operator-console/src/views/dashboards/components/IconPicker.tsx. [id: 2.1]
- [x] Medir el artefacto posterior y ejecutar lint, typecheck, builds y regresión responsive. Evidencia: verify:quality correcto; 36 pruebas responsive correctas; mayor JS 391.73 kB. [id: 3.1]
- [x] Registrar la evidencia en la Issue y pasar el flujo a QA. Evidencia: comentario de Issue #4. [id: 4.1]