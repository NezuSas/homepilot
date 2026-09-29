# Tasks — HomePilot device-bound Edge identity v1

- [x] T1: persistir estado bound y metadatos públicos en SQLite existente, sin degradación automática (AC2, AC5, AC6).
- [x] T2: definir `DeviceIdentityProvider`, TPM2 y software restringido a desarrollo/tests (AC2, AC4, AC6).
- [x] T3: crear provisioning explícito de enrollment conforme a Directory (AC2, AC4).
- [x] T4: extender cliente Directory para challenge y proof canónico sin cambiar IntentFlow ni legacy (AC1, AC3, AC4).
- [x] T5: verificar identidad local al arrancar, publicar readiness y bloquear operaciones normales cuando sea inválida (AC5, AC6).
- [x] T6: preparar/documentar runtime Linux TPM 2.0 sin guardar la clave privada ni ejecutar Docker (AC4, AC6).
- [x] T7: probar legacy, bound, errores, clonado y offline con provider fake; ejecutar typecheck y build (AC1–AC7).
