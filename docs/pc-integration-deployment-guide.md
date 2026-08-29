# PC Integration Deployment Guide

## Purpose

This guide describes how a HomePilot mini-PC can integrate customer computers.
It separates three capabilities that are often confused:

1. **Wake-on-LAN (WoL):** turn on a powered-off computer on the local network.
2. **Windows media and telemetry:** publish media state and optional PC data from a running Windows computer through HASS.Agent and MQTT.
3. **HomePilot control:** import the resulting Home Assistant entities into the customer dashboard.

The mini-PC is the always-on sender and controller. Target computers are separate machines and may be Windows or Linux.

## Supported deployment modes

| Target computer | Remote power | Media/control integration | Required software on target |
|---|---|---|---|
| Windows | Wake-on-LAN | Supported through HASS.Agent and MQTT | HASS.Agent for media/control; none for WoL only |
| Linux | Wake-on-LAN | Supported through HomePilot Linux Agent (MPRIS) | HomePilot Linux Agent for media/control; none for WoL only |

Wake-on-LAN does **not** use MQTT and does not require an agent on the target computer.

## Mini-PC requirements

The customer mini-PC must remain powered on and connected to the same LAN as the target computers. It needs:

- Linux and Docker Compose.
- HomePilot and Home Assistant running locally.
- A stable LAN address or DHCP reservation.
- Ethernet connectivity where practical, especially for reliable LAN broadcast delivery.
- A local MQTT broker only when Windows HASS.Agent integration is requested.

Do not use the mini-PC itself as a Wake-on-LAN target: if it is off, HomePilot and Home Assistant cannot send the packet.

## Wake-on-LAN deployment

### Prepare each target computer

For remote power, record the physical Ethernet MAC address and reserve its IP address in the customer router. A computer that only needs media control does not need an Ethernet MAC or Wake-on-LAN registration.

Windows:

```powershell
Get-NetAdapter -Physical | Format-Table Name, Status, MacAddress, LinkSpeed
```

Enable `Wake on Magic Packet` and `Wake on LAN from shutdown` in the Ethernet adapter. Enable the equivalent `Wake on LAN`, `Wake from S5`, or `Power on by PCI-E` setting in BIOS/UEFI.

Linux:

```bash
ip link
sudo ethtool <interface>
sudo ethtool -s <interface> wol g
```

The motherboard firmware must also support Wake-on-LAN. Wi-Fi wake is not a replacement for physical Ethernet unless the exact hardware explicitly supports it.

### Register the computer

Run this command on the mini-PC from the HomePilot repository:

```bash
bash scripts/configure-wol-devices.sh
```

The menu asks how many computers will be configured and, for every computer, requests:

- display name;
- operating system, used only to show the correct technician instructions;
- Ethernet MAC address;
- stable/reserved local IP address;
- LAN broadcast address and Wake-on-LAN port.

The script stores the local registry in `ha-config/wake-on-lan-devices.tsv`, generates `ha-config/wake-on-lan-switches.yaml`, and provides an option to validate and restart only Home Assistant. It never edits unrelated Home Assistant switches.

After Home Assistant has restarted, import the new switch from HomePilot Discovery and place it on any customer-selected dashboard.

## Wi-Fi and laptop policy

Wi-Fi is fully supported for media metadata and playback controls while a target computer is powered on, connected to the customer LAN, and running its assigned agent. This includes laptops.

Remote power is different. HomePilot guarantees Wake-on-LAN only for a desktop or other target that has all of the following verified: physical Ethernet, a supported network adapter, compatible BIOS/UEFI settings, and a successful off-to-on test from the mini-PC. This is not guaranteed for laptops.

Some laptops advertise Wake-on-Wireless-LAN or wake from sleep. Hardware, drivers, power policy, and firmware determine whether it works, and it commonly fails after a complete shutdown. Treat it as an optional customer-specific experiment, never as a sold or documented remote-power capability. Do not register a Wi-Fi adapter MAC in the Wake-on-LAN script as a replacement for an Ethernet MAC.
## Windows HASS.Agent and MQTT deployment

Use this mode only when the customer wants media metadata, play/pause, volume, notifications, or future Windows sensors in addition to remote power.

### Architecture

```text
Windows PC running HASS.Agent -- MQTT over LAN --> HomePilot mini-PC
                                                   |- MQTT broker
                                                   |- Home Assistant
                                                   `- HomePilot
