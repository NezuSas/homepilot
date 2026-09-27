"""Fail-closed runtime configuration and persistent ADB identity checks."""

from dataclasses import dataclass
import ipaddress
import os
from pathlib import Path

PRIVATE_LAN = tuple(ipaddress.IPv4Network(value) for value in (
    "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"
))


@dataclass(frozen=True)
class Config:
    token: str
    cidrs: tuple[ipaddress.IPv4Network, ...]
    home: Path
    bind_host: str
    port: int

    @classmethod
    def from_env(cls) -> "Config":
        token = os.environ.get("HOMEPILOT_DISPLAY_BRIDGE_TOKEN", "")
        if len(token) < 32 or token != token.strip():
            raise ValueError("HOMEPILOT_DISPLAY_BRIDGE_TOKEN must be configured securely")

        raw_cidrs = os.environ.get("HOMEPILOT_DISPLAY_ADB_CIDRS", "")
        if not raw_cidrs or any(not item.strip() for item in raw_cidrs.split(",")):
            raise ValueError("HOMEPILOT_DISPLAY_ADB_CIDRS must be configured")
        cidrs = tuple(ipaddress.IPv4Network(item.strip(), strict=True) for item in raw_cidrs.split(","))
        if not cidrs or any(network.prefixlen < 16 or
                            not any(network.subnet_of(lan) for lan in PRIVATE_LAN)
                            for network in cidrs):
            raise ValueError("ADB CIDRs must be narrow RFC1918 IPv4 networks")

        raw_home = os.environ.get("HOME", "")
        # The container is Linux; validate POSIX paths even when tests run on Windows.
        if raw_home != "/var/lib/homepilot-display-adb":
            raise ValueError("ADB HOME must be the persistent non-root path")
        home = Path(raw_home)
        bind_host = os.environ.get("HOMEPILOT_DISPLAY_BRIDGE_BIND_HOST", "0.0.0.0")
        if bind_host not in ("0.0.0.0", "127.0.0.1"):
            raise ValueError("Invalid internal bind host")
        port = int(os.environ.get("HOMEPILOT_DISPLAY_BRIDGE_PORT", "5002"))
        if not 1 <= port <= 65535:
            raise ValueError("Invalid bridge port")
        return cls(token, cidrs, home, bind_host, port)


def verify_adb_home(home: Path) -> None:
    """Never silently generate the ADB identity in an ephemeral/root home."""
    key_dir = home / ".android"
    if not home.is_dir() or not key_dir.is_dir() or key_dir.is_symlink():
        raise ValueError("Persistent ADB home is not mounted")
    if not os.access(key_dir, os.W_OK):
        raise ValueError("Persistent ADB home is not writable")
    if os.name == "posix":
        for path in (home, key_dir):
            stat = path.stat()
            if stat.st_uid != os.getuid() or stat.st_mode & 0o077 or stat.st_mode & 0o700 != 0o700:
                raise ValueError("Persistent ADB home has unsafe ownership or permissions")
        private_key = key_dir / "adbkey"
        if private_key.exists():
            stat = private_key.stat()
            if private_key.is_symlink() or stat.st_uid != os.getuid() or stat.st_mode & 0o077:
                raise ValueError("ADB private key has unsafe ownership or permissions")


def verify_adb_identity(home: Path) -> None:
    """Check the identity files before ADB loads them; pairing is checked separately."""
    verify_adb_home(home)
    key_dir = home / ".android"
    for name in ("adbkey", "adbkey.pub"):
        key = key_dir / name
        if not key.is_file() or key.is_symlink() or key.stat().st_size == 0:
            raise ValueError("ADB identity missing from persistent HOME")
        if os.name == "posix":
            mode = key.stat().st_mode
            if key.stat().st_uid != os.getuid() or (name == "adbkey" and mode & 0o077) or (name == "adbkey.pub" and mode & 0o022):
                raise ValueError("ADB identity has unsafe permissions")
