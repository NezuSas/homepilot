# HomePilot Linux Agent

Linux user-session media agent compatible with the existing Home Assistant HASS.Agent custom integration.

## Target prerequisites

- Linux distribution using systemd.
- Python 3 with `venv` support.
- `playerctl` for MPRIS media control.
- `pactl` from PipeWire-Pulse or PulseAudio for system volume and mute.
- A secure MQTT broker reachable on the customer LAN.
- HASS.Agent custom integration already installed in Home Assistant and MQTT integration configured.

On Debian/Ubuntu:

```bash
sudo apt update
sudo apt install python3-venv playerctl pulseaudio-utils
```

## Installation

Copy this directory to the target Linux user account, then run:

```bash
bash install-linux-agent.sh \
  --mqtt-host 192.168.1.10 \
  --mqtt-username OFFICE-LINUX \
  --device-name OFFICE-LINUX
```

The installer requests the MQTT password without displaying it. It creates a `systemd --user` service and a mode `0600` configuration file.`n`nWhen the HomePilot secure MQTT provisioning script is used, the MQTT username and `--device-name` must be the same device identifier. Create that credential on the mini-PC first with `bash scripts/configure-pc-agent-mqtt.sh add-device --device-name OFFICE-LINUX`.

## Home Assistant discovery

The agent publishes the HASS.Agent-compatible topics:

- `hass.agent/devices/<device>`
- `hass.agent/media_player/<device>/state`
- `hass.agent/media_player/<device>/cmd`

Home Assistant should discover the device through the installed HASS.Agent custom integration. Accept it, then import the resulting media player from HomePilot Discovery.

## Supported controls

Play, pause, stop, previous, next, seek, system volume, volume step, and mute. The agent exposes no arbitrary shell commands, shutdown, restart, lock, notifications, or sensors in v1.