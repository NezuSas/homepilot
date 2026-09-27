"""Container entrypoint; fail closed before opening HTTP."""

import sys

from .adb_transport import AdbTransport, SubprocessRunner, TransportError
from .config import Config
from .server import serve
from .service import DisplayBridge


def main() -> None:
    config = Config.from_env()
    transport = AdbTransport(SubprocessRunner(config.home))
    transport.start(config.home)
    serve(DisplayBridge(config, transport), config.bind_host, config.port)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, TransportError) as error:
        # Error codes only; never print secrets, subprocess stderr or key paths.
        print(f"Display bridge startup failed: {type(error).__name__}", file=sys.stderr)
        raise SystemExit(1) from None
