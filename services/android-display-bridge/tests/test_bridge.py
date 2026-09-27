"""Fase 1 regression tests; no Docker daemon or Android hardware required."""

import http.client
import ipaddress
import json
import os
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
from http.server import ThreadingHTTPServer

from bridge.adb_transport import AdbTransport, Result, TransportError
from bridge.config import Config, verify_adb_home, verify_adb_identity
from bridge.server import handler_for
from bridge.service import BridgeError, DisplayBridge


SOURCE = "123e4567-e89b-42d3-a456-426614174000"
TOKEN = "t" * 40


def config(home: Path | None = None) -> Config:
    return Config(TOKEN, (ipaddress.IPv4Network("192.168.1.0/24"),),
                  home or Path("/var/lib/homepilot-display-adb"), "0.0.0.0", 5002)


class FakeTransport:
    def __init__(self):
        self.actions = []
        self.state_value = "online"
        self.wait: threading.Event | None = None
        self.entered: threading.Event | None = None

    def connect(self, serial):
        return self.state_value

    def connection_state(self, serial):
        return self.state_value

    def inspect(self, serial):
        return {"adbSerial": serial, "model": None}

    def execute(self, serial, name, params):
        self.actions.append((serial, name, params))
        if self.entered:
            self.entered.set()
        if self.wait:
            self.wait.wait(2)


class ScriptedRunner:
    def __init__(self, callback):
        self.callback = callback
        self.calls = []

    def run(self, argv, timeout):
        self.calls.append((argv, timeout))
        return self.callback(argv, timeout)


class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.transport = FakeTransport()
        self.service = DisplayBridge(config(), self.transport)

    def test_manual_connect_and_endpoint_validation(self):
        self.assertEqual(self.service.connect(SOURCE, "192.168.1.37", 5555)["state"], "online")
        for host, port in (("example.com", 5555), ("127.0.0.1", 5555),
                           ("192.168.2.1", 5555), ("192.168.1.37;id", 5555),
                           ("192.168.1.37", 5037), ("192.168.1.37", True)):
            with self.subTest(host=host, port=port), self.assertRaises(BridgeError):
                self.service.connect(SOURCE, host, port)
        self.assertEqual(self.service.state(SOURCE)["state"], "online")

    def test_actions_are_strictly_semantic(self):
        self.service.connect(SOURCE, "192.168.1.37", 5555)
        for action in ("wake", "lock_screen", "navigate_home", "navigate_back"):
            self.service.execute(SOURCE, action, {})
        self.service.execute(SOURCE, "volume_set", {"volume": 50})
        self.assertEqual(len(self.transport.actions), 5)
        for action in ("sleep", "power_toggle", "shell", "open_url", "launch_app", "show_dashboard", "reboot", "adb/execute"):
            with self.subTest(action=action), self.assertRaises(BridgeError):
                self.service.execute(SOURCE, action, {})
        for params in ({"volume": 101}, {"volume": True}, {"volume": 12, "shell": "id"},
                       {"volume": "50"}, {}):
            with self.subTest(params=params), self.assertRaises(BridgeError):
                self.service.execute(SOURCE, "volume_set", params)
        with self.assertRaises(BridgeError):
            self.service.execute(SOURCE, "wake", {"shell": "id"})

    def test_per_display_lock_and_global_capacity(self):
        self.service.connect(SOURCE, "192.168.1.37", 5555)
        self.transport.wait = threading.Event()
        self.transport.entered = threading.Event()
        thread = threading.Thread(target=self.service.execute, args=(SOURCE, "wake", {}))
        thread.start()
        try:
            self.assertTrue(self.transport.entered.wait(1))
            with self.assertRaises(BridgeError) as error:
                self.service.execute(SOURCE, "lock_screen", {})
            self.assertEqual(error.exception.code, "DISPLAY_BUSY")
        finally:
            self.transport.wait.set()
            thread.join(timeout=2)
        self.assertFalse(thread.is_alive())

        second = "123e4567-e89b-42d3-a456-426614174001"
        limited = DisplayBridge(config(), self.transport, max_concurrent=1)
        limited.connect(SOURCE, "192.168.1.37", 5555)
        limited.connect(second, "192.168.1.38", 5555)
        self.transport.wait.clear()
        self.transport.entered.clear()
        thread = threading.Thread(target=limited.execute, args=(SOURCE, "wake", {}))
        thread.start()
        try:
            self.assertTrue(self.transport.entered.wait(1))
            with self.assertRaises(BridgeError) as error:
                limited.execute(second, "wake", {})
            self.assertEqual(error.exception.code, "BRIDGE_BUSY")
        finally:
            self.transport.wait.set()
            thread.join(timeout=2)


