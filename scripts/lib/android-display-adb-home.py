#!/usr/bin/env python3
"""Prepare/validate only the persistent Android Display ADB directory as root."""

import os
from pathlib import Path
import stat
import sys


DISPLAY_UID = 10001
DISPLAY_GID = 10001


class AdbHomeError(Exception):
    pass


def metadata(path: Path):
    try:
        return path.lstat()
    except FileNotFoundError:
        return None


def ensure_directory(path: Path, uid: int, gid: int, mode: int) -> None:
    current = metadata(path)
    if current is None:
        # Only a genuinely absent path is created. EACCES and other failures
        # propagate instead of being misread as ENOENT.
        path.mkdir(mode=mode)
        os.chown(path, uid, gid)
        os.chmod(path, mode)
        current = metadata(path)
    if current is None or not stat.S_ISDIR(current.st_mode):
        raise AdbHomeError(f"Invalid or symlinked ADB directory: {path.name}")
    if current.st_uid != uid or current.st_gid != gid or stat.S_IMODE(current.st_mode) != mode:
        raise AdbHomeError(f"Unsafe ADB directory ownership or permissions: {path.name}")


def ensure_parent(path: Path, uid: int, gid: int) -> None:
    current = metadata(path)
    if current is None:
        path.mkdir(mode=0o775)
        os.chown(path, uid, gid)
        os.chmod(path, 0o775)
        current = metadata(path)
    if current is None or not stat.S_ISDIR(current.st_mode):
        raise AdbHomeError(f"Invalid or symlinked appliance directory: {path.name}")


def validate_key(path: Path, allowed_modes: tuple[int, ...]) -> bool:
    current = metadata(path)
    if current is None:
        return False
    if (not stat.S_ISREG(current.st_mode) or current.st_uid != DISPLAY_UID
            or current.st_gid != DISPLAY_GID
            or stat.S_IMODE(current.st_mode) not in allowed_modes
            or current.st_size == 0):
        raise AdbHomeError(f"Unsafe or invalid ADB identity: {path.name}")
    return True


def prepare(root: Path, installer_uid: int, installer_gid: int) -> None:
    data = root / "data"
    ensure_parent(data, installer_uid, installer_gid)
    display = data / "android-display"
    ensure_parent(display, installer_uid, installer_gid)
    home = display / "adb-home"
    ensure_directory(home, DISPLAY_UID, DISPLAY_GID, 0o700)
    key_dir = home / ".android"
    ensure_directory(key_dir, DISPLAY_UID, DISPLAY_GID, 0o700)

    private_present = validate_key(key_dir / "adbkey", (0o600,))
    public_present = validate_key(key_dir / "adbkey.pub", (0o600, 0o644))
    if private_present != public_present:
        raise AdbHomeError("Incomplete ADB identity; existing keys are preserved")


def main() -> int:
    if os.name != "posix" or os.geteuid() != 0 or len(sys.argv) != 2:
        print("ADB home preparation requires a privileged Linux filesystem check", file=sys.stderr)
        return 1
    try:
        prepare(Path(sys.argv[1]), int(os.environ.get("SUDO_UID", "0")),
                int(os.environ.get("SUDO_GID", "0")))
    except (AdbHomeError, OSError, ValueError) as error:
        print(f"ADB home validation failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
