# Assistant Climate Command Capabilities V1

**Status:** Implemented

## Purpose

Enable safe, capability-validated climate control from HomePilot assistant paths without turning read-only sensors into controllable devices.

## Scope

- Climate commands: `turn_on`, `turn_off`, `toggle`, `set_temperature`, `set_hvac_mode`, and `set_fan_mode`.
- Parameter validation before a command reaches a device driver.
- Native Home Assistant climate-service mapping.
- Deterministic fast-path recognition for an explicit named climate device and numeric temperature.
- English and Spanish intent schema guidance for semantic interpretation.

## Out of scope

- Generic sensor write commands.
- Per-device HVAC mode or fan-mode discovery; Home Assistant remains the authority for accepted values.
- Planner V2 execution-default promotion, which is governed by `assistant-planner-v2-production-rollout-v1`.

## Functional requirements

- FR-01: A climate capability exposes only the supported climate commands and requires a numeric `temperature` for `set_temperature`.
- FR-02: `set_hvac_mode` and `set_fan_mode` require non-empty string parameters.
- FR-03: `sensor` and `binary_sensor` capabilities remain commandless and are rejected by the capability validator.
- FR-04: The Home Assistant driver maps climate commands to the `climate` domain and preserves required service data.
- FR-05: The deterministic assistant fast path resolves an explicit, unambiguous climate-device temperature request and carries its parameter through authorized execution.
- FR-06: Semantic intent guidance includes the climate command vocabulary; invalid commands or parameters never execute.

## Acceptance criteria

- AC-01: Valid climate requests pass capability validation; missing or malformed required parameters fail.
- AC-02: Sensor and binary-sensor write attempts fail validation.
- AC-03: Home Assistant receives the expected climate service and payload for every supported climate command.
- AC-04: An unambiguous request such as `pon Aire Sala a 22 grados` produces `set_temperature` with `temperature: 22`.
- AC-05: Existing non-climate command behavior remains unchanged.