class AdbTranslationTests(unittest.TestCase):
    def test_keycodes_are_fixed_and_never_shell_interpolated(self):
        runner = ScriptedRunner(lambda argv, timeout: Result(0, "device" if argv[-1] == "get-state" else ""))
        transport = AdbTransport(runner)
        for name, key in (("wake", "224"), ("lock_screen", "223"),
                          ("navigate_home", "3"), ("navigate_back", "4")):
            transport.execute("192.168.1.37:5555", name, {})
            self.assertEqual(runner.calls[-1][0],
                             ["adb", "-s", "192.168.1.37:5555", "shell", "input", "keyevent", key])
        for unsupported in ("sleep", "power_toggle"):
            with self.subTest(action=unsupported), self.assertRaises(TransportError) as error:
                transport.execute("192.168.1.37:5555", unsupported, {})
            self.assertEqual(error.exception.code, "ACTION_UNSUPPORTED")

    def test_volume_maps_percent_to_device_range(self):
        def respond(argv, timeout):
            if argv[-1] == "get-state":
                return Result(0, "device")
            if argv[-1] == "--get":
                return Result(0, "[V] volume is 5 in range [0..15]")
            return Result(0)

        runner = ScriptedRunner(respond)
        AdbTransport(runner).execute("192.168.1.37:5555", "volume_set", {"volume": 50})
        self.assertEqual(runner.calls[-1][0][-2:], ["--set", "8"])

    def test_timeout_and_adb_errors_are_codes_only(self):
        def timeout(argv, seconds):
            raise TransportError("ADB_TIMEOUT")
        with self.assertRaises(TransportError) as error:
            AdbTransport(ScriptedRunner(timeout)).execute("192.168.1.37:5555", "wake", {})
        self.assertEqual(error.exception.code, "ADB_TIMEOUT")

    def test_inspect_is_partial_and_does_not_return_dumpsys(self):
        def respond(argv, timeout):
            if argv[-1] == "get-state":
                return Result(0, "device")
            if argv[-1] == "ro.product.model":
                return Result(1, stderr="secret adb internals")
            if argv[-1] == "power":
                return Result(0, "some private dump\nmWakefulness=Awake\nother data")
            return Result(0, "data")

        data = AdbTransport(ScriptedRunner(respond)).inspect("192.168.1.37:5555")
        self.assertIsNone(data["model"])
        self.assertEqual(data["screenState"], "awake")
        self.assertNotIn("secret", str(data))
        self.assertNotIn("private dump", str(data))


class AdbIdentityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.home = Path(self.temp.name) / "adb-home"
        self.key_dir = self.home / ".android"
        self.key_dir.mkdir(parents=True)
        self.home.chmod(0o700)
        self.key_dir.chmod(0o700)
        self.public_value = "a" * 128

    def tearDown(self):
        self.temp.cleanup()

    def runner(self):
        def respond(argv, timeout):
            if argv == ["adb", "version"]:
                return Result(0, "Android Debug Bridge version 1.0.41\nVersion 29.0.6-debian")
            if argv[:2] == ["adb", "keygen"]:
                private = Path(argv[2])
                private.write_text("private-test-value")
                private.chmod(0o600)
                public = private.with_name("adbkey.pub")
                public.write_text(self.public_value + " test@display")
                public.chmod(0o644)
                return Result(0)
            if argv[:2] == ["adb", "pubkey"]:
                return Result(0, self.public_value + " test@display\n")
            if argv == ["adb", "start-server"]:
                return Result(0)
            raise AssertionError(f"Unexpected ADB operation: {argv[1]}")
        return ScriptedRunner(respond)

    def test_empty_persistent_volume_bootstraps_before_server_start(self):
        runner = self.runner()
        AdbTransport(runner).start(self.home)
        self.assertTrue((self.key_dir / "adbkey").is_file())
        self.assertTrue((self.key_dir / "adbkey.pub").is_file())
        self.assertEqual([call[0][1] for call in runner.calls],
                         ["version", "keygen", "pubkey", "start-server"])
        self.assertEqual(runner.calls[1][0][2], str(self.key_dir / "adbkey"))
        self.assertNotIn("/root/.android", str(runner.calls))

    def test_existing_and_recreated_bridge_reuse_the_same_identity(self):
        AdbTransport(self.runner()).start(self.home)
        original = (self.key_dir / "adbkey").read_bytes()
        runner = self.runner()
        AdbTransport(runner).start(self.home)
        self.assertEqual((self.key_dir / "adbkey").read_bytes(), original)
        self.assertNotIn("keygen", [call[0][1] for call in runner.calls])

    def test_unwritable_volume_fails_before_adb(self):
        runner = self.runner()
        with patch("bridge.config.os.access", return_value=False):
            with self.assertRaises(ValueError):
                AdbTransport(runner).start(self.home)
        self.assertEqual(runner.calls, [])

    def test_partial_or_mismatched_existing_identity_fails_without_regeneration(self):
        private = self.key_dir / "adbkey"
        private.write_text("existing-private")
        private.chmod(0o600)
        runner = self.runner()
        with self.assertRaises(ValueError):
            AdbTransport(runner).start(self.home)
        self.assertNotIn("keygen", [call[0][1] for call in runner.calls])
        public = self.key_dir / "adbkey.pub"
        public.write_text("b" * 128)
        public.chmod(0o644)
        with self.assertRaises(TransportError) as error:
            AdbTransport(self.runner()).start(self.home)
        self.assertEqual(error.exception.code, "ADB_IDENTITY_INVALID")


