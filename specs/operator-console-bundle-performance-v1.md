# Spec: Operator Console Bundle Performance V1

**Estado:** Aprobado
**Seguimiento:** GitHub Issue #4

## Objetivo

Reducir el coste de JavaScript del selector de iconos del Operator Console sin alterar los contratos de dashboard, accesibilidad ni la edición de iconos existentes.

## Alcance

- Sustituir la carga dinámica del catálogo completo de @mdi/js por imports tipados de un subconjunto residencial de MDI.
- Mantener los iconos Lucide ya presentados por HomePilot.
- Resolver como MDI las convenciones guardadas mdi:* más comunes y dejar intacto el texto de valores no incluidos.
- Conservar el selector accesible: campo, listbox, navegación con teclado y cierre con Escape.

## Fuera de alcance

- Cambios a la persistencia de dashboards, sus APIs o contratos de dispositivos.
- Cambios visuales de la shell, flujos de edición o estados de dispositivos.
- Descargar iconos de red o exponer catálogos remotos.

## Criterios de aceptación

1. El build no emite el chunk completo de @mdi/js de aproximadamente 2.8 MB.
2. Los valores persistidos comunes mdi:* usados por HomePilot siguen renderizando un icono.
3. Un valor no incluido se conserva como texto y usa el fallback visual existente sin provocar una descarga ni un fallo.
4. El selector mantiene roles ARIA, foco, Escape, filtrado y mensajes de estado vacío.
5. Pasan lint, typecheck, build y regresión responsive.

## Seguridad y reversión

- No se manipulan sesiones, secretos, red, datos de clientes ni datos de dashboards.
- La reversión es restaurar únicamente los módulos de selector y esta spec; no requiere migración ni recreación de contenedores.