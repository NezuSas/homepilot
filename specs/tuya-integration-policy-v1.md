# Tuya Integration Policy V1

## Status

HomePilot does not provide a direct Tuya Cloud integration. Tuya devices are supported when they are integrated into Home Assistant and imported through the Home Assistant bridge.

## Supported flow

1. The installer connects the customer's Tuya account or devices in Home Assistant.
2. HomePilot discovers the eligible Home Assistant entities.
3. The operator imports selected entities into HomePilot inventory and assigns them to homes and rooms.
4. HomePilot controls the imported device through the existing Home Assistant device driver.

## Out of scope

- Tuya Cloud credentials, project keys, QR authorization, or account linking in HomePilot.
- Direct Tuya API routes, storage, drivers, or device discovery.

## Acceptance criteria

- The system navigation has no direct Tuya settings page.
- The API exposes no `/api/v1/integrations/tuya` routes.
- Existing devices sourced from Home Assistant, including Tuya curtains, retain their `home_assistant` integration source and remain controllable through the bridge.
- New Tuya devices enter HomePilot through the same discovery and import flow used for other Home Assistant devices.