class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.transport = FakeTransport()
        cls.service = DisplayBridge(config(), cls.transport)
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), handler_for(cls.service))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def request(self, method, path, body=None, token=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=2)
        headers = {}
        if token is not None:
            headers["X-HomePilot-Bridge-Token"] = token
        if body is not None:
            headers["Content-Type"] = "application/json"
        conn.request(method, path, body=json.dumps(body) if body is not None else None, headers=headers)
        response = conn.getresponse()
        payload = response.read().decode()
        conn.close()
        return response.status, payload

    def test_health_is_anonymous_but_others_require_token(self):
        self.assertEqual(self.request("GET", "/health")[0], 200)
        self.assertEqual(self.request("GET", "/health", token="wrong")[0], 200)
        for token in (None, "wrong"):
            with self.subTest(token=token):
                status, body = self.request("POST", "/internal/v1/displays/connect",
                                            {"sourceId": SOURCE, "host": "192.168.1.37", "port": 5555}, token)
                self.assertEqual(status, 401)
                self.assertNotIn(TOKEN, body)
                self.assertEqual(self.request("GET", f"/internal/v1/displays/{SOURCE}/state", token=token)[0], 401)
                self.assertEqual(self.request("DELETE", f"/internal/v1/displays/{SOURCE}/connection", token=token)[0], 401)

    def test_connect_inspect_action_and_unsupported_paths(self):
        status, _ = self.request("POST", "/internal/v1/displays/connect",
                                 {"sourceId": SOURCE, "host": "192.168.1.37", "port": 5555}, TOKEN)
        self.assertEqual(status, 200)
        self.assertEqual(self.request("GET", f"/internal/v1/displays/{SOURCE}/state", token=TOKEN)[0], 200)
        self.assertEqual(self.request("GET", f"/internal/v1/displays/{SOURCE}/inspect", token=TOKEN)[0], 200)
        self.assertEqual(self.request("POST", f"/internal/v1/displays/{SOURCE}/actions",
                                      {"name": "wake", "params": {}}, TOKEN)[0], 200)
        self.assertEqual(self.request("POST", f"/internal/v1/displays/{SOURCE}/actions",
                                      {"name": "lock_screen", "params": {}}, TOKEN)[0], 200)
        for unsupported in ("sleep", "power_toggle"):
            with self.subTest(action=unsupported):
                self.assertEqual(self.request("POST", f"/internal/v1/displays/{SOURCE}/actions",
                                              {"name": unsupported, "params": {}}, TOKEN)[0], 400)
        self.assertEqual(self.request("POST", "/adb/execute", {"command": "id"}, TOKEN)[0], 404)
        self.assertEqual(self.request("POST", f"/internal/v1/displays/{SOURCE}/actions",
                                      {"name": "shell", "params": {"command": "id"}}, TOKEN)[0], 400)
        self.assertEqual(self.request("POST", f"/internal/v1/displays/{SOURCE}/actions",
                                      {"name": "open_url", "params": {"url": "https://example.com"}}, TOKEN)[0], 400)

    def test_transport_error_does_not_reflect_sensitive_stderr(self):
        original = self.transport.execute
        self.transport.execute = lambda *args: (_ for _ in ()).throw(TransportError("ADB_TIMEOUT"))
        try:
            status, body = self.request("POST", f"/internal/v1/displays/{SOURCE}/actions",
                                        {"name": "wake", "params": {}}, TOKEN)
            self.assertEqual(status, 504)
            self.assertEqual(json.loads(body), {"error": "ADB_TIMEOUT"})
        finally:
            self.transport.execute = original


class ConfigurationTests(unittest.TestCase):
    def test_home_and_key_permissions(self):
        with tempfile.TemporaryDirectory() as temp:
            home = Path(temp) / "adb-home"
            key_dir = home / ".android"
            key_dir.mkdir(parents=True)
            key_dir.chmod(0o700)
            home.chmod(0o700)
            key = key_dir / "adbkey"
            key.write_text("test-only")
            key.chmod(0o600)
            verify_adb_home(home)
            with self.assertRaises(ValueError):
                verify_adb_identity(home)
            public_key = key_dir / "adbkey.pub"
            public_key.write_text("test-public")
            public_key.chmod(0o644)
            verify_adb_identity(home)
            if os.name == "posix":
                key.chmod(0o644)
                with self.assertRaises(ValueError):
                    verify_adb_home(home)

    def test_config_requires_token_cidrs_and_non_root_home(self):
        values = {"HOMEPILOT_DISPLAY_BRIDGE_TOKEN": TOKEN,
                  "HOMEPILOT_DISPLAY_ADB_CIDRS": "192.168.1.0/24",
                  "HOME": "/var/lib/homepilot-display-adb"}
        with patch.dict(os.environ, values):
            self.assertEqual(Config.from_env().cidrs[0].prefixlen, 24)
        with patch.dict(os.environ, values, clear=True):
            os.environ.pop("HOMEPILOT_DISPLAY_BRIDGE_TOKEN")
            with self.assertRaises(ValueError):
                Config.from_env()
        for name, bad in (("HOMEPILOT_DISPLAY_BRIDGE_TOKEN", "short"),
                          ("HOMEPILOT_DISPLAY_ADB_CIDRS", "0.0.0.0/0"),
                          ("HOMEPILOT_DISPLAY_ADB_CIDRS", "169.254.0.0/16"),
                          ("HOME", "/root")):
            with self.subTest(name=name), patch.dict(os.environ, {**values, name: bad}):
                with self.assertRaises(ValueError):
                    Config.from_env()


if __name__ == "__main__":
    unittest.main()
