# TASK BREAKDOWN: Responsive Validation Speed V1

- [x] Medición de referencia: fase del reloj 51 pruebas en 7,9 min con 1 worker (2026-10-10, equipo del usuario).
- [x] Parámetro `--skip-clock` y `HOMEPILOT_SKIP_CLOCK` en `scripts/run-responsive-tests.mjs`, con aviso y error explícito si no queda nada que ejecutar.
- [x] Script `test:responsive:fast` en `package.json`.
- [x] Agrupar los lotes del barrido del reloj en un `describe` paralelo (hoy en `clock-contract.spec.ts`) sin tocar aserciones.
- [x] Documentar las tres formas de ejecución en `docs/command-reference.md`.
- [x] Medir la fase del reloj después: 51/51 en 2,7 min con 4 workers (referencia 7,9 min). Con 16 workers, 6 pruebas agotaron el tiempo por contención de CPU (32 núcleos), por eso la fase del reloj usa 4 workers por defecto y `--workers` explícito prevalece.
- [x] AC3 (`test:responsive:fast` omite el reloj con aviso) y AC4 (`--skip-clock -g "Clock size contract"` falla con mensaje explícito) verificados.
- [x] Controles de spec, BDD, módulos, lint y typecheck.