```

HASS.Agent runs only while Windows is on. It cannot wake a powered-off computer; Wake-on-LAN handles that separate action.

### Broker security requirement

The development configuration may bind MQTT to `127.0.0.1` without credentials because it is used only by services on the same PC. That configuration is **not suitable** for a customer Windows computer on the LAN.

A production MQTT deployment requires all of the following before a remote HASS.Agent is configured:

- broker listener reachable only from the customer LAN or a dedicated VLAN;
- unique non-empty MQTT credentials for that customer installation;
- firewall rules that block WAN/Internet access to MQTT;
- Home Assistant connected internally to the broker;
- documented per-device credentials and rotation procedure.

HomePilot provides an opt-in provisioning script for LAN MQTT credentials and per-device ACLs. Do not expose the current anonymous/local-only development broker to a customer network.

### Configure a Windows PC after the secure broker exists

1. Install HASS.Agent on the Windows PC.
2. Create a Home Assistant long-lived access token for that customer instance; do not paste it into tickets, logs, or source control.
3. In HASS.Agent, use the mini-PC LAN address for the Home Assistant URL and MQTT host, not `localhost`.
4. Set the installation-specific MQTT username and password.
5. Keep TLS disabled only for a local, isolated LAN deployment approved by the installer; otherwise configure certificates before enabling remote access.
6. Enable only the capabilities requested by the customer, such as Media Player.
7. In Home Assistant, configure MQTT and add the HASS.Agent integration; then accept the discovered computer.
8. Import the resulting `media_player` into HomePilot Discovery.

### Diagnóstico y recuperación del broker local de desarrollo

En una estación de desarrollo como OSCAR, HASS.Agent usa `localhost:1883` y el broker local debe ejecutarse como `homepilot-mqtt`. Si HASS.Agent muestra MQTT **conectando** y sensores/comandos detenidos, primero compruebe el servicio; no borre entidades de Home Assistant ni reconfigure credenciales:

```powershell
docker compose -f docker-compose.yml -f docker-compose.ha-companion.desktop.yml ps homepilot-mqtt
npm run verify:mqtt-runtime -- --desktop
```

Si el contenedor está detenido, recupérelo recreando únicamente el broker, con los archivos y volúmenes existentes:

```powershell
docker compose -f docker-compose.yml -f docker-compose.ha-companion.desktop.yml up -d --force-recreate homepilot-mqtt
npm run verify:mqtt-runtime -- --desktop
```

En Linux, este perfil local de desarrollo no se combina con `docker-compose.office.yml`. Una miniPC nueva que deba integrar computadores remotos usa exclusivamente el perfil MQTT seguro: ejecute `bash scripts/configure-pc-agent-mqtt.sh init --ha-username USUARIO` y luego `npm run verify:mqtt-runtime -- --office`. Esta recuperación no usa `down -v`, no elimina `ha-config`, `data/` ni la configuración de HASS.Agent. El broker de desarrollo permanece ligado a `127.0.0.1`; el perfil seguro se provisiona con credenciales y ACL por instalación.

## Linux target computers

HASS.Agent remains Windows-only. Linux media integration is provided by `agents/homepilot-linux-agent`, a systemd user service compatible with MPRIS players and PipeWire/PulseAudio volume control.

Install its prerequisites on the target PC, then run `bash install-linux-agent.sh --mqtt-host <mini-pc-ip> --mqtt-username <customer-user> --device-name <linux-pc-id>`. The installer requests the MQTT password privately, writes a mode `0600` configuration, and enables the user service.

Linux v1 supports play, pause, stop, previous, next, seek, system volume, volume step, and mute. It deliberately does not provide arbitrary commands, shutdown, reboot, lock, notifications, thumbnails, or sensors.

## Technician acceptance checklist

- [ ] The mini-PC remains on after target computers are shut down.
- [ ] Every target computer requesting remote power has a documented Ethernet MAC and DHCP reservation.
- [ ] BIOS/UEFI and Ethernet Wake-on-LAN options are enabled only for targets requesting remote power.
- [ ] Wake-on-LAN switches are registered, Home Assistant validates, and HomePilot imports them.
- [ ] Each Windows HASS.Agent computer is configured only after a secure LAN MQTT broker is available.
- [ ] MQTT has no WAN exposure and uses installation-specific credentials.
- [ ] A power-off and remote wake test succeeds for every target for which remote power is offered.
- [ ] Each laptop or Wi-Fi-only computer is documented as media-control-only; remote power is not promised.
- [ ] Each media-control target is verified on its real network connection, Ethernet or Wi-Fi, while powered on.
## Current installer coverage and customer expectations

The current HomePilot installation is not a one-click fleet manager for customer computers. The following matrix is the authoritative operational boundary.

| Capability | Windows target PC | Linux target PC | Automation status today |
|---|---|---|---|
| HomePilot mini-PC deployment | Not applicable | Not applicable | Covered by the existing HomePilot installation scripts |
| Wake-on-LAN registration in Home Assistant | Supported only with validated wired Ethernet | Supported only with validated wired Ethernet | Covered by `scripts/configure-wol-devices.sh` |
| Wake-on-LAN hardware preparation | BIOS/UEFI and Ethernet driver configuration | BIOS/UEFI and `ethtool` configuration | Technician performs it on each target computer |
| Remote power switch imported into HomePilot | Supported only after a successful wired WoL test | Supported only after a successful wired WoL test | Home Assistant and HomePilot Discovery after the installer reloads HA |
| Media metadata, volume and playback control | Supported over Ethernet or Wi-Fi while the PC is on | Supported over Ethernet or Wi-Fi while the PC is on | Agent installation is currently manual |
| PC sensors, notifications and commands | Supported only when HASS.Agent capabilities are configured | Not implemented in Linux Agent v1 | Agent installation is currently manual |
| Secure MQTT broker exposed to target PCs on LAN | Required for HASS.Agent | Required for Linux media control; not required for WoL-only PCs | Covered by `scripts/configure-pc-agent-mqtt.sh`; Home Assistant MQTT setup remains a technician step |

### What the technician can install today

1. Deploy HomePilot, Home Assistant, and the local services on the customer mini-PC using the existing installation workflow.
2. Run `bash scripts/configure-wol-devices.sh` on that mini-PC to register every Windows or Linux computer that the customer wants to power on remotely.
3. Apply the generated Home Assistant configuration from the script menu and import the resulting switches into HomePilot.
4. When a target PC needs media control, provision MQTT once with `scripts/configure-pc-agent-mqtt.sh init`, create one credential per target PC, then install HASS.Agent on Windows or HomePilot Linux Agent on Linux.

### What must not be promised as automated today

- Automatic HASS.Agent installation or configuration on remote Windows computers.
- Automatic installation of the HomePilot Linux Agent on remote Linux computers.
- Automatic rotation or deletion of secure MQTT credentials for customer networks.
- MQTT access for remote target computers through the current anonymous, localhost-only development broker.

### Future implementation boundary

A future production computer-agent installer must support both target operating systems explicitly:

- **Windows:** provision an approved HASS.Agent package, customer-scoped MQTT credentials, Home Assistant URL, selected capabilities, and discovery validation.
- **Linux:** deploy the specified HomePilot Linux Agent for media controls; separately specify any future sensors, notifications, or system commands. Wake-on-LAN remains available without that agent.
- **All target computers requesting remote power:** preserve the Wake-on-LAN registry, require a wired Ethernet MAC, and verify a successful off-to-on test from the always-on mini-PC.

## Repeatable test plan before a customer installation

The two internal environments have different purposes and both must pass before a customer deployment:

| Environment | Operating system | What it verifies |
|---|---|---|
| Current development computer | Windows | HASS.Agent discovery, Windows media playback, volume control, and Home Assistant/HomePilot synchronization. |
| Office mini-PC | Linux | HomePilot appliance deployment, Home Assistant availability, Linux Agent lifecycle, and a Linux MPRIS media player. |

### 1. Mini-PC preflight

Run from the HomePilot repository on the Linux mini-PC:

```bash
bash scripts/check-pc-integration-readiness.sh --mode mini-pc
bash scripts/homepilot-maintenance.sh --status
```

Both commands are read-only. A failure must be corrected before configuring a remote computer.

### 2. Windows target validation

On the Windows target, verify that HASS.Agent is connected to the customer Home Assistant and MQTT broker, then use an active audio/video application. Confirm in Home Assistant that the discovered PC media player updates title, play/pause state, and volume without user interaction in HomePilot.

Wake-on-LAN must be tested separately: turn the PC off, send the Home Assistant Wake-on-LAN switch, and wait for the PC to become reachable. Do not test this over Wi-Fi; use the documented physical Ethernet MAC.

### 3. Linux target validation

On the Linux target, first run:

```bash
bash scripts/check-pc-integration-readiness.sh --mode linux-target
```

Install the agent only after the secure MQTT broker and credentials are available. After installation, use:

```bash
systemctl --user status homepilot-linux-agent.service
journalctl --user -u homepilot-linux-agent.service -f
```

Start a MPRIS-compatible player such as a browser or VLC. Verify that Home Assistant discovers the device and that title, state, playback controls, volume, mute, and seek work from HomePilot.

To remove a Linux test installation cleanly:

```bash
systemctl --user disable --now homepilot-linux-agent.service
rm -f ~/.config/systemd/user/homepilot-linux-agent.service
rm -rf ~/.config/homepilot-linux-agent
systemctl --user daemon-reload
```

### Deployment decision

The customer mini-PC is ready only when the mini-PC preflight passes and each requested target-PC capability has passed its corresponding test. A Windows-only customer does not require the Linux Agent. A Linux-only customer does not require HASS.Agent. Wake-on-LAN remains independent from both agents.
## Example: mini-PC A with Windows PC B and Linux PC C

This is the repeatable pattern for more than one customer computer. The mini-PC **A** remains powered on and hosts HomePilot, Home Assistant, and the secure MQTT broker. Each target receives an independent identity; target credentials are never shared.

| Machine | Operating system | Requested capabilities | Required configuration |
|---|---|---|---|
| A | Linux mini-PC | HomePilot, Home Assistant, MQTT | Always on, stable LAN IP. |
| B | Windows | Media controls; optional remote power | HASS.Agent with MQTT user `PC-B`; wired Ethernet only if remote power is requested. |
| C | Linux | Media controls; optional remote power | HomePilot Linux Agent with MQTT user/device name `PC-C`; wired Ethernet only if remote power is requested. |

On B, first run `hostname` in PowerShell and use that exact Windows device identifier in the MQTT command below. In this example the hostname is `PC-B`. Linux Agent identifiers are chosen explicitly with `--device-name`. On A, initialize MQTT once and create one credential for every target computer:

```bash
bash scripts/configure-pc-agent-mqtt.sh init --ha-username homeassistant
bash scripts/configure-pc-agent-mqtt.sh add-device --device-name PC-B
bash scripts/configure-pc-agent-mqtt.sh add-device --device-name PC-C
```

Configure the Home Assistant MQTT integration once with A's LAN IP, port `1883`, and the `homeassistant` credential. Do not configure this broker through a public Cloudflare address.

On B, configure HASS.Agent with A's local Home Assistant URL, A's MQTT LAN IP, and the dedicated `PC-B` credentials. Its HASS.Agent discovery identifier must be the same exact value as the Windows hostname used when the credential was created. On C, copy the Linux Agent directory and run:

```bash
bash install-linux-agent.sh \
  --mqtt-host IP_DE_A \
  --mqtt-username PC-C \
  --device-name PC-C
