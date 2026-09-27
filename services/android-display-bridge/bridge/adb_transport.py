"""ADB process boundary. All argv are built from fixed templates, never shell text."""

import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from .config import verify_adb_home, verify_adb_identity


class TransportError(Exception):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


@dataclass(frozen=True)
class Result:
    returncode: int
    stdout: str = ""
    stderr: str = ""


class Runner(Protocol):
    def run(self, argv: list[str], timeout: float) -> Result: ...


class SubprocessRunner:
    def __init__(self, home: Path):
        self.home = home

    def run(self, argv: list[str], timeout: float) -> Result:
        import os

        env = os.environ.copy()
        for name in ("ADB_SERVER_SOCKET", "ANDROID_ADB_SERVER_PORT", "ADB_VENDOR_KEYS"):
            env.pop(name, None)
        env["HOME"] = str(self.home)
        try:
            proc = subprocess.run(argv, capture_output=True, text=True, timeout=timeout,
                                  check=False, shell=False, env=env)
        except subprocess.TimeoutExpired as error:
            raise TransportError("ADB_TIMEOUT") from error
        except OSError as error:
            raise TransportError("ADB_UNAVAILABLE") from error
        return Result(proc.returncode, proc.stdout[:8192], proc.stderr[:8192])


class AdbTransport:
    def __init__(self, runner: Runner):
        self.runner = runner

    def start(self, home: Path) -> None:
        verify_adb_home(home)
        version = self.runner.run(["adb", "version"], 3)
        if version.returncode or "29.0.6" not in version.stdout:
            raise TransportError("ADB_VERSION_MISMATCH")
        private_key = home / ".android" / "adbkey"
        public_key = home / ".android" / "adbkey.pub"
        if private_key.is_symlink() or public_key.is_symlink():
            raise TransportError("ADB_IDENTITY_INVALID")
        if not private_key.exists() and not public_key.exists():
            if self.runner.run(["adb", "keygen", str(private_key)], 10).returncode:
                raise TransportError("ADB_IDENTITY_INVALID")
        # An incomplete existing identity must never be silently replaced.
        verify_adb_identity(home)
        derived = self.runner.run(["adb", "pubkey", str(private_key)], 5)
        if derived.returncode:
            raise TransportError("ADB_IDENTITY_INVALID")
        try:
            stored_key = public_key.read_text(encoding="ascii").split()[0]
            derived_key = derived.stdout.split()[0]
        except (OSError, UnicodeError, IndexError) as error:
            raise TransportError("ADB_IDENTITY_INVALID") from error
        if len(stored_key) < 128 or stored_key != derived_key:
            raise TransportError("ADB_IDENTITY_INVALID")
        if self.runner.run(["adb", "start-server"], 5).returncode:
            raise TransportError("ADB_UNAVAILABLE")

    def _run(self, argv: list[str], timeout: float = 3) -> str:
        result = self.runner.run(argv, timeout)
        if result.returncode:
            raise TransportError("ADB_COMMAND_FAILED")
        return result.stdout.strip()

    def connection_state(self, serial: str) -> str:
        result = self.runner.run(["adb", "-s", serial, "get-state"], 2)
        if result.returncode == 0 and result.stdout.strip() == "device":
            return "online"
        if "unauthorized" in (result.stdout + result.stderr).lower():
            return "needs_authorization"
        return "offline"

    def connected(self, serial: str) -> bool:
        return self.connection_state(serial) == "online"

    def connect(self, serial: str) -> str:
        for _ in range(2):
            try:
                state = self.connection_state(serial)
            except TransportError:
                state = "offline"
            if state in ("online", "needs_authorization"):
                return state
            try:
                self._run(["adb", "connect", serial], 4)
            except TransportError:
                pass
        try:
            return self.connection_state(serial)
        except TransportError:
            return "offline"

    def inspect(self, serial: str) -> dict[str, str | None]:
        if not self.connected(serial):
            raise TransportError("ADB_OFFLINE")
        probes = {
            "adbSerial": ["get-serialno"],
            "androidId": ["shell", "settings", "get", "secure", "android_id"],
            "manufacturer": ["shell", "getprop", "ro.product.manufacturer"],
            "model": ["shell", "getprop", "ro.product.model"],
            "androidVersion": ["shell", "getprop", "ro.build.version.release"],
            "resolution": ["shell", "wm", "size"],
            "density": ["shell", "wm", "density"],
            "screenState": ["shell", "dumpsys", "power"],
        }
        data: dict[str, str | None] = {}
        for field, args in probes.items():
            try:
                raw = self._run(["adb", "-s", serial, *args], 3)
                if field == "screenState":
                    match = re.search(r"mWakefulness=(Awake|Asleep|Dozing)", raw)
                    data[field] = match.group(1).lower() if match else None
                elif field in ("resolution", "density"):
                    match = re.search(r"(?:Physical|Override) (?:size|density): ([0-9x]+)", raw)
                    data[field] = match.group(1) if match else None
                else:
                    value = raw[:128].strip()
                    data[field] = value if value and value.lower() not in ("null", "unknown") else None
            except TransportError:
                data[field] = None
        return data

    def execute(self, serial: str, name: str, params: dict) -> None:
        if not self.connected(serial):
            raise TransportError("ADB_OFFLINE")
        keycodes = {"wake": "224", "sleep": "223", "navigate_home": "3", "navigate_back": "4"}
        if name in keycodes:
            self._run(["adb", "-s", serial, "shell", "input", "keyevent", keycodes[name]], 5)
            return
        if name == "volume_set":
            percent = params["volume"]
            raw = self._run(["adb", "-s", serial, "shell", "media", "volume", "--stream", "3", "--get"], 4)
            match = re.search(r"in range \[([0-9]+)\.\.([0-9]+)\]", raw)
            if not match:
                raise TransportError("ADB_VOLUME_RANGE_UNKNOWN")
            minimum, maximum = map(int, match.groups())
            if maximum <= minimum:
                raise TransportError("ADB_VOLUME_RANGE_UNKNOWN")
            level = minimum + round((maximum - minimum) * percent / 100)
            output = self._run(["adb", "-s", serial, "shell", "media", "volume", "--stream", "3", "--set", str(level)], 5)
            if "Error:" in output:
                raise TransportError("ADB_COMMAND_FAILED")
            return
        raise TransportError("ACTION_UNSUPPORTED")
