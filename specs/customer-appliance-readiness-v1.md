# SPEC: Customer Appliance Readiness V1

**Status:** In progress
**Date:** 2026-08-26

## Goal

Make HomePilot deployment reproducible for a customer Linux mini-PC and provide a technician with one documented verification path for the appliance, Windows target PCs, and Linux target PCs.

## Scope

- Document the supported installation topologies and test environments.
- Provide a non-destructive preflight/checklist script for PC integration prerequisites.
- Document Windows HASS.Agent and Linux HomePilot Linux Agent installation, operation, removal, and verification.
- Provide opt-in production MQTT provisioning with credentials and ACLs per target PC.

## Non-goals

- Expose the development MQTT broker to the LAN.
- Automate BIOS/UEFI Wake-on-LAN settings.
- Provide remote shutdown, arbitrary command execution, notifications, or Linux sensors.

## Acceptance criteria

- [x] A technician can distinguish the supported test environments from the customer topology.
- [x] A preflight command reports missing mini-PC and target-PC prerequisites without changing services.
- [x] The deployment guide contains exact install, status, log, and removal commands for Linux agents.
- [x] The guide contains exact Windows HASS.Agent validation steps.
- [x] An opt-in MQTT Compose profile requires credentials and per-device ACLs; it does not reuse the anonymous development broker.
- [x] The guide distinguishes Wi-Fi media control from wired, validated Wake-on-LAN and does not promise remote power for laptops.
- [x] The guide contains a repeatable A/B/C example with one mini-PC and independent Windows and Linux target-PC identities.
