#!/usr/bin/env python3
"""HomePilot Linux media agent using the HASS.Agent MQTT media protocol."""
from __future__ import annotations

import argparse
import json
import logging
import re
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import paho.mqtt.client as mqtt

VERSION = "1.0.0"
LOGGER = logging.getLogger("homepilot_linux_agent")


@dataclass(frozen=True)
class Config:
    device_name: str
    mqtt_host: str
    mqtt_port: int
    mqtt_username: str
    mqtt_password: str
    mqtt_ca: str | None
    poll_interval_seconds: float

    @classmethod
    def from_file(cls, path: Path) -> "Config":
        payload = json.loads(path.read_text(encoding="utf-8"))
        required = ("device_name", "mqtt_host", "mqtt_username", "mqtt_password")
        missing = [key for key in required if not isinstance(payload.get(key), str) or not payload[key].strip()]
        if missing:
            raise ValueError(f"Missing required configuration: {', '.join(missing)}")
        name = payload["device_name"]
        if not re.fullmatch(r"[A-Za-z0-9_-]+", name):
            raise ValueError("device_name must contain only letters, numbers, underscores, or hyphens")
        port = int(payload.get("mqtt_port", 1883))
        if not 1 <= port <= 65535:
            raise ValueError("mqtt_port must be between 1 and 65535")
        interval = float(payload.get("poll_interval_seconds", 2))
        if interval < 1 or interval > 30:
            raise ValueError("poll_interval_seconds must be between 1 and 30")
        ca = payload.get("mqtt_ca")
        return cls(name, payload["mqtt_host"], port, payload["mqtt_username"], payload["mqtt_password"], ca, interval)


