"""Bounded, per-display semantic operations over the private ADB transport."""

from contextlib import contextmanager
from dataclasses import dataclass
import ipaddress
import re
import threading
from uuid import UUID

from .adb_transport import AdbTransport, TransportError
from .config import Config


class BridgeError(Exception):
    def __init__(self, code: str, status: int):
        self.code = code
        self.status = status
        super().__init__(code)


@dataclass(frozen=True)
class Source:
    host: str
    port: int

    @property
    def serial(self) -> str:
        return f"{self.host}:{self.port}"


class DisplayBridge:
    ACTIONS = frozenset({"wake", "lock_screen", "navigate_home", "navigate_back", "volume_set"})

    def __init__(self, config: Config, transport: AdbTransport, max_concurrent: int = 4):
        self.config = config
        self.transport = transport
        self._sources: dict[str, Source] = {}
        self._locks: dict[str, threading.Lock] = {}
        self._registry_lock = threading.Lock()
        self._capacity = threading.BoundedSemaphore(max_concurrent)

    @staticmethod
    def source_id(value: object) -> str:
        if not isinstance(value, str):
            raise BridgeError("INVALID_SOURCE_ID", 400)
        try:
            parsed = UUID(value)
        except ValueError as error:
            raise BridgeError("INVALID_SOURCE_ID", 400) from error
        if str(parsed) != value:
            raise BridgeError("INVALID_SOURCE_ID", 400)
        return value

    def validate_endpoint(self, host: object, port: object) -> Source:
        if not isinstance(host, str) or not re.fullmatch(r"[0-9.]{7,15}", host):
            raise BridgeError("INVALID_ADB_ENDPOINT", 400)
        try:
            address = ipaddress.IPv4Address(host)
        except ipaddress.AddressValueError as error:
            raise BridgeError("INVALID_ADB_ENDPOINT", 400) from error
        if not any(address in subnet for subnet in self.config.cidrs):
            raise BridgeError("ADB_ENDPOINT_NOT_ALLOWED", 403)
        if type(port) is not int or port != 5555:
            raise BridgeError("INVALID_ADB_ENDPOINT", 400)
        return Source(str(address), port)

    @contextmanager
    def _operation(self, source_id: str):
        if not self._capacity.acquire(blocking=False):
            raise BridgeError("BRIDGE_BUSY", 429)
        try:
            with self._registry_lock:
                lock = self._locks.get(source_id)
                if lock is None:
                    raise BridgeError("DISPLAY_NOT_CONNECTED", 404)
            if not lock.acquire(blocking=False):
                raise BridgeError("DISPLAY_BUSY", 409)
            try:
                yield
            finally:
                lock.release()
        finally:
            self._capacity.release()

    def connect(self, source_id: object, host: object, port: object) -> dict:
        identifier = self.source_id(source_id)
        endpoint = self.validate_endpoint(host, port)
        with self._registry_lock:
            if identifier not in self._sources and len(self._sources) >= 64:
                raise BridgeError("BRIDGE_CAPACITY_REACHED", 429)
            self._locks.setdefault(identifier, threading.Lock())
        with self._operation(identifier):
            state = self.transport.connect(endpoint.serial)
            with self._registry_lock:
                self._sources[identifier] = endpoint
        return {"sourceId": identifier, "state": state}

    def _source(self, identifier: str) -> Source:
        with self._registry_lock:
            source = self._sources.get(identifier)
        if source is None:
            raise BridgeError("DISPLAY_NOT_CONNECTED", 404)
        return source

    def state(self, source_id: object) -> dict:
        identifier = self.source_id(source_id)
        with self._operation(identifier):
            state = self.transport.connection_state(self._source(identifier).serial)
        return {"sourceId": identifier, "state": state}

    def inspect(self, source_id: object) -> dict:
        identifier = self.source_id(source_id)
        with self._operation(identifier):
            metadata = self.transport.inspect(self._source(identifier).serial)
        return {"sourceId": identifier, "metadata": metadata}

    def execute(self, source_id: object, name: object, params: object) -> dict:
        identifier = self.source_id(source_id)
        if not isinstance(name, str) or name not in self.ACTIONS:
            raise BridgeError("ACTION_UNSUPPORTED", 400)
        if type(params) is not dict:
            raise BridgeError("INVALID_ACTION_PARAMS", 400)
        if name == "volume_set":
            volume = params.get("volume")
            if set(params) != {"volume"} or type(volume) is not int or not 0 <= volume <= 100:
                raise BridgeError("INVALID_ACTION_PARAMS", 400)
        elif params:
            raise BridgeError("INVALID_ACTION_PARAMS", 400)
        with self._operation(identifier):
            self.transport.execute(self._source(identifier).serial, name, params)
        return {"sourceId": identifier, "action": name, "status": "executed"}

    def disconnect(self, source_id: object) -> dict:
        identifier = self.source_id(source_id)
        with self._operation(identifier):
            with self._registry_lock:
                self._sources.pop(identifier, None)
                self._locks.pop(identifier, None)
        return {"sourceId": identifier, "state": "disconnected"}


def transport_error_to_bridge(error: TransportError) -> BridgeError:
    if error.code == "ADB_TIMEOUT":
        return BridgeError("ADB_TIMEOUT", 504)
    if error.code == "ADB_OFFLINE":
        return BridgeError("ADB_OFFLINE", 503)
    if error.code == "ADB_VOLUME_RANGE_UNKNOWN":
        return BridgeError("ADB_VOLUME_RANGE_UNKNOWN", 422)
    return BridgeError("ADB_OPERATION_FAILED", 502)
