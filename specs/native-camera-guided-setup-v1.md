# SPEC: Alta guiada de cámaras IP con prueba real V1

**Estado:** Aprobado
**Fecha:** 2026-10-12
**Dependencias:** `native-camera-local-integration-v1.md`, `native-camera-onvif-profile-negotiation-v1.md`, `operator-console-v1.md`

## Problema

Agregar una cámara hoy exige elegir entre «ONVIF / PTZ», «RTSP / DVR» y «Sonoff / RTSP» antes de entender qué significan, y rellenar un formulario técnico (host, puerto ONVIF, puerto RTSP, ruta RTSP, usuario y contraseña). Los defectos que más pesan, comparados con cómo lo hacen Home Assistant (la integración «Generic Camera» abre el flujo de video, muestra una vista previa y pide confirmar) y las apps de los fabricantes:

- Para cámaras RTSP/DVR y Sonoff, «probar» solo comprueba que el **puerto TCP esté abierto**: una contraseña o una ruta equivocadas se aceptan y fallan después, al abrir la cámara.
- No hay vista previa antes de guardar, ni forma de saber por qué falla una cámara.
- Las cámaras ya agregadas aparecen en la lista de descubrimiento como si fueran nuevas.
- El usuario debe conocer la ruta RTSP de su marca; no hay sugerencias por marca ni forma de pegar la dirección completa que trae el manual.
- Se pregunta por un «Hogar» aunque solo haya uno.

## Alcance

- Un endpoint que **prueba la cámara de verdad** sin guardarla: abre el video, captura una imagen y clasifica los fallos.
- Un asistente de alta de tres pasos (Elegir, Datos, Probar) en lenguaje corriente, con cámaras encontradas en la red, plantillas por marca y pegado de la dirección completa.
- Vista previa y confirmación antes de guardar, con la posibilidad de guardar igualmente si la cámara está apagada.

Fuera de alcance: la edición de cámaras existentes (conserva su formulario), baja latencia con WebRTC, eventos de movimiento, selección de varios perfiles de video, miniaturas y estado en la lista de cámaras, y el descubrimiento fuera del segmento de red local.

## Requisitos

- **REQ-01:** `POST /api/v1/native-cameras/test` (solo `admin`) recibe los mismos datos que el alta, **no guarda nada**, abre el flujo RTSP de la cámara con `ffmpeg`, captura un fotograma y responde `{ ok: true, snapshot, width, height, codec, ptzSupported }` con la imagen como `data:image/jpeg;base64,…`. Para ONVIF negocia primero el perfil de video. Espera como máximo 12 segundos.
- **REQ-02:** Si la prueba falla responde `{ ok: false, code, message, hint }` con un código estable: `CREDENTIALS_REJECTED`, `PATH_NOT_FOUND`, `PORT_CLOSED`, `UNREACHABLE`, `TIMEOUT`, `NO_VIDEO` o `INVALID_INPUT`. Una cámara que no responde es un resultado de la prueba, no un error de la petición: se contesta `200` con `ok: false`; solo `INVALID_INPUT` responde `400` y un fallo inesperado `500`. `message` dice qué pasó y `hint` qué revisar, en español corriente. Ninguna respuesta ni registro contiene la contraseña, el usuario ni la ruta con credenciales.
- **REQ-03:** El servidor rechaza antes de conectar los destinos que no son un nombre de equipo o dirección IP válidos, y los de `169.254.0.0/16` y `0.0.0.0`, con `INVALID_INPUT`.
- **REQ-04:** Agregar una cámara abre un asistente de tres pasos. **Elegir**: cámaras encontradas en la red (con «Ya agregada» y no seleccionables cuando su dirección ya existe), marcas (Hikvision y compatibles, Dahua y compatibles, Reolink, TP-Link Tapo, Axis, Sonoff CAM, Otra marca) y «Pegar la dirección completa». **Datos**: nombre, dirección, usuario y contraseña, con puertos y ruta en «Opciones avanzadas». **Probar**: ejecuta la prueba, muestra la imagen y los datos detectados, y ofrece «Se ve bien, guardar».
- **REQ-05:** Elegir una marca rellena el tipo, el puerto y la ruta sugeridos y una nota con lo que hay que activar en la cámara; todo queda editable. Las plantillas son sugerencias: la prueba real decide si funcionan.
- **REQ-06:** Pegar una dirección `rtsp://[usuario[:contraseña]@]equipo[:puerto]/ruta` separa equipo, puerto, ruta, usuario y contraseña; las credenciales nunca quedan en la ruta. Una dirección no válida produce un aviso claro y no cambia el formulario.
- **REQ-07:** Si la prueba falla, el asistente muestra el mensaje y la pista, deja «Reintentar» y «Volver a los datos», y ofrece «Guardar de todos modos» como acción secundaria, explicando que la cámara puede estar apagada.
- **REQ-08:** La pregunta por el hogar solo aparece cuando hay más de uno. El alta, la edición y el borrado conservan sus contratos y sus pruebas.

## Criterios de aceptación

- [x] **AC1:** Pruebas de la clasificación de la salida de `ffmpeg` (credenciales, ruta, puerto cerrado, sin ruta, tiempo agotado, sin video) y de la lectura de códec y resolución.
- [x] **AC2:** Pruebas del servicio de prueba: entrada inválida, destinos prohibidos, ONVIF con credenciales rechazadas, éxito con vista previa y que ningún mensaje contiene secretos.
- [x] **AC3:** Pruebas de la ruta: solo `admin`, no guarda nada, estados y cuerpos de éxito y de fallo.
- [x] **AC4:** Pruebas de las plantillas por marca y del análisis de direcciones RTSP, incluidas credenciales con caracteres especiales y direcciones inválidas.
- [x] **AC5:** Pruebas de la consola real del asistente: pasos, cámaras ya agregadas, plantilla, pegado de dirección, vista previa, fallo con «Reintentar» y «Guardar de todos modos», y guardado.
- [x] **AC6:** Las pruebas existentes de cámaras y la validación completa siguen pasando.

## Estrategia de compatibilidad y reversión

Sin migraciones ni cambios en los contratos existentes de alta, edición y borrado. El endpoint de prueba es nuevo y no persiste datos. Revertir el código vuelve al formulario anterior.

## Evidencia

- `FfmpegFrameProbe.test.ts`, `NativeCameraConnectionTester.test.ts` y `NativeCameraTestRoute.test.ts` (AC1–AC3).
- `parseRtspUrl.test.ts` y los escenarios «Native camera guided setup» de `devices-spaces.spec.ts` (AC4, AC5), más el ajuste de `system-views.spec.ts`.
- Validación completa del repositorio (AC6): ver el registro del commit.
