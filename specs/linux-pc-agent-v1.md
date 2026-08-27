# HomePilot Linux PC Agent v1

**Estado:** Implementado

## Objective

Provide a Linux user-session agent that exposes one local MPRIS media session as a Home Assistant media player through the existing HASS.Agent MQTT integration.

## Scope

- Linux with systemd user services, Python 3, playerctl, and PipeWire/PulseAudio compatible pactl.
- Secure MQTT connection configuration supplied by the installer.
- Publish HASS.Agent compatible device, media state, and command MQTT topics.
- Control play, pause, stop, next, previous, seek, volume, and mute.
- Provide a user-level installer that creates a restricted local configuration and systemd service.

## Out of scope

- Wake-on-LAN hardware configuration.
- Remote shell, shutdown, reboot, lock, or arbitrary command execution.
- Thumbnail capture, browser automation, notifications, and sensors.
- Automatic production MQTT broker provisioning.

## Acceptance criteria

1. The agent publishes a HASS.Agent compatible device payload with `media_player` enabled.
2. The agent publishes media state every two seconds while connected.
3. The agent accepts only known MQTT media commands and never executes arbitrary payloads.
4. The installer refuses a missing broker host, username, device name, or prerequisite command.
5. The installer writes the configuration with owner-only permissions and enables a systemd user service.
6. The agent works with a selected MPRIS player and falls back to idle state when no player is available.