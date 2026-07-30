# Integración directa Tuya Smart

## Qué hace

HomePilot puede vincular cortinas Tuya Smart directamente, sin depender de Home Assistant. Después de importarlas, se convierten en dispositivos locales de HomePilot: aparecen en el inventario y se asignan a una estancia igual que cualquier otro dispositivo.

## Preparación del appliance

El instalador configura una única vez el proyecto Tuya que pertenece a HomePilot. Esta configuración se mantiene fuera de la interfaz del cliente:

```env
TUYA_SHARING_CLIENT_ID=<client-id-provisionado-para-homepilot>
TUYA_SHARING_SCHEMA=homepilotauthorize
TUYA_SHARING_AUTH_ENDPOINT=https://apigw.iotbing.com
```

El `schema` debe estar registrado y autorizado dentro del proyecto Tuya de HomePilot. No se reutilizan credenciales de Home Assistant ni se piden secretos de Tuya al usuario final.

## Vinculación para el cliente

1. En **Sistema > Tuya Smart**, abre la conexión.
2. En la app Smart Life o Tuya Smart, busca **Ajustes > Cuenta y seguridad > Código de usuario**.
3. Copia el código de usuario en HomePilot.
4. Escanea el código QR que muestra HomePilot desde la app Tuya.
5. Cuando la autorización termine, selecciona el hogar destino y pulsa **Buscar cortinas**.
6. Importa cada cortina que quieras usar y asígnala a una estancia desde el flujo habitual de HomePilot.

HomePilot no muestra ni devuelve tokens de acceso, tokens de renovación, UID, endpoint ni secretos. Estos datos se conservan solo en la base local del appliance para mantener la sesión autorizada.

## Operación

- HomePilot renueva localmente la sesión de Tuya antes de que expire.
- Una cortina importada no puede importarse otra vez al mismo hogar; se identifica como `tuya:<deviceId>`.
- Desconectar Tuya elimina solamente la autorización local de HomePilot. No borra dispositivos físicos ni afecta la cuenta Tuya.
- Si el appliance no fue provisionado con `TUYA_SHARING_CLIENT_ID`, la interfaz informa que Tuya Smart no está habilitado.
