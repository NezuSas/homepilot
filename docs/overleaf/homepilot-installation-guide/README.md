# Guía de instalación técnica — HomePilot

Proyecto LaTeX modular para importar a Overleaf. Copie el contenido de esta carpeta en un proyecto nuevo y agregue el logotipo corporativo como `Images/logo.png`.

## Archivos

- `main.tex`: punto de entrada.
- `config.tex`: paquetes, paleta y estilos visuales.
- `coverpage.tex`: portada.
- `introduction.tex`: propósito, alcance y arquitectura.
- `requirements.tex`: requisitos y preparación en sitio.
- `installation-profiles.tex`: decisión entre los tres perfiles de instalación.
- `use-cases.tex`: escenarios de instalación, actualización y recuperación.
- `steps.tex`: procedimiento técnico guiado.
- `operations.tex`: validación, actualización y mantenimiento.
- `troubleshooting.tex`: diagnóstico y recuperación.
- `conclusion.tex`: entrega al cliente.

## Compilación

Seleccione **pdfLaTex** en Overleaf y compile `main.tex`.

## Imagen requerida

Agregue el logotipo de Nezu en la ruta `Images/logo.png`. La guía compila sin el logo si comenta la línea `\\includegraphics` de `coverpage.tex`.
