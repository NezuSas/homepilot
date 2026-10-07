# Tasks — HomePilot Global Installer v1

- [x] T1: inventariar/reutilizar instalador histórico, Compose, checks, claim y enrollment (AC2–AC6).
- [x] T2: implementar wizard global con salida TTY/no TTY, validación y confirmación (AC1).
- [x] T3: validar sistema base, Docker y TPM con operaciones simulables (AC2, AC4).
- [x] T4: orquestar perfiles HA y overlays opcionales de cámaras, Android, MQTT y voz (AC3, AC6).
- [x] T5: instalar/verificar cloudflared sin divulgar token; integrar pairing Directory y enrollment TPM una vez (AC4, AC5).
- [x] T6: preservar instalación existente y mantener compatibilidad con install-edge-office/maintenance (AC7).
- [x] T7: cubrir el wizard con mocks y ejecutar la validación autorizada (AC8).
- [x] T8: evitar rangos de colación dependientes de locale en nombres de cliente/instalación; cubrir nombres ASCII y acentuados con `C.UTF-8`, manteniendo longitud máxima y rechazo de caracteres inseguros (AC1, AC8). La validación global del candidato permanece pendiente de ejecución por el usuario.
