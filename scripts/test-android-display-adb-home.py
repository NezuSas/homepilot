"""Privileged ADB home filesystem regressions without sudo or real key material."""

import importlib.util
from pathlib import Path
import stat
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).with_name("lib") / "android-display-adb-home.py"
sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location("android_display_adb_home", SCRIPT)
assert SPEC and SPEC.loader
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


class FakeFilesystem:
    def __init__(self):
        self.root = Path("/appliance")
        self.entries = {
            str(self.root / "data"): [stat.S_IFDIR, 1000, 1000, 0o775, 0],
            str(self.root / "data/android-display"): [stat.S_IFDIR, 1000, 1000, 0o775, 0],
        }
        self.actions = []

    def put(self, relative, kind, owner, mode, size=1):
        self.entries[str(self.root / relative)] = [kind, owner, owner, mode, size]

    def metadata(self, path):
        entry = self.entries.get(str(path))
        if entry is None:
            return None
        kind, uid, gid, mode, size = entry
        return SimpleNamespace(st_mode=kind | mode, st_uid=uid, st_gid=gid, st_size=size)

    def mkdir(self, path, mode=0o777):
        self.actions.append(("mkdir", str(path)))
        self.entries[str(path)] = [stat.S_IFDIR, 0, 0, mode, 0]

    def chown(self, path, uid, gid, **_kwargs):
        self.actions.append(("chown", str(path)))
        self.entries[str(path)][1:3] = [uid, gid]

    def chmod(self, path, mode, **_kwargs):
        self.actions.append(("chmod", str(path)))
        self.entries[str(path)][3] = mode


class AdbHomePreparationTests(unittest.TestCase):
    def setUp(self):
        self.fs = FakeFilesystem()
        self.patches = [
            patch.object(module, "metadata", self.fs.metadata),
            patch.object(Path, "mkdir", lambda path, mode=0o777: self.fs.mkdir(path, mode)),
            patch.object(module.os, "chown", self.fs.chown, create=True),
            patch.object(module.os, "chmod", self.fs.chmod),
        ]
        for item in self.patches:
            item.start()
            self.addCleanup(item.stop)

    def prepare(self):
        module.prepare(self.fs.root, 1000, 1000)

    def existing_keys(self):
        self.fs.put("data/android-display/adb-home", stat.S_IFDIR, 10001, 0o700)
        self.fs.put("data/android-display/adb-home/.android", stat.S_IFDIR, 10001, 0o700)
        self.fs.put("data/android-display/adb-home/.android/adbkey", stat.S_IFREG, 10001, 0o600)
        self.fs.put("data/android-display/adb-home/.android/adbkey.pub", stat.S_IFREG, 10001, 0o644)

    def test_new_install_creates_only_missing_protected_directories(self):
        self.prepare()
        self.assertEqual([action[0] for action in self.fs.actions],
                         ["mkdir", "chown", "chmod", "mkdir", "chown", "chmod"])
        for relative in ("data/android-display/adb-home", "data/android-display/adb-home/.android"):
            entry = self.fs.entries[str(self.fs.root / relative)]
            self.assertEqual(entry[1:4], [10001, 10001, 0o700])
        self.assertNotIn(str(self.fs.root / "data/android-display/adb-home/.android/adbkey"), self.fs.entries)

    def test_entire_structure_missing_creates_parents_for_installer(self):
        self.fs.entries.clear()
        self.prepare()
        for relative in ("data", "data/android-display"):
            entry = self.fs.entries[str(self.fs.root / relative)]
            self.assertEqual(entry[1:4], [1000, 1000, 0o775])
        for relative in ("data/android-display/adb-home", "data/android-display/adb-home/.android"):
            entry = self.fs.entries[str(self.fs.root / relative)]
            self.assertEqual(entry[1:4], [10001, 10001, 0o700])

    def test_existing_protected_identity_is_untouched_across_runs(self):
        self.existing_keys()
        before = {key: value.copy() for key, value in self.fs.entries.items()}
        self.prepare()
        self.prepare()
        self.assertEqual(self.fs.entries, before)
        self.assertEqual(self.fs.actions, [])

    def test_public_key_mode_0600_is_allowed(self):
        self.existing_keys()
        self.fs.entries[str(self.fs.root / "data/android-display/adb-home/.android/adbkey.pub")][3] = 0o600
        self.prepare()
        self.assertEqual(self.fs.actions, [])

    def test_partial_identity_fails_without_regeneration(self):
        self.existing_keys()
        del self.fs.entries[str(self.fs.root / "data/android-display/adb-home/.android/adbkey.pub")]
        with self.assertRaisesRegex(module.AdbHomeError, "Incomplete ADB identity"):
            self.prepare()
        self.assertEqual(self.fs.actions, [])

    def test_symlink_is_rejected(self):
        self.existing_keys()
        self.fs.put("data/android-display/adb-home/.android", stat.S_IFLNK, 10001, 0o700)
        with self.assertRaisesRegex(module.AdbHomeError, "symlinked"):
            self.prepare()
        self.assertEqual(self.fs.actions, [])

    def test_symlinked_parent_is_rejected(self):
        self.fs.put("data/android-display", stat.S_IFLNK, 1000, 0o775)
        with self.assertRaisesRegex(module.AdbHomeError, "symlinked"):
            self.prepare()
        self.assertEqual(self.fs.actions, [])

    def test_unsafe_key_mode_is_rejected(self):
        self.existing_keys()
        self.fs.entries[str(self.fs.root / "data/android-display/adb-home/.android/adbkey")][3] = 0o644
        with self.assertRaisesRegex(module.AdbHomeError, "Unsafe or invalid ADB identity"):
            self.prepare()
        self.assertEqual(self.fs.actions, [])

    def test_permission_error_is_not_treated_as_missing(self):
        self.existing_keys()
        original = self.fs.metadata

        def denied(path):
            if path.name == ".android":
                raise PermissionError("EACCES")
            return original(path)

        with patch.object(module, "metadata", denied):
            with self.assertRaises(PermissionError):
                self.prepare()
        self.assertEqual(self.fs.actions, [])


if __name__ == "__main__":
    unittest.main()
