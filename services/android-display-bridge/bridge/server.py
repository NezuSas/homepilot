"""Authenticated, small HTTP boundary for the Android Display bridge."""

import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import re
from typing import Callable
from urllib.parse import urlsplit

from .adb_transport import TransportError
from .service import BridgeError, DisplayBridge, transport_error_to_bridge


def _unique_object(pairs: list[tuple[str, object]]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON field")
        result[key] = value
    return result


def handler_for(service: DisplayBridge) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"
        server_version = "HomePilotDisplayBridge"
        sys_version = ""

        def log_message(self, format: str, *args: object) -> None:
            # Do not log URLs, tokens, payloads, ADB output or subprocess argv.
            return

        def _json(self, status: int, payload: dict) -> None:
            encoded = json.dumps(payload, separators=(",", ":")).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)

        def _authenticated(self) -> bool:
            given = self.headers.get("X-HomePilot-Bridge-Token", "")
            expected = service.config.token
            if not hmac.compare_digest(given.encode("utf-8"), expected.encode("utf-8")):
                self._json(401, {"error": "UNAUTHORIZED"})
                return False
            return True

        def _path(self) -> str:
            parsed = urlsplit(self.path)
            if parsed.query or parsed.fragment:
                raise BridgeError("INVALID_PATH", 400)
            return parsed.path

        def _body(self, keys: set[str]) -> dict:
            if self.headers.get("Content-Type", "").split(";")[0].strip().lower() != "application/json":
                raise BridgeError("INVALID_CONTENT_TYPE", 415)
            try:
                size = int(self.headers.get("Content-Length", ""))
            except ValueError as error:
                raise BridgeError("INVALID_BODY", 400) from error
            if size < 2 or size > 4096:
                raise BridgeError("INVALID_BODY", 400)
            try:
                value = json.loads(self.rfile.read(size), object_pairs_hook=_unique_object)
            except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
                raise BridgeError("INVALID_BODY", 400) from error
            if type(value) is not dict or set(value) != keys:
                raise BridgeError("INVALID_BODY", 400)
            return value

        def do_GET(self) -> None:
            def operation() -> tuple[int, dict]:
                path = self._path()
                if path == "/health":
                    return 200, {"status": "ok"}
                if not self._authenticated():
                    return 0, {}
                match = re.fullmatch(r"/internal/v1/displays/([0-9a-f-]{36})/(state|inspect)", path)
                if not match:
                    raise BridgeError("NOT_FOUND", 404)
                if match.group(2) == "state":
                    return 200, service.state(match.group(1))
                return 200, service.inspect(match.group(1))

            self._dispatch(operation)

        def do_POST(self) -> None:
            def operation() -> tuple[int, dict]:
                path = self._path()
                if not self._authenticated():
                    return 0, {}
                if path == "/internal/v1/displays/connect":
                    body = self._body({"sourceId", "host", "port"})
                    return 200, service.connect(body["sourceId"], body["host"], body["port"])
                match = re.fullmatch(r"/internal/v1/displays/([0-9a-f-]{36})/actions", path)
                if not match:
                    raise BridgeError("NOT_FOUND", 404)
                body = self._body({"name", "params"})
                return 200, service.execute(match.group(1), body["name"], body["params"])

            self._dispatch(operation)

        def do_DELETE(self) -> None:
            def operation() -> tuple[int, dict]:
                path = self._path()
                if not self._authenticated():
                    return 0, {}
                match = re.fullmatch(r"/internal/v1/displays/([0-9a-f-]{36})/connection", path)
                if not match:
                    raise BridgeError("NOT_FOUND", 404)
                return 200, service.disconnect(match.group(1))

            self._dispatch(operation)

        def _dispatch(self, operation: Callable[[], tuple[int, dict]]) -> None:
            # _authenticated writes its own response; avoid sending a second one.
            try:
                status, payload = operation()
                if status:
                    self._json(status, payload)
            except BridgeError as error:
                self._json(error.status, {"error": error.code})
            except TransportError as error:
                safe = transport_error_to_bridge(error)
                self._json(safe.status, {"error": safe.code})
            except Exception:
                self._json(500, {"error": "INTERNAL_ERROR"})

    return Handler


def serve(service: DisplayBridge, host: str, port: int) -> None:
    server = ThreadingHTTPServer((host, port), handler_for(service))
    server.daemon_threads = True
    server.serve_forever()
