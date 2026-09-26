# Tareas: Installation Profiles V1

## Implementado

- [x] Perfil de instalación disponible en runtime y cubierto por `__tests__/InstallationProfile.test.ts`.

## Verificación pendiente

- [ ] Validar cambios de perfiles y sus variables de entorno antes de marcarlos completados.
- [x] AC21: El mantenimiento adopta el perfil válido almacenado en `.env` cuando no se pasa `--profile`, permitiendo que un runtime `ha_companion` inicie Home Assistant con el comando estándar.
- [x] AC22-24: Configuración declarativa de URL de Home Assistant por runtime, aislamiento de datos del contexto Docker, puertos auxiliares locales y rotación de logs; checklist documentado.
- [x] AC25: Diagnóstico genérico sin ejemplos SSH de otra instalación ni archivos HTTP temporales.
- [ ] Ejecutar el checklist de entrega en la MiniPC y red reales del primer cliente, incluida una restauración aislada y captura de digests/versiones de imágenes.
- [x] AC26: Corregir textos de limpieza, reportar filesystem y RECLAIMABLE global con umbrales 75%/85% no bloqueantes y cubrirlos con pruebas; documentar builder dedicado y retención de rollback como fase 2 no implementada.
- [x] AC27: Aislar los builds del instalador, mantenimiento y probe VAAPI en `homepilot-builder`, verificar carga local, informar uso por builder y documentar GC futuro sin activarlo.
- [x] AC28: Configurar GC solo en builders nuevos HomePilot; validar semánticamente sus cuatro reglas efectivas aun cuando BuildKit canonicalice el TOML, con límites binarios GiB y rechazo de cambios reales; detectar configuración heredada sin recrearla, ampliar reportes/alertas y documentar retención, volumen BuildKit y acción manual futura sin ejecutar prune.
- [x] AC29: Etiquetar imágenes runtime/probe con propiedad versionada, proteger una imagen previa antes de cada build, consolidar un rollback por servicio solo tras salud, y añadir `--gc-homepilot` explícito con previsualización/revalidación y borrado exclusivo de imágenes verificadas, sin Docker prune ni limpieza legacy automática.