```

Home Assistant discovers B and C separately. Accept each device, then use HomePilot Discovery to import the resulting entities:

- `media_player` for B and C when their corresponding agents are running;
- one Wake-on-LAN switch for B and/or C only if that computer has wired Ethernet and passed the physical wake test.

The customer chooses where to place these entities in HomePilot. Media control works on Wi-Fi while B or C is powered on. Cloudflare is only an access route to the HomePilot web interface; B and C communicate with A locally through MQTT and Wake-on-LAN packets.
## Secure MQTT for remote PC agents

Use this only on the customer Linux mini-PC when one or more Windows HASS.Agent or Linux HomePilot Linux Agent computers will connect over the LAN. It is an opt-in Compose overlay: the default development broker remains local-only and is never reused.

Initialize the secure broker once. Choose a dedicated Home Assistant MQTT username and enter its password when prompted:

```bash
bash scripts/configure-pc-agent-mqtt.sh init --ha-username homeassistant
```

For every target computer, create a distinct credential. The device name is also its MQTT username and must match the Linux Agent `--device-name` or the configured HASS.Agent device name:

```bash
bash scripts/configure-pc-agent-mqtt.sh add-device --device-name OFFICE-LINUX
bash scripts/configure-pc-agent-mqtt.sh status
```

The command writes secrets only to `data/mqtt/` with restrictive permissions. The secure broker accepts no anonymous connection. Each target computer may publish only its own HASS.Agent-compatible discovery and media-state topics, and may read only its own media-control topic. Home Assistant receives read/write access to the `hass.agent/#` namespace.

Configure the Home Assistant MQTT integration with the mini-PC LAN IP, port `1883`, and the Home Assistant username/password created during `init`. Configure the target agent with the mini-PC LAN IP and its own per-device credential. Restrict port 1883 to the customer LAN or dedicated VLAN in the firewall; never publish it to the Internet.
