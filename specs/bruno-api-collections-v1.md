# SPEC: Colecciones Bruno para la API HTTP de HomePilot v1

**Estado:** Aprobado  
**Autor:** Coordinador, Seguridad/Arquitectura, QA y regresión, Documentación  
**Fecha:** 2026-09-01  

## 1. Declaración del Problema

Las rutas HTTP implementadas por HomePilot están distribuidas entre módulos `RouteHandler`.
Sin una colección versionada, los ejemplos de uso, los requisitos de autenticación y los
contratos operativos no son fácilmente descubribles ni revisables junto al código. Esto
incrementa el riesgo de usar rutas mutantes sobre un hogar real con parámetros o credenciales
inadecuadas.

## 2. Alcance

- Crear una colección Bruno en el repositorio que cubra las rutas HTTP implementadas en
  `apps/api/routes`.
- Agrupar las solicitudes por módulo de ruta y describir método, URL, autorización, parámetros,
  cuerpo y respuesta esperada cuando el código lo permita verificar.
- Incluir entornos de ejemplo locales sin secretos ni identificadores de hogares, dispositivos,
  cámaras o usuarios reales.
- Distinguir solicitudes de consulta de las mutantes; las mutantes se documentan con ejemplos
  seguros y no se configuran para ejecutarse automáticamente en lote o CI.
- Añadir una guía de contribución y de manejo de secretos para la colección.

## 3. Fuera de Alcance

- No cambiar contratos, handlers, autenticación, persistencia ni comportamiento de producción.
- No ejecutar solicitudes contra dispositivos, cámaras, Home Assistant ni hogares reales.
- No almacenar tokens, sesiones, contraseñas, URLs firmadas, archivos multimedia ni respuestas
  reales en la colección.
- No sustituir una especificación OpenAPI completa ni generar documentación pública externa.

## 4. Requisitos Funcionales

- **REQ-01**: La colección debe reflejar las rutas HTTP que reclaman los módulos bajo
  `apps/api/routes` al momento de su creación.
- **REQ-02**: Cada solicitud debe usar variables para URL base, sesión y valores de ruta.
- **REQ-03**: Las solicitudes protegidas deben declarar el mecanismo de autorización sin incluir
  el valor de la credencial.
- **REQ-04**: Las solicitudes mutantes deben identificarse en su nombre o descripción como
  `MUTANTE` y usar valores de muestra no ejecutables por defecto.
- **REQ-05**: La colección debe incluir la ruta de salud y solicitudes de lectura representativas
  para validar conectividad local sin modificar estado.
- **REQ-06**: La guía debe explicar la importación en Bruno, la configuración de `.env` local y
  el proceso para incorporar rutas nuevas.

## 5. Requisitos No Funcionales

- **NFR-01**: La colección se debe almacenar como texto legible y versionable en Git.
- **NFR-02**: Los archivos versionados no contienen secretos ni datos de instalaciones reales.
- **NFR-03**: Los cambios deben ser revisables mediante diff y no deben introducir dependencias
  de nube ni una cuenta de Bruno.
- **NFR-04**: La documentación debe preservar la separación Edge/Cloud y advertir cuando una
  ruta pueda accionar un dispositivo físico o una integración externa.

## 6. Criterios de Aceptación

- [ ] AC1: Existe una colección Bruno importable que agrupa las rutas por cada `RouteHandler`.
- [ ] AC2: La colección tiene un entorno de ejemplo y `.gitignore` que evita versionar secretos.
- [ ] AC3: Ningún archivo de la colección contiene un token, una contraseña, una sesión ni un
  identificador real de hogar, dispositivo, usuario o cámara.
- [ ] AC4: Las rutas mutantes están documentadas y claramente marcadas como no ejecutables en
  lote/CI sin aprobación explícita.
- [ ] AC5: Existe una guía con pasos de uso, variables requeridas y mantenimiento.
- [ ] AC6: La documentación cubre los módulos de rutas existentes o deja de forma explícita y
  verificable cualquier exclusión.

## 7. Notas Técnicas y Arquitectura

La fuente de verdad de las rutas es el código de `apps/api/routes`; cada clase implementa el
contrato `RouteHandler`. La colección reside en `bruno/homepilot-api/` y usa variables como:

```text
baseUrl=http://localhost:3000
sessionToken=
homeId=example-home-id
deviceId=example-device-id
```

`sessionToken` se inyecta desde un archivo `.env` local ignorado o desde las variables de
entorno del sistema. Los cuerpos de ejemplo deben emplear valores sintéticos y no deben ejecutar
comandos físicos de manera predeterminada.

## 8. Preguntas Abiertas y TODOs

- TODO: Confirmar el puerto local de referencia antes de recomendar una ejecución manual.
- TODO: Evaluar una especificación OpenAPI separada si la API pasa a tener consumidores externos.
