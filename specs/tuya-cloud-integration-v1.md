# Tuya Cloud Integration V1

## Objective
Provide a native HomePilot bridge to Tuya Cloud for compatible curtain/cover devices, without routing commands through Home Assistant.

## Scope
- Administrators configure a Tuya OpenAPI endpoint, Client ID, Client Secret and authorised account UID.
- The integration verifies the official signed API session before saving configuration.
- Compatible covers are listed and imported into the HomePilot device inbox exactly once per home.
- Imported devices use the `tuya` driver and support open, close, stop and position commands.

## Acceptance criteria
- Tuya credentials are never returned by HTTP APIs; status only returns masked hints.
- Importing the same Tuya device into the same home returns a duplicate error and does not create a second local device.
- Tuya covers are persisted as `cover`, semantic type `cover`, integration source `tuya`, and are controllable after room assignment.
- Home Assistant remains optional and untouched by this module.
- All Tuya system endpoints require an authenticated administrator.