class LinuxMediaAgent:
    def __init__(self, config: Config) -> None:
        self.config = config
        self.device_topic = f"hass.agent/devices/{config.device_name}"
        self.state_topic = f"hass.agent/media_player/{config.device_name}/state"
        self.command_topic = f"hass.agent/media_player/{config.device_name}/cmd"
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"homepilot-linux-{config.device_name}")
        self.client.username_pw_set(config.mqtt_username, config.mqtt_password)
        if config.mqtt_ca:
            self.client.tls_set(ca_certs=config.mqtt_ca)
        self.client.will_set(f"homepilot/linux/{config.device_name}/availability", "offline", qos=1, retain=True)
        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message

    @staticmethod
    def _run(*args: str) -> str | None:
        try:
            result = subprocess.run(args, check=True, capture_output=True, text=True, timeout=5)
        except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
            return None
        return result.stdout.strip()

    def _players(self) -> list[str]:
        output = self._run("playerctl", "-l")
        return [line.strip() for line in output.splitlines()] if output else []

    def _active_player(self) -> str | None:
        players = self._players()
        for desired_status in ("Playing", "Paused"):
            for player in players:
                if self._run("playerctl", "--player", player, "status") == desired_status:
                    return player
        return players[0] if players else None

    def _audio_state(self) -> tuple[int, bool]:
        volume = self._run("pactl", "get-sink-volume", "@DEFAULT_SINK@") or ""
        muted = self._run("pactl", "get-sink-mute", "@DEFAULT_SINK@") or ""
        match = re.search(r"(\d+)%", volume)
        return (int(match.group(1)) if match else 0, "yes" in muted.lower())

    def _snapshot(self) -> dict[str, Any]:
        volume, muted = self._audio_state()
        player = self._active_player()
        empty = {
            "state": "idle", "volume": volume, "muted": muted,
            "albumartist": "", "albumtitle": "", "artist": "", "title": "",
            "duration": 0, "currentposition": 0,
        }
        if not player:
            return empty
        status = (self._run("playerctl", "--player", player, "status") or "Idle").lower()
        metadata = self._run(
            "playerctl", "--player", player, "metadata",
            "--format", "{{title}}\t{{artist}}\t{{album}}\t{{mpris:length}}",
        ) or ""
        title, artist, album, duration_us = (metadata.split("\t") + ["", "", "", ""])[:4]
        position = self._run("playerctl", "--player", player, "position") or "0"
        try:
            duration = round(int(duration_us) / 1_000_000, 3)
        except ValueError:
            duration = 0
        try:
            current_position = round(float(position), 3)
        except ValueError:
            current_position = 0
        return {
            "state": status if status in {"playing", "paused", "idle", "off"} else "idle",
            "volume": volume, "muted": muted, "albumartist": artist, "albumtitle": album,
            "artist": artist, "title": title, "duration": duration, "currentposition": current_position,
        }

    def _publish_device(self) -> None:
        machine_id_path = Path("/etc/machine-id")
        serial_number = machine_id_path.read_text(encoding="utf-8").strip() if machine_id_path.exists() else self.config.device_name
        payload = {
            "device": {
                "name": self.config.device_name,
                "manufacturer": "HomePilot",
                "model": "Linux Media Agent",
                "sw_version": VERSION,
            },
            "serial_number": serial_number,
            "apis": {"notifications": False, "media_player": True},
        }
        self.client.publish(self.device_topic, json.dumps(payload), qos=1, retain=True)

    def _publish_state(self) -> None:
        self.client.publish(self.state_topic, json.dumps(self._snapshot()), qos=0, retain=False)

    def _on_connect(self, client: mqtt.Client, userdata: Any, flags: Any, reason_code: Any, properties: Any) -> None:
        if reason_code != 0:
            LOGGER.error("MQTT connection refused: %s", reason_code)
            return
        LOGGER.info("Connected to MQTT broker")
        client.publish(f"homepilot/linux/{self.config.device_name}/availability", "online", qos=1, retain=True)
        client.subscribe(self.command_topic, qos=1)
        self._publish_device()
        self._publish_state()

    def _with_player(self, action: str, argument: str | None = None) -> None:
        player = self._active_player()
        if not player:
            LOGGER.warning("Ignoring %s because no MPRIS player is available", action)
            return
        command = ["playerctl", "--player", player, action]
        if argument is not None:
            command.append(argument)
        if self._run(*command) is None:
            LOGGER.warning("playerctl rejected %s", action)

    def _handle_command(self, payload: dict[str, Any]) -> None:
        command = payload.get("command")
        data = payload.get("data")
        if command in {"play", "pause", "stop", "next", "previous"}:
            self._with_player(command)
        elif command == "seek":
            try:
                self._with_player("position", str(float(data)))
            except (TypeError, ValueError):
                LOGGER.warning("Ignoring invalid seek payload")
        elif command == "setvolume":
            try:
                level = max(0, min(100, round(float(data))))
            except (TypeError, ValueError):
                LOGGER.warning("Ignoring invalid volume payload")
                return
            self._run("pactl", "set-sink-volume", "@DEFAULT_SINK@", f"{level}%")
        elif command == "volumeup":
            self._run("pactl", "set-sink-volume", "@DEFAULT_SINK@", "+5%")
        elif command == "volumedown":
            self._run("pactl", "set-sink-volume", "@DEFAULT_SINK@", "-5%")
        elif command == "mute":
            if not isinstance(data, bool):
                LOGGER.warning("Ignoring invalid mute payload")
                return
            self._run("pactl", "set-sink-mute", "@DEFAULT_SINK@", "1" if data else "0")
        else:
            LOGGER.warning("Ignoring unsupported command: %r", command)
            return
        self._publish_state()

    def _on_message(self, client: mqtt.Client, userdata: Any, message: mqtt.MQTTMessage) -> None:
        try:
            payload = json.loads(message.payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            LOGGER.warning("Ignoring malformed MQTT command")
            return
        if isinstance(payload, dict):
            self._handle_command(payload)

    def run(self) -> None:
        self.client.connect(self.config.mqtt_host, self.config.mqtt_port, keepalive=30)
        self.client.loop_start()
        try:
            while True:
                self._publish_state()
                time.sleep(self.config.poll_interval_seconds)
        finally:
            self.client.publish(f"homepilot/linux/{self.config.device_name}/availability", "offline", qos=1, retain=True)
            self.client.loop_stop()
            self.client.disconnect()


def main() -> int:
    parser = argparse.ArgumentParser(description="HomePilot Linux media MQTT agent")
    parser.add_argument("--config", required=True, type=Path)
    args = parser.parse_args()
    if not shutil.which("playerctl") or not shutil.which("pactl"):
        print("playerctl and pactl are required. Install the distribution packages before starting the agent.", file=sys.stderr)
        return 2
    try:
        config = Config.from_file(args.config)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Invalid configuration: {error}", file=sys.stderr)
        return 2
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    LinuxMediaAgent(config).run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())